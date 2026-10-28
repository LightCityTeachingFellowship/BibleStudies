import {createHash, randomUUID} from 'node:crypto';
import {requireStudioAdmin} from './studio-publishing.mjs';
const valid=id=>typeof id==='string'&&/^[\w-]{11}$/.test(id);
const previewUrl=id=>'https://lightcityfellowship.com/Admin/?test='+id;
// Test videos never enter the published library, source ID files or normal push queue.
export function createStudioTests(deps){
 const {db,auth,fail,messaging,send=fetch,now=Date.now}=deps;
 const root=uid=>'churchStudioPublications/private-test-'+createHash('sha256').update(uid).digest('hex');
 const testRef=(uid,id)=>db.doc(root(uid)+'/videos/'+id);
 async function devices(uid){
  const registered=await db.collection(root(uid)+'/devices').get();
  if(!registered.docs.length)return [];
  const subscribers=await db.getAll(...registered.docs.map(d=>db.doc('webPushSubscribers/'+d.id)));
  return [...new Map(subscribers.filter(d=>d.exists&&typeof d.data()?.token==='string'&&d.data().token).map(d=>[d.data().token,d])).values()];
 }
 return {
  async manage(request){
   const uid=await requireStudioAdmin(request,deps),action=request.data?.action;
   if(!['register','unregister'].includes(action))throw new fail('invalid-argument','Choose a device action.');
   const token=request.data?.deviceToken;
   if(typeof token!=='string'||token.length>10000)throw new fail('invalid-argument','Device sign-in is missing.');
   let device;try{device=(await auth.verifyIdToken(token,true)).uid;}catch{throw new fail('permission-denied','This device could not be verified.');}
   const ref=db.doc(root(uid)+'/devices/'+device);
   if(action==='unregister'){await ref.delete();return {registered:false};}
   const subscriber=await db.doc('webPushSubscribers/'+device).get();
   if(!subscriber.exists||!subscriber.data()?.token)throw new fail('failed-precondition','Enable LightCity notifications in this browser or installed app first, then return here to register this device.');
   await ref.set({registeredAt:now()});return {registered:true};
  },
  async publish(request){
   const uid=await requireStudioAdmin(request,deps),id=request.data?.videoId;
   if(!valid(id))throw new fail('invalid-argument','Enter a valid YouTube link or video ID.');
   const targets=await devices(uid);
   if(!targets.length)throw new fail('failed-precondition','Register your phone and computer for test alerts first. No notification was sent.');
   // Reserve before contacting YouTube or FCM, including concurrent requests.
   await db.runTransaction(async tx=>{const ref=db.doc(root(uid)),last=await tx.get(ref);if(last.data()?.nextTestAt>now())throw new fail('resource-exhausted','Wait 30 seconds before sending another test.');tx.set(ref,{nextTestAt:now()+30000},{merge:true});});
   let title='Private LightCity test';
   try{const response=await send('https://www.youtube.com/oembed?url='+encodeURIComponent('https://www.youtube.com/watch?v='+id)+'&format=json',{redirect:'error',signal:AbortSignal.timeout(10000)});if(response.ok){const value=(await response.json()).title;if(typeof value==='string'&&value.trim())title=value.trim().slice(0,300);}else await response.body?.cancel();}catch{}
   await testRef(uid,id).set({videoId:id,title,createdAt:now()});
   const key='studio-test-'+randomUUID(),url=previewUrl(id),data={id:key,title:'LightCity private test',body:title,url,image:'https://i.ytimg.com/vi/'+id+'/mqdefault.jpg'};
   let accepted=0;
   for(let i=0;i<targets.length;i+=500){const batch=targets.slice(i,i+500);const result=await messaging.sendEachForMulticast({tokens:batch.map(d=>d.data().token),notification:{title:data.title,body:title,imageUrl:data.image},data,webpush:{headers:{TTL:'3600',Urgency:'high'},notification:{icon:'https://lightcityfellowship.com/images/pwa-192.png',badge:'https://lightcityfellowship.com/images/notification-badge.png',tag:key,silent:false,renotify:true},fcmOptions:{link:url}}});accepted+=result.successCount;for(let j=0;j<result.responses.length;j++){if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(result.responses[j].error?.code))await batch[j].ref.delete();}}
   if(!accepted)throw new fail('unavailable','No test device accepted the alert. Enable notifications and register your devices again. The video was not published.');
   return {state:'ready',videoId:id,visibility:'test',title,url,accepted};
  },
  async status(request){
   const uid=await requireStudioAdmin(request,deps),id=request.data?.videoId;
   if(!valid(id))throw new fail('invalid-argument','Invalid test video.');
   const record=await testRef(uid,id).get();
   if(!record.exists)throw new fail('not-found','This private test was not found for your account.');
   return {state:'ready',videoId:id,visibility:'test',title:record.data().title,url:previewUrl(id)};
  }
 };
}
