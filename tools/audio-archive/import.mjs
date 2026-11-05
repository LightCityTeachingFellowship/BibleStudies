import {readdir,stat,mkdir,open,unlink} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,relative,resolve} from 'node:path';
import {ROOT,client,probe,digest,save} from '../audio-library/import.mjs';
const source=resolve(process.argv[2]||''),work=join(ROOT,'tools/audio-library/work/message-archive');
const Bucket='lightcity-audio',catalogKey='archive/catalog.json';
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())out.push(...await walk(path));else if(e.isFile()&&/\.mp3$/i.test(e.name))out.push(path);}return out;}
await mkdir(work,{recursive:true});const lock=join(work,'import.lock');
let handle;try{handle=await open(lock,'wx');await handle.writeFile(String(process.pid));}catch{throw Error('An archive import is already running. Check its status before restarting.');}
let s3, currentTitle = null;
const activityPath = join(work, 'activity.json');
const recordActivity = (state, message) => save(activityPath, {
 pid: process.pid, state, title: currentTitle, message,
});
try{
 await recordActivity('running');
 const remote=await client();s3=remote.s3;const {sdk}=remote;
 const get=async()=>{try{const result=await s3.send(new sdk.GetObjectCommand({Bucket,Key:catalogKey}));return JSON.parse(await result.Body.transformToString());}catch(e){if(e.$metadata?.httpStatusCode===404)return {version:1,recordings:[]};throw e;}};
 const catalog=await get();if(!Array.isArray(catalog.recordings))throw Error('Archive catalogue is invalid');
 const files=(await walk(source)).sort((a,b)=>a.localeCompare(b));
 await save(join(work,'inventory.json'),files.map(path=>({path,relative:relative(source,path)})));
 console.log(`Found ${files.length} MP3 files. Originals will be preserved.`);
 const statusPath=join(work,'status.json');
 let completed=0, lastTitle=null;
 const recordProgress=()=>save(statusPath,{completed,total:files.length,lastTitle,updatedAt:new Date().toISOString()});
 for(const path of files){
  const rel=relative(source,path).replaceAll('\\','/'),id=createHash('sha256').update(rel).digest('hex').slice(0,32),Key=`archive/${id}.mp3`;
  const before=await stat(path),existing=catalog.recordings.find(r=>r.id===id);
  if(existing?.sha256&&existing.bytes===before.size){const verified=await s3.send(new sdk.HeadObjectCommand({Bucket,Key}));if(verified.Metadata?.sha256===existing.sha256&&Number(verified.ContentLength)===before.size){completed++;lastTitle=existing.title;continue;}}
  currentTitle = rel.split('/').at(-1).replace(/\.mp3$/i, '');
  await recordActivity('running');
  const info=await probe(path),stream=info.streams?.find(s=>s.codec_type==='audio'),durationSeconds=Number(info.format?.duration);
  if(!stream||!Number.isFinite(durationSeconds)||durationSeconds<=0)throw Error(`Unusable audio: ${rel}`);
  const parts=rel.split('/'),filename=parts.at(-1).replace(/\.mp3$/i,''),title=filename.replace(/\s*\(\(?LightCity\)?\)\s*/gi,' ').trim()||filename;
  const year=parts.slice(0,-1).find(x=>/^(19|20)\d{2}$/.test(x))||'';
  const sha256=await digest(path);let head;
  try{head=await s3.send(new sdk.HeadObjectCommand({Bucket,Key}));}catch(e){if(e.$metadata?.httpStatusCode!==404)throw e;}
  if(head&&(head.Metadata?.sha256!==sha256||Number(head.ContentLength)!==before.size))throw Error(`Existing archive object differs: ${rel}`);
  if(!head){console.log(`Uploading ${completed+1}/${files.length}: ${title}`);
   await s3.send(new sdk.PutObjectCommand({Bucket,Key,Body:createReadStream(path),ContentLength:before.size,ContentType:'audio/mpeg',Metadata:{sha256}}));
   head=await s3.send(new sdk.HeadObjectCommand({Bucket,Key}));
  }
  const after=await stat(path);if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||Number(head.ContentLength)!==before.size||head.Metadata?.sha256!==sha256)throw Error(`Verification failed: ${rel}`);
  const entry={id,title,group:parts[0],year,series:parts.slice(1,-1).filter(x=>x!==year).join(' / '),durationSeconds,bytes:before.size,sha256};
  const latest=await get();latest.recordings=latest.recordings.filter(r=>r.id!==id);latest.recordings.push(entry);
  latest.recordings.sort((a,b)=>String(b.year).localeCompare(String(a.year))||a.title.localeCompare(b.title));
  await s3.send(new sdk.PutObjectCommand({Bucket,Key:catalogKey,Body:JSON.stringify(latest),ContentType:'application/json',CacheControl:'no-cache'}));
  catalog.recordings=latest.recordings;completed++;lastTitle=title;await recordProgress();
  console.log(`Published ${completed}/${files.length}: ${title}`);
 }
 await recordProgress();
 currentTitle = null;
 await recordActivity('complete');
 console.log('Archive import complete. All original files preserved.');
}catch(error){
 const message = /unusable audio|media processing failed/i.test(error.message)
  ? 'The recording could not be read as audio. Check that the file opens and is available locally.'
  : 'The import was interrupted. Check the connection and local files, then retry.';
 await recordActivity('failed', message).catch(() => {});
 console.error('Archive import paused: '+error.message);
 process.exitCode=1;
}finally{s3?.destroy();await handle.close();await unlink(lock);}
