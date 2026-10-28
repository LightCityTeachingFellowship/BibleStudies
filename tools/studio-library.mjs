import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
let cached=null,pending=null;
export async function processingLibrary(root,local,send=fetch){
 const base=await local();
 if(cached&&Date.now()-cached.at<15000)return cached.videos;
 if(pending)return pending;
 pending=(async()=>{
  const keys=JSON.parse(await readFile(join(root,'tools/live-audio/work/cloud-secrets.json'),'utf8'));
  const key=keys.LIVE_PLAYBACK_KEY;if(!/^[a-f0-9]{64}$/.test(key||''))throw Error('The existing helper connection is unavailable.');
  const response=await send('https://us-central1-perceptive-zoo-424115-j6.cloudfunctions.net/getStudioHelperLibrary',{method:'POST',headers:{Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(12000)});
  // Keep the established local workflow until the Studio service is first deployed.
  if(response.status===404){await response.body?.cancel();if(cached)throw Error('Studio source temporarily unavailable.');return base;}
  if(!response.ok){await response.body?.cancel();throw Error('Studio source temporarily unavailable.');}
  const body=await response.json(),seen=new Set();
  if(!Array.isArray(body.videos)||!body.videos.length||body.videos.length>20000)throw Error('Invalid Studio source.');
  const titles=new Map(base.map(v=>[v.id,v]));
  const videos=body.videos.map(v=>{if(!/^[\w-]{11}$/.test(v.id||'')||!['public','members'].includes(v.visibility)||seen.has(v.id))throw Error('Invalid Studio source.');seen.add(v.id);return {...titles.get(v.id),id:v.id,title:typeof v.title==='string'&&v.title.trim()?v.title.trim().slice(0,300):titles.get(v.id)?.title||v.id,visibility:v.visibility,studioSelected:v.studioSelected===true};});
  cached={at:Date.now(),videos};return videos;
 })();
 try{return await pending;}finally{pending=null;}
}
export async function requestAudioPublication(root,videoId,send=fetch){
 if(!/^[\w-]{11}$/.test(videoId||''))throw Error('Invalid publication video');
 const keys=JSON.parse(await readFile(join(root,'tools/live-audio/work/cloud-secrets.json'),'utf8'));
 const response=await send('https://us-central1-perceptive-zoo-424115-j6.cloudfunctions.net/getStudioHelperLibrary',{method:'POST',headers:{Authorization:'Bearer '+keys.LIVE_PLAYBACK_KEY,'Content-Type':'application/json'},body:JSON.stringify({publishReady:videoId}),redirect:'error',signal:AbortSignal.timeout(45000)});
 if(!response.ok){await response.body?.cancel();throw Error('The automatic publishing check will be retried.');}
 const data=await response.json();return {requested:data.requested===true,published:data.published===true,message:typeof data.message==='string'?data.message:undefined};
}