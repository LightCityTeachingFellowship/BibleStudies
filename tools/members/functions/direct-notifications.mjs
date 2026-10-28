import {syncStudioBackup} from './studio-removal.mjs';
import {createHash} from 'node:crypto';
import {memberDeviceIds,recipients} from './push-audiences.mjs';
export async function finishDirectPublication({id,db,auth,messaging,github}){
 const ref=db.doc('churchStudioPublications/'+id),job=(await ref.get()).data();
 if(!job?.direct||job.state!=='ready')return;
 const current=await db.doc('churchVideoLibrary/current').get(),video=current.data()?.videos?.find(v=>v.id===id&&v.visibility===job.visibility);
 if(!video)return;
 const key=createHash('sha256').update('video:'+id).digest('hex'),sent=db.doc('webPushSent/'+key);
 // Reserve the same marker used by the legacy GitHub notifier before it can run.
 const lease=await db.runTransaction(async tx=>{const record=await tx.get(sent),data=record.data();if(record.exists&&!data.direct)return false;if(data?.sentAt||data?.silent)return false;if(data?.leaseUntil>Date.now())throw Error('Notification delivery is already running');tx.set(sent,{direct:true,leaseUntil:Date.now()+120000},{merge:true});return true;});
 if(lease){
  try{
   if(video.replaces?.length)await sent.set({direct:true,silent:true,replacementOf:video.replaces,leaseUntil:0});
   else{
    const subscribers=await db.collection('webPushSubscribers').get(),approved=video.visibility==='members'?await memberDeviceIds(db,auth,subscribers.docs):new Set();
    const targets=recipients(subscribers.docs,video.visibility,approved),url='https://lightcityfellowship.com/Watch/?v='+id;
    const data={id:key,title:'Video',body:video.title,url,image:'https://i.ytimg.com/vi/'+id+'/mqdefault.jpg'};
    for(let i=0;i<targets.length;i+=500){
     const batch=targets.slice(i,i+500),refs=batch.map(d=>db.doc('churchStudioPushBatches/'+key+'/tokens/'+createHash('sha256').update(d.data().token).digest('hex')));
     const receipts=await db.getAll(...refs),docs=batch.filter((d,j)=>!receipts[j].exists);
     if(!docs.length)continue;
     const result=await messaging.sendEachForMulticast({tokens:docs.map(d=>d.data().token),notification:{title:data.title,body:data.body,imageUrl:data.image},data,webpush:{headers:{TTL:'86400',Urgency:'high'},notification:{icon:'https://lightcityfellowship.com/images/pwa-192.png',badge:'https://lightcityfellowship.com/images/notification-badge.png',tag:key,silent:false,renotify:true},fcmOptions:{link:url}}});
     let failed=false;for(let j=0;j<result.responses.length;j++){const error=result.responses[j].error;if(error&&['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code))await docs[j].ref.delete();else if(error)failed=true;}
     const receiptBatch=db.batch();result.responses.forEach((value,j)=>{if(!value.error)receiptBatch.set(db.doc('churchStudioPushBatches/'+key+'/tokens/'+createHash('sha256').update(docs[j].data().token).digest('hex')),{sentAt:new Date()});});await receiptBatch.commit();
     if(failed)throw Error('Some notifications need retrying');
    }
    await sent.set({direct:true,sentAt:new Date(),leaseUntil:0});
   }
  }catch(error){await sent.set({leaseUntil:0},{merge:true});throw error;}
 }
 // The live catalogue is already available. This backup never gates Watch/Listen.
 await syncStudioBackup({id,db,github});
}