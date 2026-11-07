import {randomUUID} from 'node:crypto';
import {requireStudioAdmin} from './studio-publishing.mjs';
import {canonicalVideo} from './learning-core.mjs';
export function createVideoPrivacy(deps){const {db,fail,now=Date.now}=deps;return async request=>{
 const uid=await requireStudioAdmin(request,deps),{videoId,visibility,expectedVisibility}=request.data||{};
 if(!/^[\w-]{11}$/.test(videoId||'')||!['public','members'].includes(visibility)||!['public','members'].includes(expectedVisibility))throw new fail('invalid-argument','Choose a video and its audience.');
 return db.runTransaction(async tx=>{
  const refs=['current','desired','studio'].map(name=>db.doc('churchVideoLibrary/'+name)),snapshots=await Promise.all(refs.map(r=>tx.get(r)));
  const [current,desired,studio]=snapshots.map(s=>s.data()||{}),video=canonicalVideo(current.videos||[],videoId);
  if(!video)throw new fail('not-found','This video is no longer published.');
  if(video.visibility!==expectedVisibility)throw new fail('aborted','The audience changed. Refresh Studio before changing it again.');
  if(video.visibility===visibility)return {videoId:video.id,visibility};
  const ids=new Set([video.id,...(video.replaces||[])]),version=randomUUID();
  const update=row=>row.id===video.id?{...row,visibility,replacementVisibility:Object.fromEntries((row.replaces||[]).map(id=>[id,visibility]))}:row;
  tx.set(refs[0],{...current,videos:current.videos.map(update),updatedAt:new Date(now())});
  if(snapshots[1].exists)tx.set(refs[1],{...desired,videos:(desired.videos||[]).map(update)});
  tx.set(refs[2],{...studio,privacy:{...studio.privacy,[video.id]:{visibility,updatedAt:now(),updatedBy:uid}},entries:(studio.entries||[]).map(e=>ids.has(e.video.id)?{...e,video:update(e.video),operationId:version}:e)});
  // A privacy edit is silent and does not change the publication/notification state.
  tx.set(db.doc('churchStudioPublications/'+video.id),{visibility,operationId:version},{merge:true});
  return {videoId:video.id,visibility};
 });
};}
