import {createHash} from 'node:crypto';
import {accessFor} from './learning-core.mjs';
import {memberDeviceIds,recipients} from './push-audiences.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
export async function notifyLearning({id,db,auth,messaging,now=Date.now}){
 const resourceRef=db.doc('churchVideoActivity/learning/resources/'+id),resource=(await resourceRef.get()).data();
 if(resource?.state!=='published'||resource.notificationState==='sent')return;
 const key=hash('learning:'+id),sent=db.doc('webPushSent/'+key);
 const leased=await db.runTransaction(async tx=>{const record=await tx.get(sent),r=record.data();if(r?.sentAt)return false;if(r?.leaseUntil>now())throw Error('Notification delivery already running');tx.set(sent,{learning:true,leaseUntil:now()+120000},{merge:true});return true;});
 if(!leased){await resourceRef.set({notificationState:'sent'},{merge:true});return;}
 try{
  const subscribers=await db.collection('webPushSubscribers').get();
  // Recheck the current audience before every batch: a privacy edit also governs delayed delivery.
  for(let i=0;i<subscribers.docs.length;i+=200){
   const batch=subscribers.docs.slice(i,i+200),library=(await db.doc('churchVideoLibrary/current').get()).data()?.videos;
   if(!Array.isArray(library))throw Error('Published access policy unavailable');
   const visibility=accessFor(resource,library);if(!visibility)throw Error('Source teaching unavailable');
   const approved=visibility==='members'?await memberDeviceIds(db,auth,batch):new Set(),targets=recipients(batch,visibility,approved);
   if(!targets.length)continue;
   const receipts=await db.getAll(...targets.map(d=>db.doc('churchVideoActivity/learning/push/'+key+'/tokens/'+hash(d.data().token))));
   const docs=targets.filter((_,n)=>!receipts[n].exists);if(!docs.length)continue;
   const url='https://lightcityfellowship.com/StudyResource/?id='+encodeURIComponent(id),data={id:key,title:resource.kind,body:resource.title,url};
   const result=await messaging.sendEachForMulticast({tokens:docs.map(d=>d.data().token),notification:{title:data.title,body:data.body},data,webpush:{headers:{TTL:'86400',Urgency:'high'},notification:{icon:'https://lightcityfellowship.com/images/pwa-192.png',tag:key},fcmOptions:{link:url}}});
   const write=db.batch();let retry=false;
   result.responses.forEach((r,n)=>{if(!r.error)write.set(db.doc('churchVideoActivity/learning/push/'+key+'/tokens/'+hash(docs[n].data().token)),{sentAt:new Date(now())});else if(!['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(r.error.code))retry=true;});
   await write.commit();if(retry)throw Error('Some notifications need another delivery attempt');
  }
  await sent.set({learning:true,sentAt:new Date(now()),leaseUntil:0});await resourceRef.set({notificationState:'sent'},{merge:true});
 }catch(error){await sent.set({leaseUntil:0},{merge:true});throw error;}
}
