import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,lstat,rm,utimes,appendFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';import {execFileSync} from 'node:child_process';
import {selectLocalFile,prepareLocal,cleanLocal} from './local-source.mjs';
import {ROOT,digest} from './import.mjs';import {tick} from './automatic.mjs';
const id='abcdefghijk',other='ABCDEFGHIJK';
const files=[{path:'/queue/Prayer.mp4',name:'Prayer.mp4'},{path:'/queue/Other.mp4',name:'Other.mp4'}];
assert.equal(selectLocalFile({videoId:id,title:'Prayer',files}).file,files[0]);
assert.ok(selectLocalFile({videoId:id,files,eligibleIds:[id]}).reason);
assert.equal(selectLocalFile({videoId:id,files:files.slice(0,1),eligibleIds:[id]}).file,files[0]);
assert.ok(selectLocalFile({videoId:id,files:files.slice(0,1),eligibleIds:[id,other]}).reason);
const root=await mkdtemp(join(ROOT,'tools/audio-library/work/lc-local-source-test-')),input=join(root,'Audio Queue'),work=join(root,'work'),path=join(input,'Prayer.mp4');
try{
 await mkdir(input);const ffmpeg=join(ROOT,'tools/audio-pilot/runtime/ffmpeg.exe');
 execFileSync(ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=black:s=160x90:d=2','-f','lavfi','-i','sine=frequency=440:duration=2','-c:v','mpeg4','-c:a','aac','-b:a','128k','-shortest',path],{windowsHide:true});
 await utimes(path,new Date(Date.now()-120000),new Date(Date.now()-120000));
 const library=[{id,title:'Prayer',visibility:'members'}],state={jobs:{[id]:{videoId:id,lane:'urgent',phase:'pending'}}},config={input,deleteSourceAfterUpload:true};
 const [record]=await prepareLocal(id,{library,state,config,work});
 assert.equal(record.sourceMode,'local');assert.equal(record.sourceHash,await digest(path));assert.ok(record.audioDurationSeconds>1);
 const before=await lstat(path);await assert.rejects(cleanLocal(record,{input,work}),/verified remotely/);assert.equal((await lstat(path)).size,before.size);
 record.remoteVerified=true;record.registrationVerified=true;
 const outside={...record,source:join(root,'outside.mp4')};await writeFile(outside.source,'keep');await assert.rejects(cleanLocal(outside,{input,work}),/outside/);assert.equal(await readFile(outside.source,'utf8'),'keep');
 await cleanLocal(record,{input,work});await assert.rejects(lstat(path),e=>e.code==='ENOENT');await assert.rejects(lstat(record.file),e=>e.code==='ENOENT');await cleanLocal(record,{input,work});
 // A changed queued source must survive cleanup, even after remote registration.
 await writeFile(path,'changed');await assert.rejects(cleanLocal(record,{input,work}),/changed/);assert.equal(await readFile(path,'utf8'),'changed');
}finally{if(!resolve(root).startsWith(resolve(join(ROOT,'tools/audio-library/work'))+sep))throw Error('Unexpected temporary path');await rm(root,{recursive:true,force:true});}
const state={version:1,sourceMode:'local',seenIds:[],jobs:{},youtubeDownloadStarts:[1,2],youtubeNotBefore:99999999,dailyDownloadLimit:2};let prepared=0,cleaned=0;
await tick({state,library:async()=>[{id,title:'Prayer'}],catalog:[],now:()=>1000,download:async()=>{prepared++;return[{videoId:id,status:'local audio verified',sourceMode:'local'}];},remote:async r=>{r.remoteVerified=true;},register:async()=>{},cleanup:async r=>{assert.equal(r.registrationVerified,true);assert.equal(r.remoteVerified,true);cleaned++;}});
assert.equal(prepared,1);assert.equal(cleaned,1);assert.deepEqual(state.youtubeDownloadStarts,[1,2],'local extraction never consumes or resets YouTube attempts');
assert.equal(state.jobs[id].phase,'published');
console.log('PASS: local matching/ambiguity, actual AAC extraction, original preservation until verification, bounded automatic deletion, idempotent cleanup, changed/outside source protection and no YouTube cooldown in local mode.');