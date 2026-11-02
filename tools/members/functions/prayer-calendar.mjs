import {createHash,randomUUID} from 'node:crypto';
import {requireStudioAdmin} from './studio-publishing.mjs';
import {nextService,DEFAULT_SERVICE_SCHEDULE,validateServiceSchedule} from './service-schedule.mjs';
import {GROUPS,DEFAULT_PRAYER_SETTINGS,ZONE,DAY,dateKey,validDate,instant,addDays,weekday,weekOwner,prayerForDate,prayerRange,prayerPaused,validatePrayerSettings,contentDate,monthBounds} from './prayer-calendar-core.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const safeUid=uid=>typeof uid==='string'&&uid.length>0&&uid.length<=128&&!uid.includes('/');
const safePhone=value=>typeof value==='string'&&(!value||/^\+[1-9]\d{7,14}$/.test(value));
export function createPrayerCalendar(deps){
 const {db,auth,fail,messaging,now=Date.now,send=fetch,privateCatalog=[],recordings=async()=>[]}=deps,settingsRef=()=>db.doc('churchStudioPublications/prayer-groups/settings/current');let readingCache,readingUntil=0;
 async function settings(){const doc=await settingsRef().get();return doc.exists?{...doc.data(),...validatePrayerSettings(doc.data())}:structuredClone({...DEFAULT_PRAYER_SETTINGS,leaders:{}});}
 async function member(request,required=false){const uid=request.auth?.uid;if(!uid){if(required)throw new fail('unauthenticated','Church member access is required.');return null;}if(request.data?.accountUid!==uid)throw new fail('permission-denied','Your account changed. Refresh and try again.');const [user,record]=await Promise.all([auth.getUser(uid),db.doc('churchMembers/'+uid).get()]);if(user.disabled||!user.emailVerified||!user.providerData?.length||record.data()?.active!==true){if(required)throw new fail('permission-denied','Church member access is required.');return null;}return {uid,name:user.displayName||'Church member'};}
 async function services(start,end){const snap=await db.doc('churchServiceSchedule/current').get(),schedule=snap.exists?validateServiceSchedule(snap.data()):DEFAULT_SERVICE_SCHEDULE,result=[];let cursor=instant(addDays(start,-1),'00:00');const until=instant(addDays(end,2),'00:00');for(let i=0;i<500;i++){const event=nextService(schedule,cursor);if(!event||event.startAt>=until)break;result.push({id:'service-'+event.startAt,kind:'Service',title:event.name,startAt:event.startAt,endAt:event.startAt+schedule.holdMinutes*60000,date:dateKey(event.startAt)});cursor=event.startAt+schedule.holdMinutes*60000;}return result;}
 async function readings(){if(readingCache&&readingUntil>now())return readingCache;const response=await send('https://lightcityfellowship.com/study-catalog.json',{signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw Error('Reading catalogue unavailable');const data=await response.json();if(!Array.isArray(data.publications))throw Error('Invalid reading catalogue');readingCache=data.publications;readingUntil=now()+5*60000;return readingCache;}
 const videoDateCache=new Map();let dateFlight;
 async function videoDates(videos){
  const result=new Map(),missing=[];
  for(const video of videos){const titleDate=contentDate(video.title),storedDate=contentDate(video.publishedAt);if(titleDate||storedDate){result.set(video.id,titleDate||storedDate);continue;}if(/^[A-Za-z0-9_-]{11}$/.test(video.id))missing.push(video.id);}
  // Publication dates are stable. Persist the fallback so browsing months does not
  // repeatedly call YouTube; unavailable videos are checked again after one day.
  const ids=[...new Set(missing)];if(!ids.length)return result;
  if(dateFlight)await dateFlight;
  const load=async()=>{
   const unknown=ids.filter(id=>!videoDateCache.has(id)||videoDateCache.get(id).until<=now());
   for(let offset=0;offset<unknown.length;offset+=100){const batch=unknown.slice(offset,offset+100),rows=await db.getAll(...batch.map(id=>db.doc('churchStudioPublications/prayer-groups/video-dates/'+id)));rows.forEach((row,index)=>{const data=row.data();if(validDate(data?.date))videoDateCache.set(batch[index],{date:data.date,until:Infinity});else if(data?.checkedAt>now()-DAY)videoDateCache.set(batch[index],{date:null,until:data.checkedAt+DAY});});}
   const pending=ids.filter(id=>!videoDateCache.has(id)||videoDateCache.get(id).until<=now()),key=deps.youtubeKey?.();if(!pending.length||!key)return;
   for(let offset=0;offset<pending.length;offset+=50){const batch=pending.slice(offset,offset+50),url=new URL('https://www.googleapis.com/youtube/v3/videos');url.search=new URLSearchParams({part:'snippet',id:batch.join(','),fields:'items(id,snippet/publishedAt)',key}).toString();const response=await send(url.toString(),{signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw Error('Recording dates could not refresh.');const data=await response.json();if(!Array.isArray(data.items))throw Error('Invalid recording dates');const dates=new Map();for(const row of data.items){const stamp=Date.parse(row.snippet?.publishedAt);if(batch.includes(row.id)&&Number.isFinite(stamp))dates.set(row.id,dateKey(stamp));}for(const id of batch){const date=dates.get(id)||null;await db.doc('churchStudioPublications/prayer-groups/video-dates/'+id).set({date,checkedAt:now()});videoDateCache.set(id,{date,until:date?Infinity:now()+DAY});}}
  };
  const flight=load();dateFlight=flight;try{await flight;}finally{if(dateFlight===flight)dateFlight=null;}
  for(const id of ids){const date=videoDateCache.get(id)?.date;if(date)result.set(id,date);}return result;
 }
 async function self(person,config){const record=(await db.doc('churchStudioPublications/prayer-groups/members/'+person.uid).get()).data(),group=GROUPS.includes(record?.group)?record.group:null;return {group,leader:!!group&&config.leaders?.[group]?.uid===person.uid};}
 async function leaderNames(config){const result={};for(const group of GROUPS){const uid=config.leaders?.[group]?.uid;if(!safeUid(uid))continue;try{const user=await auth.getUser(uid);if(!user.disabled)result[group]=user.displayName||'Group leader';}catch{}}return result;}
 async function deliver(jobId){
  const ref=db.doc('churchStudioPublications/prayer-groups/notices/'+jobId),job=(await ref.get()).data();if(!job||job.sentAt)return;
  const acquired=await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.data()?.sentAt||snap.data()?.leaseUntil>now())return false;tx.set(ref,{leaseUntil:now()+120000},{merge:true});return true;});if(!acquired)return;
  try{
   const cfg=await settings();if(job.expiresAt<=now()||job.kind!=='service'&&prayerPaused(job.date,cfg)){await ref.set({leaseUntil:0,skippedAt:now()},{merge:true});return;}
   const candidates=job.group?(await db.collection('churchStudioPublications/prayer-groups/members').where('group','==',job.group).get()).docs:(await db.collection('churchMembers').where('active','==',true).get()).docs;
   const uids=[];for(const doc of candidates){try{const [user,approval]=await Promise.all([auth.getUser(doc.id),db.doc('churchMembers/'+doc.id).get()]);if(!user.disabled&&user.emailVerified&&user.providerData?.length&&approval.data()?.active===true)uids.push(doc.id);}catch{}}
   const eligible=new Set(uids);
   // A durable account inbox is independent of device push permissions.
   for(const uid of uids)await db.doc('churchVideoActivity/'+uid+'/prayerInbox/'+jobId).set({title:job.title,body:job.body,url:job.url,kind:job.kind==='service'?'Service reminder':'Prayer reminder',sentAt:job.createdAt,startAt:job.startAt||null,group:job.group||null},{merge:true});
   const subscribers=await db.collection('webPushSubscribers').get(),targets=new Map();
   for(let i=0;i<subscribers.docs.length;i+=100){const docs=subscribers.docs.slice(i,i+100),bindings=docs.length?await db.getAll(...docs.map(d=>db.doc('churchDevices/'+d.id))):[];docs.forEach((d,j)=>{const token=d.data()?.token;if(eligible.has(bindings[j].data()?.memberUid)&&typeof token==='string'&&token)targets.set(token,d);});}
   for(const [token,subscriber]of targets){const receipt=ref.collection('delivery').doc(hash(token));if((await receipt.get()).exists)continue;
    // Recheck the binding and membership immediately before sending.
    const binding=(await db.doc('churchDevices/'+subscriber.id).get()).data(),uid=binding?.memberUid;if(!eligible.has(uid)||(await db.doc('churchMembers/'+uid).get()).data()?.active!==true)continue;
    const result=await messaging.sendEachForMulticast({tokens:[token],notification:{title:job.title,body:job.body},data:{id:jobId,title:job.title,body:job.body,url:job.url},webpush:{headers:{TTL:String(Math.max(1,Math.floor((job.expiresAt-now())/1000))),Urgency:'high'},notification:{icon:'https://lightcityfellowship.com/images/pwa-192.png',badge:'https://lightcityfellowship.com/images/notification-badge.png',tag:jobId,silent:false},fcmOptions:{link:job.url}}});
    const error=result.responses[0]?.error;if(error){if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code)){await subscriber.ref.delete();continue;}throw Error('Reminder delivery will retry.');}await receipt.set({sentAt:now()});
   }await ref.set({sentAt:now(),leaseUntil:0},{merge:true});
  }catch(error){await ref.set({leaseUntil:0},{merge:true});throw error;}
 }
 async function queue(notice){const id=hash(notice.key),ref=db.doc('churchStudioPublications/prayer-groups/notices/'+id);await db.runTransaction(async tx=>{if((await tx.get(ref)).exists)return;tx.set(ref,{...notice,createdAt:now()});});await deliver(id);}
 function dailyNotice(event,manual=false){return {key:(manual?'today:':'prayer:')+event.id,kind:'prayer',date:event.date,group:event.group,startAt:event.startAt,title:event.group+' prayer reminder',body:manual?'Your group is scheduled to pray today. Open the calendar for your local time.':'Your group prayer begins in 30 minutes. Open the calendar for your local time.',url:'https://lightcityfellowship.com/Calendar/?date='+event.date+'&at='+event.startAt,expiresAt:event.endAt};}
 return {
  async calendar(request){
   const {start,end}=monthBounds(request.data?.month),person=await member(request),config=await settings(),earliest=addDays(dateKey(now()),-1),plannedStart=addDays(start,-1)>earliest?addDays(start,-1):earliest,events=end<plannedStart?[]:await services(plannedStart,end),issues=[];
   const [library,readingResult,audioResult]=await Promise.all([db.doc('churchVideoLibrary/current').get(),readings().catch(()=>{issues.push('Publications could not refresh. Try again.');return[];}),recordings().catch(()=>[])]),audio=new Set(audioResult.map(r=>r.videoId));
   const videos=library.data()?.videos||[],restricted=new Set(videos.filter(v=>v.visibility!=='public').map(v=>v.id)),visible=[...new Map(videos.map(v=>[v.id,v])).values()].filter(v=>person||!restricted.has(v.id));
   const dates=await videoDates(visible).catch(()=>{issues.push('Some recording dates could not refresh. Try again.');return new Map(visible.map(v=>[v.id,contentDate(v.title)||contentDate(v.publishedAt)]));});
   for(const video of visible){const date=dates.get(video.id);if(!date||date<start||date>end)continue;events.push({id:'video-'+video.id,kind:'Video',title:video.title,date,url:'/Watch/?v='+video.id,...(audio.has(video.id)?{audioUrl:'/Watch/?v='+video.id+'&mode=audio'}:{})});}
   for(const row of [...readingResult,...(person?privateCatalog:[])]){if(!['Article','Summary'].includes(row.kind)||!validDate(row.date)||row.date<start||row.date>end)continue;try{const url=new URL(row.url,'https://lightcityfellowship.com');if(url.origin!=='https://lightcityfellowship.com')continue;events.push({id:row.kind+'-'+url.pathname,kind:row.kind,title:row.title,date:row.date,url:url.pathname});}catch{}}
   const selectedMonth=monthBounds(request.data.month);if(person&&addDays(selectedMonth.end,1)>=plannedStart)events.push(...prayerRange(plannedStart,addDays(selectedMonth.end,1),config));
   return {events,issues,serverNow:now(),timeZone:ZONE,...(person?{prayer:{settings:{...validatePrayerSettings(config),forceDates:config.forceDates||[]},self:await self(person,config),leaders:await leaderNames(config)}}:{})};
  },
  async mine(request){const person=await member(request,true),config=await settings(),today=dateKey(now());return {settings:{...validatePrayerSettings(config),forceDates:config.forceDates||[]},self:await self(person,config),leaders:await leaderNames(config),events:prayerRange(addDays(today,-1),addDays(today,1),config),weekOwner:weekOwner(today,config),serverNow:now()};},
  async join(request){const person=await member(request,true),config=await settings(),group=request.data?.group;if(!GROUPS.includes(group))throw new fail('invalid-argument','Choose a prayer group.');const date=request.data?.date;if(!validDate(date))throw new fail('invalid-argument','Choose the prayer date.');const event=prayerForDate(date,config);if(!event||event.group!==group||event.paused||now()<event.startAt||now()>=event.endAt)throw new fail('failed-precondition','This group is not currently scheduled to pray.');const leader=config.leaders?.[group],phone=leader?.whatsapp;if(leader?.uid){const [assignment,approval,user]=await Promise.all([db.doc('churchStudioPublications/prayer-groups/members/'+leader.uid).get(),db.doc('churchMembers/'+leader.uid).get(),auth.getUser(leader.uid)]);if(assignment.data()?.group!==group||approval.data()?.active!==true||user.disabled||!user.emailVerified)throw new fail('failed-precondition','The group leader needs to be updated in Studio.');}if(!phone)throw new fail('failed-precondition','The group leader’s WhatsApp number has not been added yet.');return {url:'https://wa.me/'+phone.slice(1)+'?text='+encodeURIComponent('Hello, this is '+person.name+'. Please may I join the '+group+' prayer call taking place now?')};},
  async manage(request){
   await requireStudioAdmin(request,deps);const data=request.data||{};
   if(data.action==='get'){const config=await settings(),roster=await db.collection('churchStudioPublications/prayer-groups/members').get();return {settings:config,roster:roster.docs.map(d=>({uid:d.id,group:d.data().group,whatsapp:d.data().whatsapp||''}))};}
   if(data.action==='assign'){
    if(!safeUid(data.uid)||data.group!==null&&!GROUPS.includes(data.group)||!safePhone(data.whatsapp||''))throw new fail('invalid-argument','Choose a member and group.');
    if(data.group){const [user,record]=await Promise.all([auth.getUser(data.uid),db.doc('churchMembers/'+data.uid).get()]);if(user.disabled||!user.emailVerified||!user.providerData?.length||record.data()?.active!==true)throw new fail('permission-denied','Only approved church members can be assigned.');}
    await db.runTransaction(async tx=>{const ref=db.doc('churchStudioPublications/prayer-groups/members/'+data.uid),snap=await tx.get(settingsRef()),cfg=snap.exists?snap.data():structuredClone({...DEFAULT_PRAYER_SETTINGS,leaders:{}});const leaders={...cfg.leaders};for(const group of GROUPS)if(leaders[group]?.uid===data.uid){if(group!==data.group)delete leaders[group];else leaders[group]={...leaders[group],whatsapp:data.whatsapp||''};}tx.set(settingsRef(),{...cfg,leaders,revision:randomUUID()});if(data.group)tx.set(ref,{group:data.group,whatsapp:data.whatsapp||'',updatedAt:now()});else tx.delete(ref);});return {ok:true};
   }
   if(data.action==='save'){
    let input;try{input=validatePrayerSettings(data.settings);}catch(error){throw new fail('invalid-argument',error.message);}const leaders={};
    for(const group of GROUPS){const leader=data.settings.leaders?.[group];if(!leader?.uid){if(leader?.whatsapp)throw new fail('invalid-argument','Select a leader before adding a WhatsApp number.');continue;}if(!safeUid(leader.uid)||!safePhone(leader.whatsapp))throw new fail('invalid-argument','Use an international WhatsApp number, for example +234…');const [user,assignment,approval]=await Promise.all([auth.getUser(leader.uid),db.doc('churchStudioPublications/prayer-groups/members/'+leader.uid).get(),db.doc('churchMembers/'+leader.uid).get()]);if(user.disabled||!user.emailVerified||assignment.data()?.group!==group||approval.data()?.active!==true)throw new fail('invalid-argument','Each leader must be an approved member of that group.');leaders[group]={uid:leader.uid,whatsapp:leader.whatsapp||''};}
    await db.runTransaction(async tx=>{const old=await tx.get(settingsRef());if((old.data()?.revision||'initial')!==data.expectedRevision)throw new fail('aborted','Settings changed on another device. Reload before saving.');for(const leader of Object.values(leaders))tx.set(db.doc('churchStudioPublications/prayer-groups/members/'+leader.uid),{whatsapp:leader.whatsapp},{merge:true});tx.set(settingsRef(),{...input,leaders,forceDates:(old.data()?.forceDates||[]).filter(d=>d>=dateKey(now())),revision:randomUUID(),updatedAt:now()});});return {ok:true};
   }
   if(data.action==='today'){const config=await settings(),today=dateKey(now()),event=prayerForDate(today,config);if(!event)throw new fail('failed-precondition','There is no group prayer on Monday or Wednesday.');if(now()>=event.endAt)throw new fail('failed-precondition','Today’s prayer period has already ended.');await db.runTransaction(async tx=>{const old=await tx.get(settingsRef()),cfg=old.exists?old.data():config;tx.set(settingsRef(),{...cfg,forceDates:[...new Set([...(cfg.forceDates||[]).filter(d=>d>=today),today])],revision:randomUUID()});});await queue(dailyNotice(event,true));return {ok:true,group:event.group};}
   throw new fail('invalid-argument','Choose a prayer-group action.');
  },
  async reminders(){
   // New deployments do not activate reminders until Studio settings have been saved.
   if(!(await settingsRef().get()).exists)return;
   const config=await settings(),today=dateKey(now()),due=at=>at<=now()&&now()-at<10*60000;
   for(const date of [addDays(today,-1),today,addDays(today,1)]){const event=prayerForDate(date,config);if(event&&!event.paused&&due(event.startAt-30*60000))await queue(dailyNotice(event));
    if(weekday(date)===6){const next=addDays(date,1),group=weekOwner(next,config);if(!prayerPaused(next,config)&&!prayerPaused(date,config)&&due(instant(date,config.weeklyReminderTime)))await queue({key:'week:'+next,kind:'week',date,group,title:group+' owns the coming prayer week',body:'Your group owns next week and prays on Sunday and Tuesday. Open the calendar to see your local times.',url:'https://lightcityfellowship.com/Calendar/?date='+next+'&at='+instant(next,config.times[group]),expiresAt:instant(next,'23:59')});}
   }
   if(config.serviceReminders)for(const event of await services(today,addDays(today,1)))if(due(event.startAt-30*60000))await queue({key:event.id,kind:'service',date:event.date,title:'Service begins in 30 minutes',body:event.title+'. Open the calendar for your local time.',startAt:event.startAt,url:'https://lightcityfellowship.com/Calendar/?date='+event.date+'&at='+event.startAt,expiresAt:event.startAt+30*60000});
   // Retry only recent unfinished jobs. Older reminders are never sent late.
   const pending=await db.collection('churchStudioPublications/prayer-groups/notices').where('createdAt','>=',now()-10*60000).get();for(const job of pending.docs)if(!job.data().sentAt&&!job.data().skippedAt)await deliver(job.id);
  }
 };
}
