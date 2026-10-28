import {readFile,writeFile,mkdir,open,unlink,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const valid=id=>/^[\w-]{11}$/.test(id||'');
const digest=s=>createHash('sha256').update(s).digest('hex');
export function parseLocalIds(text){const ids=text.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);if(ids.some(id=>!valid(id))||new Set(ids).size!==ids.length)throw Error('An ID list is invalid or contains duplicates; local sync left it unchanged.');return ids;}
export async function syncLocalVideoLists(root,remote,{remove,work=join(root,'tools/audio-library/work/studio-sync')}={}){
 if(!Array.isArray(remote.videos)||!remote.videos.length||remote.videos.some(v=>!valid(v.id)||!['public','members'].includes(v.visibility)))throw Error('The online ID list could not be verified.');
 await mkdir(work,{recursive:true});const lockPath=join(work,'sync.lock');let lock;
 try{lock=await open(lockPath,'wx');}catch(error){if(error.code!=='EEXIST')throw error;const age=Date.now()-(await stat(lockPath)).mtimeMs;if(age>1200000){await unlink(lockPath);return {busy:true};}return {busy:true};}
 try{
  const statePath=join(work,'baseline.json');let baseline=null;try{baseline=JSON.parse(await readFile(statePath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw Error('Local list-sync state needs review; no lists were changed.');}
  const audiences=['public','members'],files=Object.fromEntries(audiences.map(a=>[a,join(root,'_includes/video-ids-'+a+'.txt')]));
  const texts=Object.fromEntries(await Promise.all(audiences.map(async a=>[a,await readFile(files[a],'utf8')]))),local=Object.fromEntries(audiences.map(a=>[a,parseLocalIds(texts[a])]));
  const omissions=audiences.flatMap(a=>(baseline?.lists?.[a]||[]).filter(id=>!local[a].includes(id)).map(id=>({id,audience:a})));
  if(omissions.length>25)throw Error('Many IDs were removed at once. Local sync paused; use Studio or restore the list before continuing.');
  let changedOnline=false;
  for(const {id,audience}of omissions){
   const current=remote.videos.find(v=>v.id===id);if(!current||current.visibility!==audience)continue;
   if((baseline.versions?.[id]||'legacy')!==(remote.versions?.[id]||'legacy'))continue; // A re-published video is a new decision.
   if(digest(await readFile(files[audience],'utf8'))!==digest(texts[audience]))throw Error('The ID list changed while syncing. Your newer edits were kept.');
   remote=await remove(id,remote.versions?.[id]||'legacy');changedOnline=true;
   if(!Array.isArray(remote.videos)||remote.videos.some(v=>!valid(v.id)))throw Error('Removal could not be confirmed; local sync will retry.');
  }
  const removed=new Set(remote.removed||[]),next={};
  for(const audience of audiences){
   const online=remote.videos.filter(v=>v.visibility===audience).map(v=>v.id),known=new Set(baseline?.lists?.[audience]||[]),active=new Map(remote.videos.map(v=>[v.id,v.visibility]));
   // Preserve local-only additions and ordering. Only known online removals and explicit tombstones are taken away.
   const extra=local[audience].filter(id=>!known.has(id)&&!removed.has(id)&&!active.has(id));
      const oldOrder=(baseline?.lists?.[audience]||[]).filter(id=>local[audience].includes(id)),editedOrder=local[audience].filter(id=>known.has(id));
   const reordered=baseline&&oldOrder.join(',')!==editedOrder.join(',');
   next[audience]=reordered?[...online.filter(id=>!local[audience].includes(id)),...local[audience].filter(id=>!removed.has(id)&&(!active.has(id)||active.get(id)===audience))]:[...new Set([...extra,...online])];
  }
  // Check BOTH files before writing either, so an editor save cannot be mistaken for an online edit.
  for(const audience of audiences)if(digest(await readFile(files[audience],'utf8'))!==digest(texts[audience]))throw Error('Your ID lists changed during sync. Your edits were kept; syncing will retry.');
  for(const audience of audiences){const content=next[audience].join('\n')+(next[audience].length?'\n':'');if(parseLocalIds(texts[audience]).join('\n')!==next[audience].join('\n'))await writeFile(files[audience],content);}
  // Store the exact mirrored lists before any removal can be inferred on a later pass.
  await writeFile(statePath,JSON.stringify({lists:Object.fromEntries(audiences.map(a=>[a,remote.videos.filter(v=>v.visibility===a).map(v=>v.id)])),versions:remote.versions||{},savedAt:Date.now()}));
  return {synced:true,changedOnline,videos:remote.videos};
 }finally{await lock.close();await unlink(lockPath).catch(()=>{});}
}
export async function runLocalSync(root,{once=false,send=fetch}={}){
 const keys=JSON.parse(await readFile(join(root,'tools/live-audio/work/cloud-secrets.json'),'utf8')),key=keys.LIVE_PLAYBACK_KEY;
 if(!/^[a-f0-9]{64}$/.test(key||''))throw Error('The existing Studio helper connection is unavailable.');
 const request=async body=>{
  const response=await send('https://us-central1-perceptive-zoo-424115-j6.cloudfunctions.net/getStudioHelperLibrary',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok){await response.body?.cancel();throw Error(response.status===409?'The online video changed. Local sync will recheck it.':'Studio list sync is temporarily unavailable.');}return response.json();
 };
 do{
  try{await syncLocalVideoLists(root,await request({}),{remove:(id,expectedVersion)=>request({removeVideoId:id,expectedVersion})});if(once)console.log('Studio and local ID lists synchronized.');}
  catch(error){if(once)throw error;console.warn(error.message);}
  if(!once)await new Promise(resolve=>setTimeout(resolve,15000));
 }while(!once);
}