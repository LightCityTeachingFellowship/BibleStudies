import {mergeStudioVideos} from './direct-library.mjs';
const validId = id => /^[\w-]{11}$/.test(id || '');
const origin = 'https://lightcityfellowship.com';
export function createAdminDashboard({ auth, db, fail, emails, audio, live, privateReadings = [], send = fetch }) {
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
  const videos=[...current.map(v=>({...v,published:true})),...pending.map(v=>({...v,published:false}))].filter(v=>validId(v.id)).map(v=>{
   const feed=broadcasts.get(v.id);
   return {id:v.id,title:String(v.title||feed?.title||v.id).slice(0,300),visibility:v.visibility==='public'?'public':'members',published:v.published,
    audio:recordings.has(v.id)||!!feed,live:feed?.active===true&&!feed.replay,replay:feed?.replay===true,replacement:!!v.replaces?.length};
  });
  const readings=[];
  for(const r of [...(checks.readings?results[2].value:[]),...privateReadings]){
   if(!['Article','Summary'].includes(r.kind)||typeof r.url!=='string')continue;
   try{const url=new URL(r.url,origin);if(url.origin!==origin||/%2f|%5c/i.test(url.pathname))continue;
    readings.push({title:String(r.title||r.kind).slice(0,300),url:url.pathname+url.search+url.hash,kind:r.kind,date:typeof r.date==='string'?r.date.slice(0,10):null,visibility:r.visibility==='members'?'members':'public'});
   }catch{}
  }
  return {account:user.email,videos,readings,checks,updatedAt:Date.now()};
 };
}
