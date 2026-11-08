import {mergeStudioVideos} from './direct-library.mjs';
const validId = id => /^[\w-]{11}$/.test(id || '');
const origin = 'https://lightcityfellowship.com';
async function loadViewerCounts(ids, key, send) {
 const counts = new Map();
 if (!key || !ids.length) return counts;
 const batches = [];
 for (let i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));
 await Promise.all(batches.map(async batch => {
  try {
   const url = new URL('https://www.googleapis.com/youtube/v3/videos');
   url.search = new URLSearchParams({
    part: 'liveStreamingDetails', id: batch.join(','), key,
    fields: 'items(id,liveStreamingDetails(actualEndTime,concurrentViewers))'
   });
   const response = await send(url, {redirect: 'error', signal: AbortSignal.timeout(5000)});
   if (!response.ok) return;
   const {items} = await response.json();
   for (const item of items || []) {
    const details = item.liveStreamingDetails;
    const value = details?.concurrentViewers;
    if (!batch.includes(item.id) || details?.actualEndTime || typeof value !== 'string' || !/^\d+$/.test(value)) continue;
    const count = Number(value);
    if (Number.isSafeInteger(count)) counts.set(item.id, count);
   }
  } catch {
   // A failed YouTube lookup leaves the count unavailable.
  }
 }));
 return counts;
}

export function createAdminDashboard({ auth, db, fail, emails, audio, live, learning, privateReadings = [], youtubeKey = () => '', send = fetch }) {
 return async request => {
  const uid=request.auth?.uid;
  if(!uid)throw new fail('unauthenticated','Sign in with your admin account.');
  if(request.data?.accountUid&&request.data.accountUid!==uid)throw new fail('permission-denied','The account changed. Sign in again.');
  const user=await auth.getUser(uid),allowed=new Set(String(emails()).split(/[,;\s]+/).map(s=>s.toLowerCase()).filter(Boolean));
  if(user.disabled||!user.emailVerified||!user.providerData?.length||!allowed.has(String(user.email||'').toLowerCase()))throw new fail('permission-denied','This account does not have admin access.');
  const [published,desired,studio]=await Promise.all(['current','desired','studio'].map(name=>db.doc('churchVideoLibrary/'+name).get()));
  if(!published.exists||!Array.isArray(published.data()?.videos))throw new fail('unavailable','The published library is temporarily unavailable.');
  const results=await Promise.allSettled([audio(),live.catalog(),(async()=>{
   const response=await send(origin+'/study-catalog.json',{redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error('Reading catalogue unavailable');const body=await response.json();
   if(!Array.isArray(body.publications))throw Error('Invalid catalogue');return body.publications;
  })()]);
  const checks=Object.fromEntries(['audio','live','readings'].map((key,i)=>[key,results[i].status==='fulfilled']));
  const recordings=new Set(checks.audio?results[0].value.map(r=>r.videoId):[]);
  const broadcasts=new Map(checks.live?results[1].value.filter(r=>r.expiresAt>Date.now()).map(r=>[r.videoId,r]):[]);
  const current=published.data().videos,visible=new Set(current.map(v=>v.id));
  const pending=mergeStudioVideos(desired.data()?.videos||[],studio.data(),{pending:true}).filter(v=>!visible.has(v.id));
  const pendingReplacements=new Map(pending.filter(v=>validId(v.replaces?.[0])).map(v=>[v.replaces[0],v.id]));
  const videos=[...current.map(v=>({...v,published:true})),...pending.map(v=>({...v,published:false}))].filter(v=>validId(v.id)).map(v=>{
   const feed=broadcasts.get(v.id);
   const retryAt=studio.data()?.retryRequests?.[v.id];
   return {id:v.id,title:String(v.title||feed?.title||v.id).slice(0,300),visibility:v.visibility==='public'?'public':'members',published:v.published,
    audio:recordings.has(v.id)||!!feed,live:feed?.active===true&&!feed.replay,replay:feed?.replay===true,replacement:!!v.replaces?.length,
    ...(!v.published&&validId(v.replaces?.[0])?{replaceVideoId:v.replaces[0]}:{}),
    ...(pendingReplacements.has(v.id)?{pendingReplacementId:pendingReplacements.get(v.id)}:{}),
    ...(!v.published&&Number.isFinite(retryAt)&&retryAt>0?{audioRetryRequestedAt:retryAt}:{})};
  });
  const liveVideos = videos.filter(video => video.live);
  if (liveVideos.length) {
   const counts = await loadViewerCounts([...new Set(liveVideos.map(video => video.id))], youtubeKey(), send);
   for (const video of liveVideos) video.concurrentViewers = counts.get(video.id) ?? null;
  }
  const readings=[];
  for(const r of [...(checks.readings?results[2].value:[]),...privateReadings]){
   if(!['Article','Summary'].includes(r.kind)||typeof r.url!=='string')continue;
   try{const url=new URL(r.url,origin);if(url.origin!==origin||/%2f|%5c/i.test(url.pathname))continue;
    readings.push({title:String(r.title||r.kind).slice(0,300),url:url.pathname+url.search+url.hash,kind:r.kind,date:typeof r.date==='string'?r.date.slice(0,10):null,visibility:r.visibility==='members'?'members':'public'});
   }catch{}
  }
  const studyResources=learning?await learning.all():[];
  const learningRows=studyResources.map(({id,kind,title,state,legacyUrl,videoId,legacy,filePublished,fileUrl})=>({resourceId:id,kind,title,state,legacy:legacy===true,published:state==='published',url:(filePublished&&fileUrl)||legacyUrl||'/StudyResource/?id='+encodeURIComponent(id),visibility:videoId?(current.find(v=>v.id===videoId||v.replaces?.includes(videoId))?.visibility||'members'):'public'}));
  return {account:user.email,videos,readings,learning:learningRows,checks,updatedAt:Date.now()};
 };
}
