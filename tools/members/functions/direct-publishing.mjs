import {listVersion,removeStudioVideo} from './studio-removal.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {requireStudioAdmin} from './studio-publishing.mjs';
import {mergeStudioVideos,shareVideoUrl} from './direct-library.mjs';
const valid=id=>typeof id==='string'&&/^[\w-]{11}$/.test(id);
export function createDirectPublishing(deps) {
 const {db,fail,live,recordings,send=fetch,now=Date.now}=deps;
 async function promote(id,availability) {
  const request=await db.doc('churchStudioPublications/'+id).get(),job=request.data();
  if(!job?.direct||job.state==='removed')return false;
  if(job.state==='ready')return true;
  const sources=availability||{audio:Promise.resolve().then(recordings),feeds:Promise.resolve().then(()=>live.catalog())};
  let recording,feed;
  try{const match=await Promise.any([
   sources.audio.then(rows=>{const recording=rows.find(r=>r.videoId===id&&r.bytes>0&&/^[a-f0-9]{64}$/.test(r.sha256||''));if(!recording)throw Error('Not ready');return {recording};}),
   sources.feeds.then(rows=>{const feed=rows.find(r=>r.videoId===id&&r.active===true&&!r.replay&&r.expiresAt>now());if(!feed)throw Error('Not ready');return {feed};})
  ]);({recording,feed}=match);}catch{return false;}
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
  async listState(){const studio=(await db.doc('churchVideoLibrary/studio').get()).data()||{};const videos=await this.source();return {videos,retryRequests:studio.retryRequests||{},versions:Object.fromEntries(videos.map(v=>[v.id,listVersion(studio,v.id)])),removed:(studio.removed||[]).map(r=>r.id)};},
  async source(){
   const [desired,current,studio]=await Promise.all(['desired','current','studio'].map(name=>db.doc('churchVideoLibrary/'+name).get()));
   const base=desired.data()?.videos||current.data()?.videos;
   if(!Array.isArray(base))throw Error('Source library unavailable');
   return mergeStudioVideos(base,studio.data(),{pending:true});
  },
  async publish(request){return queuePublication(request.data,await requireStudioAdmin(request,deps));},
  async replaceFromHelper(data){
   if(!valid(data?.replaceVideoId)||typeof data.expectedVersion!=='string'||data.expectedVersion.length>100)throw new fail('invalid-argument','A versioned replacement is required.');
   return queuePublication(data,'local-list-helper',data.expectedVersion);
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
 async function queuePublication(data,uid,expectedVersion){
   const {videoId:id,visibility,replaceVideoId:from}=data||{};
   if(!valid(id)||!['public','members'].includes(visibility)||(from!==undefined&&(!valid(from)||from===id)))throw new fail('invalid-argument','Enter a valid YouTube link and audience.');
   const availability={audio:Promise.resolve().then(recordings),feeds:Promise.resolve().then(()=>live.catalog())};
   availability.audio.catch(()=>{});availability.feeds.catch(()=>{});
   let title;
   try{const result=await send('https://www.youtube.com/oembed?url='+encodeURIComponent('https://www.youtube.com/watch?v='+id)+'&format=json',{redirect:'error',signal:AbortSignal.timeout(10000)});if(result.ok)title=(await result.json()).title;else await result.body?.cancel();}catch{}
   if(typeof title!=='string'||!title.trim()){
    try{title=(await availability.feeds).find(v=>v.videoId===id)?.title;}catch{}
    if(!title)throw new fail('failed-precondition','YouTube could not confirm this video yet. Check that it is available, then retry.');
   }
   title=title.trim().slice(0,300);
   await db.runTransaction(async tx=>{
    const currentRef=db.doc('churchVideoLibrary/current'),studioRef=db.doc('churchVideoLibrary/studio'),jobRef=db.doc('churchStudioPublications/'+id);
    const oldJobRef=from?db.doc('churchStudioPublications/'+from):null;
    const [current,studio,job,oldJob]=await Promise.all([tx.get(currentRef),tx.get(studioRef),tx.get(jobRef),oldJobRef?tx.get(oldJobRef):null]);
    if(!Array.isArray(current.data()?.videos))throw new fail('unavailable','The current library could not be checked.');
    let entries=studio.data()?.entries||[];
    let currentVideos=current.data().videos;
    let removed=studio.data()?.removed||[];
    const existing=current.data().videos.find(v=>v.id===id)||entries.find(e=>e.video.id===id)?.video;
    if(existing&&existing.visibility!==visibility)throw new fail('failed-precondition','This video is already assigned to the other audience.');
    if(existing&&current.data().videos.some(v=>v.id===id))return;
    let old=from?currentVideos.find(v=>v.id===from):null;
    if(expectedVersion!==undefined&&expectedVersion!==listVersion(studio.data()||{},from))throw new fail('aborted','The original changed online; recheck the lists.');
    // Explicit recovery is restricted to accidental removals by this same helper.
    if(!old&&data.recoverRemoved===true&&uid==='local-list-helper'){
     const prior=oldJob?.data(),tombstone=removed.find(r=>r.id===from);
     const after=currentVideos.findIndex(v=>v.id===data.afterId),before=currentVideos.findIndex(v=>v.id===data.beforeId);
     if(prior?.state!=='removed'||prior.removedBy!=='local-list-helper'||!tombstone||prior.visibility!==visibility||!prior.title||(after<0&&before<0))throw new fail('failed-precondition','This removal cannot be recovered automatically.');
     old=prior.removedVideo||{id:from,title:prior.title,visibility,category:'Meeting'};
     const index=before>=0?before:after+1;
     currentVideos=[...currentVideos];currentVideos.splice(index,0,old);
     removed=removed.filter(r=>r.id!==from);
     entries=[{video:old,state:'ready',operationId:randomUUID(),createdAt:now(),sourceSeen:false,placement:{index,afterId:currentVideos[index-1]?.id||null,beforeId:currentVideos[index+1]?.id||null}},...entries];
     tx.set(currentRef,{...current.data(),videos:currentVideos,updatedAt:new Date(now())});
     tx.set(oldJobRef,{state:'recovered',backedUp:true},{merge:true});
    }
    if(from&&(!old||old.visibility!==visibility))throw new fail('failed-precondition','Choose an existing video with the same audience to replace.');
    if(entries.length>=2000)throw new fail('resource-exhausted','The publishing queue needs attention.');
    if(job.data()?.direct&&entries.some(e=>e.video.id===id))return;
    const aliases=old?[old.id,...(old.replaces||[])]:[];
    const video={id,title,visibility,category:/sunday fellowship/i.test(title)?'Sunday':/prayer meeting/i.test(title)?'Meeting':/bible study/i.test(title)?'Study':'Program',...(old?{replaces:aliases,replacementVisibility:{...(old.replacementVisibility||{}),[old.id]:old.visibility}}:{})};
    const operationId=randomUUID(),index=old?currentVideos.findIndex(v=>v.id===from):-1;
    const placement=old?{index,afterId:currentVideos[index-1]?.id||null,beforeId:currentVideos[index+1]?.id||null}:null;
    tx.set(studioRef,{...studio.data(),removed:removed.filter(r=>r.id!==id),entries:[{video,state:'pending',operationId,createdAt:now(),sourceSeen:false,...(placement?{placement}:{})},...entries.filter(e=>e.video.id!==id)]});
    tx.set(jobRef,{direct:true,videoId:id,visibility,title,operationId,requestedBy:uid,requestedAt:now(),state:'pending',...(from?{replaceVideoId:from,placement}:{})});
   });
   try{await promote(id,availability);}catch{/* The readiness poll/helper retries without losing the publication. */}
   return {state:'publishing',videoId:id,visibility};
  }

}