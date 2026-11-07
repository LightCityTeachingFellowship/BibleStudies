import {readFile,writeFile,mkdir,open,unlink,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {startHelperHeartbeat} from './helper-heartbeat.mjs';
const valid=id=>/^[\w-]{11}$/.test(id||'');
const digest=s=>createHash('sha256').update(s).digest('hex');
const retiredAliases=videos=>{const active=new Set(videos.map(v=>v.id));return new Set(videos.flatMap(v=>Array.isArray(v.replaces)?v.replaces:[]).filter(id=>valid(id)&&!active.has(id)));};
export function parseLocalIds(text){const ids=text.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);if(ids.some(id=>!valid(id))||new Set(ids).size!==ids.length)throw Error('An ID list is invalid or contains duplicates; local sync left it unchanged.');return ids;}
export async function syncLocalVideoLists(root,remote,{remove,replace,now=Date.now,removalDelayMs=60000,work=join(root,'tools/audio-library/work/studio-sync')}={}){
 if(!Array.isArray(remote.videos)||!remote.videos.length||remote.videos.some(v=>!valid(v.id)||!['public','members'].includes(v.visibility)))throw Error('The online ID list could not be verified.');
 await mkdir(work,{recursive:true});const lockPath=join(work,'sync.lock');let lock;
 try{lock=await open(lockPath,'wx');}catch(error){if(error.code!=='EEXIST')throw error;const age=Date.now()-(await stat(lockPath)).mtimeMs;if(age>1200000){await unlink(lockPath);return {busy:true};}return {busy:true};}
 try{
  const statePath=join(work,'baseline.json');let baseline=null;try{baseline=JSON.parse(await readFile(statePath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw Error('Local list-sync state needs review; no lists were changed.');}
  const audiences=['public','members'],files=Object.fromEntries(audiences.map(a=>[a,join(root,'_includes/video-ids-'+a+'.txt')]));
  const texts=Object.fromEntries(await Promise.all(audiences.map(async a=>[a,await readFile(files[a],'utf8')]))),local=Object.fromEntries(audiences.map(a=>[a,parseLocalIds(texts[a])]));
  const knownRetired=retiredAliases(remote.videos);
  const omissions=audiences.flatMap(a=>(baseline?.lists?.[a]||[]).filter(id=>!local[a].includes(id))
   // An old checkout can restore an alias instead of its replacement. Mirror
   // the canonical ID in this case rather than deleting the replacement online.
   .filter(id=>!remote.videos.some(v=>v.id===id&&v.visibility===a&&(Array.isArray(v.replaces)?v.replaces:[]).some(alias=>knownRetired.has(alias)&&local[a].includes(alias))))
   .map(id=>({id,audience:a})));
  if(omissions.length>25)throw Error('Many IDs were removed at once. Local sync paused; use Studio or restore the list before continuing.');
  let changedOnline=false;
  const pendingRemovals={};
  // Resolve replacement intent before any deletion. A missing old ID and a new
  // ID in the same saved list are one operation, never two independent edits.
  for(const audience of audiences){
   const known=new Set(baseline?.lists?.[audience]||[]);
   const missing=omissions.filter(v=>v.audience===audience&&remote.videos.some(r=>r.id===v.id&&r.visibility===audience));
   const previousLocal=new Set(baseline?.localLists?.[audience]||baseline?.lists?.[audience]||[]);
   const retired=retiredAliases(remote.videos);
   const added=local[audience].filter(id=>!previousLocal.has(id)&&!remote.videos.some(v=>v.id===id)&&!(remote.removed||[]).includes(id)&&!retired.has(id));
   if(missing.length&&added.length){
    if(missing.length!==1||added.length!==1||!replace)throw Error('A replacement needs a single old and new ID. No videos were removed; list sync will retry.');
    const old=missing[0].id,version=remote.versions?.[old]||'legacy';
    if((baseline.versions?.[old]||'legacy')!==version)throw Error('The original changed online. Your replacement was kept for review.');
    if(digest(await readFile(files[audience],'utf8'))!==digest(texts[audience]))throw Error('The ID list changed while syncing. Your newer edits were kept.');
    remote=await replace({videoId:added[0],replaceVideoId:old,visibility:audience,expectedVersion:version});
    if(!remote.videos?.some(v=>v.id===added[0]&&(v.replaces||[]).includes(old)))throw Error('Replacement was not confirmed. Both local IDs were kept unchanged.');
    changedOnline=true;
   }
  }
  for(const {id,audience}of omissions){
   const current=remote.videos.find(v=>v.id===id);if(!current||current.visibility!==audience)continue;
   const version=remote.versions?.[id]||'legacy';
   if((baseline.versions?.[id]||'legacy')!==version)continue;
   const previous=baseline.pendingRemovals?.[id];
   const since=previous?.version===version&&previous?.textHash===digest(texts[audience])?previous.since:now();
   pendingRemovals[id]={since,version,textHash:digest(texts[audience])};
   // An editor save, pull or checkout can briefly omit an ID. Never turn the
   // first observation into a destructive online action.
   if(now()-since<removalDelayMs)continue;
   if(digest(await readFile(files[audience],'utf8'))!==digest(texts[audience]))throw Error('The ID list changed while syncing. Your newer edits were kept.');
   remote=await remove(id,version);changedOnline=true;delete pendingRemovals[id];
   if(!Array.isArray(remote.videos)||remote.videos.some(v=>!valid(v.id)))throw Error('Removal could not be confirmed; local sync will retry.');
  }
  // Completed replacements retire their old IDs without representing a new
  // removal request. Do not reinsert those aliases as unpublished local additions.
  const removed=new Set(remote.removed||[]),retired=retiredAliases(remote.videos),next={};
  for(const audience of audiences){
   const online=remote.videos.filter(v=>v.visibility===audience).map(v=>v.id),active=new Map(remote.videos.map(v=>[v.id,v.visibility]));
   const canonical=new Map(remote.videos.filter(v=>v.visibility===audience).flatMap(v=>(Array.isArray(v.replaces)?v.replaces:[]).filter(id=>retired.has(id)).map(id=>[id,v.id])));
   // Preserve neighbour positions when a stale local alias stands in for the
   // replacement; simply dropping it would move local-only IDs across that slot.
   const kept=[...new Set(local[audience].map(id=>retired.has(id)?canonical.get(id):id).filter(id=>id&&!removed.has(id)&&(!active.has(id)||active.get(id)===audience)))];
   const known=new Set(baseline?.lists?.[audience]||[]);
   const oldOrder=(baseline?.lists?.[audience]||[]).filter(id=>kept.includes(id)),editedOrder=kept.filter(id=>known.has(id));
   const reordered=baseline&&oldOrder.join(',')!==editedOrder.join(',');
   const result=reordered?[...online.filter(id=>!kept.includes(id)),...kept]:online.filter(id=>!pendingRemovals[id]);
   // Insert local additions beside their neighbours, rather than prepending
   // every local-only ID and moving older replacements ahead of newer videos.
   for(let i=0;i<kept.length;i++){
    const id=kept[i];if(result.includes(id))continue;
    const before=kept.slice(i+1).find(v=>result.includes(v));
    const after=kept.slice(0,i).reverse().find(v=>result.includes(v));
    const index=before?result.indexOf(before):after?result.indexOf(after)+1:0;
    result.splice(index,0,id);
   }
   next[audience]=[...new Set(result)];
  }
  // Check BOTH files before writing either, so an editor save cannot be mistaken for an online edit.
  for(const audience of audiences)if(digest(await readFile(files[audience],'utf8'))!==digest(texts[audience]))throw Error('Your ID lists changed during sync. Your edits were kept; syncing will retry.');
  for(const audience of audiences){const content=next[audience].join('\n')+(next[audience].length?'\n':'');if(parseLocalIds(texts[audience]).join('\n')!==next[audience].join('\n'))await writeFile(files[audience],content);}
  // Store the exact mirrored lists before any removal can be inferred on a later pass.
  await writeFile(statePath,JSON.stringify({lists:Object.fromEntries(audiences.map(a=>[a,remote.videos.filter(v=>v.visibility===a).map(v=>v.id)])),versions:remote.versions||{},localLists:next,pendingRemovals,savedAt:now()}));
  return {synced:true,changedOnline,videos:remote.videos};
 }finally{await lock.close();await unlink(lockPath).catch(()=>{});}
}
export async function runLocalSync(root,{once=false,send=fetch}={}){
 const keys=JSON.parse(await readFile(join(root,'tools/live-audio/work/cloud-secrets.json'),'utf8')),key=keys.LIVE_PLAYBACK_KEY;
 if(!/^[a-f0-9]{64}$/.test(key||''))throw Error('The existing Studio helper connection is unavailable.');
 const request=async body=>{
  const response=await send('https://us-central1-perceptive-zoo-424115-j6.cloudfunctions.net/getStudioHelperLibrary',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({...body,syncProtocol:2}),redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok){await response.body?.cancel();throw Error(response.status===409?'The online video changed. Local sync will recheck it.':'Studio list sync is temporarily unavailable.');}return response.json();
 };
 let phase='checking',lastSuccessAt=null;
 const heartbeat=once?null:startHelperHeartbeat(join(root,'tools/audio-library/work/studio-sync'),{name:'Studio ID lists',details:()=>({phase,lastSuccessAt})});
 try{do{
  try{let disabled=false;try{disabled=JSON.parse(await readFile(join(root,'tools/audio-library/work/studio-sync/supervisor-disabled.json'),'utf8')).disabled===true;}catch(error){if(error.code!=='ENOENT')throw error;}if(disabled)break;const result=await syncLocalVideoLists(root,await request({}),{remove:(id,expectedVersion)=>request({removeVideoId:id,expectedVersion}),replace:data=>request({replaceVideo:data})});phase=result.busy?'waiting-for-list-lock':'watching';if(result.synced)lastSuccessAt=Date.now();if(once)console.log(result.busy?'Another list synchronization is still finishing.':'Studio and local ID lists synchronized.');}
  catch(error){phase='retrying';if(once)throw error;console.warn(error.message);}
  if(!once)await new Promise(resolve=>setTimeout(resolve,15000));
 }while(!once);}finally{await heartbeat?.stop();}
}
