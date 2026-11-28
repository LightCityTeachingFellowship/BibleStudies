import {createHash,randomUUID} from 'node:crypto';
import {validateNotificationSchedule,notificationOccurrence} from './notification-schedule-core.mjs';
import {requireStudioAdmin} from './studio-publishing.mjs';
import {memberDeviceIds,recipients} from './push-audiences.mjs';
import {NOTIFICATION_TYPES,validateNotificationTemplate} from './notification-templates.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const validId=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
export function createNotificationCenter(deps){
 const {db,auth,messaging,fail,now=Date.now}=deps;
 async function manage(request){
  const uid=await requireStudioAdmin(request,deps),data=request.data||{};
  if(data.action==='get'){
   const [doc,communion]=await Promise.all([db.doc('churchStudioPublications/notification-center/settings/current').get(),db.doc('churchStudioPublications/prayer-groups/communion-settings/current').get()]);
   const templates={...(doc.data()?.templates||{})},old=communion.data();
   if(!templates.communion&&old?.title&&old?.body)templates.communion={title:old.title,body:old.body,image:''};
   return {templates,types:NOTIFICATION_TYPES,prayerGroupImages:doc.data()?.prayerGroupImages||{},serviceReminderMinutes:doc.data()?.serviceReminderMinutes??30};
  }
  if(data.action==='save'){
   if(!Object.hasOwn(NOTIFICATION_TYPES,data.type))throw new fail('invalid-argument','Choose a notification type.');
   let template;try{template=validateNotificationTemplate(data.template)}catch(e){throw new fail('invalid-argument',e.message)}
   const variables={video:['contentTitle','contentType'],article:['contentTitle','contentType'],summary:['contentTitle','contentType'],quiz:['contentTitle','contentType'],learning:['contentTitle','contentType'],prayerMorning:['group'],prayerToday:['group'],prayerStarting:['group'],prayerWeek:['group'],service:['serviceTitle'],communion:[],streamReport:['reportTitle','reportBody']}[data.type];
   for(const match of (template.title+' '+template.body).matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g))if(!variables.includes(match[1]))throw new fail('invalid-argument','That placeholder is not available for this notification.');
   await db.doc('churchStudioPublications/notification-center/settings/current').set({templates:{[data.type]:template}},{merge:true});
   if(data.type==='communion')await db.doc('churchStudioPublications/prayer-groups/communion-settings/current').set({title:template.title,body:template.body,updatedAt:now(),updatedBy:uid},{merge:true});
   return {ok:true};
  }
  if(data.action==='saveServiceReminder'){
   if(!Number.isInteger(data.minutes)||data.minutes<0||data.minutes>1440)throw new fail('invalid-argument','Choose a time from 0 to 1440 minutes before the service.');
   await db.doc('churchStudioPublications/notification-center/settings/current').set({serviceReminderMinutes:data.minutes},{merge:true});return {ok:true};
  }
  if(data.action==='listSchedules'){
   const result=await db.collection('churchStudioPublications/notification-center/schedules').where('enabled','==',true).limit(200).get();
   return {schedules:result.docs.map(d=>({id:d.id,...d.data()})).filter(row=>row.enabled)};
  }
  if(data.action==='stopSchedule'){
   if(!validId(data.id))throw new fail('invalid-argument','Choose a schedule.');
   await db.doc('churchStudioPublications/notification-center/schedules/'+data.id).set({enabled:false,stoppedAt:now()},{merge:true});return {ok:true};
  }
  if(data.action==='createSchedule'){
   let timing,copy;try{timing=validateNotificationSchedule(data.schedule);copy=validateNotificationTemplate(data)}catch(e){throw new fail('invalid-argument',e.message)}
   if(!['members','public'].includes(data.audience)||/[{}]/.test(copy.title+copy.body))throw new fail('invalid-argument','Choose an audience and use plain text.');
   let url;try{url=new URL(data.url||'https://lightcityfellowship.com/');if(url.protocol!=='https:'||url.hostname!=='lightcityfellowship.com'||url.username||url.password)throw Error()}catch{throw new fail('invalid-argument','Use a LightCity website link.')}
   const first=Date.parse(timing.startDate+'T'+timing.time+':00+01:00');if(first<=now())throw new fail('invalid-argument','Choose a future date and time in Nigeria.');
   const id=randomUUID();await db.doc('churchStudioPublications/notification-center/schedules/'+id).set({...timing,...copy,url:url.href,audience:data.audience,createdBy:uid,createdAt:now(),enabled:true});return {ok:true,id};
  }
  if(data.action==='saveGroupImage'){
   if(!['MAN','OX','LION','EAGLE'].includes(data.group))throw new fail('invalid-argument','Choose a prayer group.');
   let image;try{image=validateNotificationTemplate({title:'Prayer',body:'Prayer',image:data.image}).image}catch(e){throw new fail('invalid-argument',e.message)}
   await db.doc('churchStudioPublications/notification-center/settings/current').set({prayerGroupImages:{[data.group]:image}},{merge:true});return {ok:true};
  }
  if(data.action==='image'){
   if(typeof data.base64!=='string'||data.base64.length>600000||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64))throw new fail('invalid-argument','Choose a PNG, JPEG or WebP image smaller than 400 KB.');
   const bytes=Buffer.from(data.base64,'base64');
   let contentType='';
   if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))contentType='image/png';
   else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)contentType='image/jpeg';
   else if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')contentType='image/webp';
   if(!contentType||bytes.length>400000)throw new fail('invalid-argument','Choose a PNG, JPEG or WebP image smaller than 400 KB.');
   const project=process.env.GCLOUD_PROJECT;if(!project||!/^[a-z0-9-]+$/.test(project))throw new fail('unavailable','Image storage is not configured.');
   const id=digest(bytes);await db.doc('churchStudioPublications/notification-center/images/'+id).set({base64:data.base64,contentType,createdBy:uid,createdAt:now()});
   return {url:'https://us-central1-'+project+'.cloudfunctions.net/churchNotificationImage?id='+id};
  }
  if(data.action==='send'){
   if(!validId(data.id)||!['members','public'].includes(data.audience))throw new fail('invalid-argument','Choose an audience and try again.');
   let copy;try{copy=validateNotificationTemplate(data)}catch(e){throw new fail('invalid-argument',e.message)}
   if(/[{}]/.test(copy.title+copy.body))throw new fail('invalid-argument','Custom notifications must use plain text.');
   let url;try{url=new URL(data.url||'https://lightcityfellowship.com/');if(url.protocol!=='https:'||url.hostname!=='lightcityfellowship.com'||url.username||url.password)throw Error()}catch{throw new fail('invalid-argument','Use a LightCity website link.');}
   const job=db.doc('churchStudioPublications/notification-center/custom/'+data.id),value={title:copy.title,body:copy.body,image:copy.image,url:url.href,audience:data.audience,createdBy:uid};
   const acquired=await db.runTransaction(async tx=>{const old=await tx.get(job);if(old.exists)return false;tx.create(job,{...value,state:'sending',createdAt:now()});return true});
   if(!acquired)throw new fail('already-exists','This message was already submitted. Check its status before sending again.');
   let accepted=0,failed=0;
   try{
    const subs=await db.collection('webPushSubscribers').get();
    const approved=data.audience==='members'?await memberDeviceIds(db,auth,subs.docs):new Set();
    const targets=recipients(subs.docs,data.audience,approved),key=digest('custom:'+data.id),payload={id:key,title:copy.title,body:copy.body,url:url.href,...(copy.image?{image:copy.image}:{})};
    for(let i=0;i<targets.length;i+=500){
     const docs=targets.slice(i,i+500);const result=await messaging.sendEachForMulticast({tokens:docs.map(d=>d.data().token),notification:{title:copy.title,body:copy.body,...(copy.image?{imageUrl:copy.image}:{})},data:payload,webpush:{headers:{TTL:'86400',Urgency:'high'},notification:{icon:'https://lightcityfellowship.com/images/pwa-192.png',badge:'https://lightcityfellowship.com/images/notification-badge.png',tag:key,...(copy.image?{image:copy.image}:{})},fcmOptions:{link:url.href}}});
     accepted+=result.successCount;failed+=result.failureCount;
     for(let j=0;j<result.responses.length;j++)if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(result.responses[j].error?.code))await docs[j].ref.delete();
    }
    await job.set({state:'sent',accepted,failed,completedAt:now()},{merge:true});return {ok:true,accepted,failed};
   }catch(error){await job.set({state:'incomplete',accepted,failed,completedAt:now()},{merge:true});throw new fail('unavailable','Delivery did not finish. Some people may have received the message; check before sending again.');}
  }
  throw new fail('invalid-argument','Choose an action.');
 }
 async function image(req,res){
  const id=req.query.id;if(req.method!=='GET'||typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id)){res.status(404).end();return;}
  try{const doc=await db.doc('churchStudioPublications/notification-center/images/'+id).get(),data=doc.data();if(!data||!['image/png','image/jpeg','image/webp'].includes(data.contentType)){res.status(404).end();return;}res.set('Content-Type',data.contentType);res.set('Cache-Control','public, max-age=86400');res.set('X-Content-Type-Options','nosniff');res.status(200).send(Buffer.from(data.base64,'base64'));}catch{res.status(503).end();}
 }
 async function runSchedules(){
  const snapshot=await db.collection('churchStudioPublications/notification-center/schedules').where('enabled','==',true).limit(200).get();
  for(const doc of snapshot.docs){const row=doc.data();let occurrence=null;for(let i=0;i<5&&!occurrence;i++)occurrence=notificationOccurrence(row,now()-i*60000);if(!occurrence)continue;
   const fresh=(await doc.ref.get()).data();if(!fresh?.enabled)continue;
   const hex=digest(doc.id+':'+occurrence),id=hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20,32);
   try{await manage({auth:{uid:row.createdBy},data:{action:'send',id,title:row.title,body:row.body,image:row.image,url:row.url,audience:row.audience}});await doc.ref.set({lastOccurrence:occurrence,lastResult:'sent'},{merge:true})}
   catch(error){if(error.code!=='already-exists')await doc.ref.set({lastOccurrence:occurrence,lastResult:'failed',lastError:String(error.message||'Delivery failed').slice(0,200)},{merge:true})}
   if(row.frequency==='once')await doc.ref.set({enabled:false},{merge:true});
  }
 }
 return {manage,image,runSchedules};
}
