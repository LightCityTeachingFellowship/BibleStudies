import {listVersion,removeStudioVideo} from './studio-removal.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {requireStudioAdmin} from './studio-publishing.mjs';
import {mergeStudioVideos,shareVideoUrl} from './direct-library.mjs';
const valid=id=>typeof id==='string'&&/^[\w-]{11}$/.test(id);
export function createDirectPublishing(deps) {
 const {db,fail,live,recordings,send=fetch,now=Date.now}=deps;
 async function promote(id) {
  const request=await db.doc('churchStudioPublications/'+id).get(),job=request.data();
  if(!job?.direct||job.state==='removed')return false;
  if(job.state==='ready')return true;
  const checks=await Promise.allSettled([recordings(),live.catalog()]);
  const audio=checks[0].status==='fulfilled'?checks[0].value:[],feeds=checks[1].status==='fulfilled'?checks[1].value:[];
  const recording=audio.find(r=>r.videoId===id&&r.bytes>0&&/^[a-f0-9]{64}$/.test(r.sha256||'')),feed=feeds.find(r=>r.videoId===id&&r.active===true&&!r.replay&&r.expiresAt>now());
  if(!recording&&!feed)return false;
  return db.runTransaction(async tx=>{
   const currentRef=db.doc('churchVideoLibrary/current'),studioRef=db.doc('churchVideoLibrary/studio'),jobRef=db.doc('churchStudioPublications/'+id);
   const sentRef=db.doc('webPushSent/'+createHash('sha256').update('video:'+id).digest('hex'));
   const [current,studio,latest,sent]=await Promise.all([tx.get(currentRef),tx.get(studioRef),tx.get(jobRef),tx.get(sentRef)]);
   const state=studio.data()||{entries:[]},entry=state.entries?.find(e=>e.video.id===id);
   if(latest.data()?.state==='removed'||state.removed?.some(r=>r.id===id))return false;
   if(!entry)return false;
   if(latest.data()?.state==='ready')return true;
   if(!Array.isArray(current.data()?.videos))throw Error('Published baseline unavailable');
   const video={...entry.video,title:entry.video.title||recording?.title||feed?.title};
   const entries=state.entries.filter(e=>!(video.replaces||[]).includes(e.video.id)).map(e=>e.video.id===id?{...e,video,state:'ready'}:e);
   const videos=mergeStudioVideos(current.data().videos,{entries});
   if(Buffer.byteLength(JSON.stringify(videos))>850000)throw Error('Library capacity reached');
   tx.set(currentRef,{...current.data(),videos,updatedAt:new Date(now())});
   tx.set(studioRef,{...state,entries});
   if(!sent.exists)tx.set(sentRef,{direct:true,leaseUntil:0});
   tx.set(jobRef,{state:'ready',readyAt:now(),title:video.title},{merge:true});
   return true;
  });
 }
 return {
  promote,
  async remove(request){const uid=await requireStudioAdmin(request,deps);return removeStudioVideo({db,fail,videoId:request.data?.videoId,actor:uid,now});},
  async removeFromHelper(id,expectedVersion){if(typeof expectedVersion!=='string'||expectedVersion.length>100)throw new fail('invalid-argument','A current list version is required.');return removeStudioVideo({db,fail,videoId:id,expectedVersion,actor:'local-list-helper',now});},
  async listState(){const studio=(await db.doc('churchVideoLibrary/studio').get()).data()||{};const videos=await this.source();return {videos,versions:Object.fromEntries(videos.map(v=>[v.id,listVersion(studio,v.id)])),removed:(studio.removed||[]).map(r=>r.id)};},
  async source(){
   const [desired,current,studio]=await Promise.all(['desired','current','studio'].map(name=>db.doc('churchVideoLibrary/'+name).get()));
   const base=desired.data()?.videos||current.data()?.videos;
   if(!Array.isArray(base))throw Error('Source library unavailable');
   return mergeStudioVideos(base,studio.data(),{pending:true});
  },
  async publish(request){
   const uid=await requireStudioAdmin(request,deps),{videoId:id,visibility,replaceVideoId:from}=request.data||{};
   if(!valid(id)||!['public','members'].includes(visibility)||(from!==undefined&&(!valid(from)||from===id)))throw new fail('invalid-argument','Enter a valid YouTube link and audience.');
   let title;
   try{const result=await send('https://www.youtube.com/oembed?url='+encodeURIComponent('https://www.youtube.com/watch?v='+id)+'&format=json',{redirect:'error',signal:AbortSignal.timeout(10000)});if(result.ok)title=(await result.json()).title;else await result.body?.cancel();}catch{}
   if(typeof title!=='string'||!title.trim()){
    try{title=(await live.catalog()).find(v=>v.videoId===id)?.title;}catch{}
    if(!title)throw new fail('failed-precondition','YouTube could not confirm this video yet. Check that it is available, then retry.');
   }
   title=title.trim().slice(0,300);
   await db.runTransaction(async tx=>{
    const currentRef=db.doc('churchVideoLibrary/current'),studioRef=db.doc('churchVideoLibrary/studio'),jobRef=db.doc('churchStudioPublications/'+id);
    const [current,studio,job]=await Promise.all([tx.get(currentRef),tx.get(studioRef),tx.get(jobRef)]);
    if(!Array.isArray(current.data()?.videos))throw new fail('unavailable','The current library could not be checked.');
    const entries=studio.data()?.entries||[],existing=current.data().videos.find(v=>v.id===id)||entries.find(e=>e.video.id===id)?.video;
    if(existing&&existing.visibility!==visibility)throw new fail('failed-precondition','This video is already assigned to the other audience.');
    if(existing&&current.data().videos.some(v=>v.id===id))return;
    const old=from?current.data().videos.find(v=>v.id===from):null;
    if(from&&(!old||old.visibility!==visibility))throw new fail('failed-precondition','Choose an existing video with the same audience to replace.');
    if(entries.length>=2000)throw new fail('resource-exhausted','The publishing queue needs attention.');
    if(job.data()?.direct&&entries.some(e=>e.video.id===id))return;
    const aliases=old?[old.id,...(old.replaces||[])]:[];
    const video={id,title,visibility,category:/sunday fellowship/i.test(title)?'Sunday':/prayer meeting/i.test(title)?'Meeting':/bible study/i.test(title)?'Study':'Program',...(old?{replaces:aliases,replacementVisibility:{...(old.replacementVisibility||{}),[old.id]:old.visibility}}:{})};
    const operationId=randomUUID();
    tx.set(studioRef,{...studio.data(),removed:(studio.data()?.removed||[]).filter(r=>r.id!==id),entries:[{video,state:'pending',operationId,createdAt:now(),sourceSeen:false},...entries.filter(e=>e.video.id!==id)]});
    tx.set(jobRef,{direct:true,videoId:id,visibility,title,operationId,requestedBy:uid,requestedAt:now(),state:'pending',...(from?{replaceVideoId:from}:{})});
   });
   try{await promote(id);}catch{/* The readiness poll/helper retries without losing the publication. */}
   return {state:'publishing',videoId:id,visibility};
  },
  async status(request){
   await requireStudioAdmin(request,deps);const {videoId:id,visibility}=request.data||{};
   if(!valid(id)||!['public','members'].includes(visibility))throw new fail('invalid-argument','Invalid publication.');
   const publication=(await db.doc('churchStudioPublications/'+id).get()).data();
   if(publication?.state==='removed')return {state:'removed',message:'This video has been removed from LightCity.'};
   try{await promote(id);}catch{}
   const current=await db.doc('churchVideoLibrary/current').get(),row=current.data()?.videos?.find(v=>v.id===id&&v.visibility===visibility);
   return row?{state:'ready',url:shareVideoUrl(id),title:row.title||'LightCity video'}:{state:'publishing',message:'Video saved. Waiting for its matching live or recorded audio; GitHub is not required.'};
  }
 };
}