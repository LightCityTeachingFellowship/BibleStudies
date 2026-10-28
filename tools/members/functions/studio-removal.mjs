import {randomUUID} from 'node:crypto';
const valid=id=>typeof id==='string'&&/^[\w-]{11}$/.test(id);
export function listVersion(studio,id){return String(studio.entries?.find(e=>e.video.id===id)?.operationId||studio.entries?.find(e=>e.video.id===id)?.createdAt||'legacy');}
export async function removeStudioVideo({db,fail,videoId:id,expectedVersion,actor,now=Date.now}){
 if(!valid(id))throw new fail('invalid-argument','Choose a valid video to remove.');
 return db.runTransaction(async tx=>{
  const refs=['current','desired','studio'].map(name=>db.doc('churchVideoLibrary/'+name));
  const [current,desired,snapshot]=await Promise.all(refs.map(ref=>tx.get(ref)));
  const studio=snapshot.data()||{entries:[]};
  if(expectedVersion!==undefined&&expectedVersion!==listVersion(studio,id))throw new fail('aborted','This video changed online. Refresh the lists before removing it.');
  const all=[...(current.data()?.videos||[]),...(desired.data()?.videos||[]),...(studio.entries||[]).map(e=>e.video)];
  const row=all.find(v=>v.id===id),existing=(studio.removed||[]).find(r=>r.id===id);
  if(!row&&!existing)throw new fail('not-found','This video is no longer listed.');
  if(existing&&!row)return {removed:true,videoId:id};
  const aliases=(row?.replaces||[]).filter(alias=>!all.some(v=>v.id===alias)),ids=new Set([id,...aliases]),operationId=randomUUID();
  const removed=[...(studio.removed||[]).filter(r=>!ids.has(r.id)),...[...ids].map(key=>({id:key,visibility:row?.visibility==='public'?'public':'members',removedAt:now(),operationId}))];
  const prune=videos=>(videos||[]).filter(v=>!ids.has(v.id)).map(v=>({...v,...(v.replaces?{replaces:v.replaces.filter(from=>!ids.has(from)),replacementVisibility:Object.fromEntries(Object.entries(v.replacementVisibility||{}).filter(([from])=>!ids.has(from)))}:{})}));
  if(!Array.isArray(current.data()?.videos))throw new fail('unavailable','The published library could not be checked.');
  tx.set(refs[0],{...current.data(),videos:prune(current.data().videos),updatedAt:new Date(now())});
  if(desired.exists)tx.set(refs[1],{...desired.data(),videos:prune(desired.data()?.videos)});
  tx.set(refs[2],{...studio,entries:(studio.entries||[]).filter(e=>!ids.has(e.video.id)),removed});
  tx.set(db.doc('churchStudioPublications/'+id),{direct:true,videoId:id,visibility:row?.visibility||existing?.visibility||'members',state:'removed',removedIds:[...ids],operationId,removedAt:now(),removedBy:actor,backedUp:false},{merge:true});
  return {removed:true,videoId:id};
 });
}
export async function syncStudioBackup({id,db,github}){
 const ref=db.doc('churchStudioPublications/'+id);let repair=false;
 for(let attempt=0;attempt<3;attempt++){
  const job=(await ref.get()).data();if(!job?.direct||!['ready','removed'].includes(job.state)||(job.backedUp&&!repair))return;
  const version=job.operationId||job.requestedAt;
  if(job.state==='removed')await github.remove(job.removedIds||[id]);else await github.add(id,job.visibility,job.replaceVideoId);
  const confirmed=await db.runTransaction(async tx=>{const latest=(await tx.get(ref)).data();if((latest?.operationId||latest?.requestedAt)!==version||latest?.state!==job.state)return false;tx.set(ref,{backedUp:true},{merge:true});return true;});
  if(confirmed)return;repair=true;
 }
 throw Error('Video changed during backup; retrying its newest state.');
}