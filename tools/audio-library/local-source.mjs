import {mkdir,readdir,lstat,realpath,unlink} from 'node:fs/promises';
import {resolve,join,dirname,basename,extname} from 'node:path';
import {ROOT,json,save,normalize,prepare,digest,ensureRemote} from './import.mjs';
const types=new Set(['.mp4','.mkv','.mov','.webm','.m4v','.m4a','.mp3','.wav']);
export const LOCAL_WORK=join(ROOT,'tools/audio-library/work/local-prepared');
export const INPUT=join(ROOT,'Audio Queue');
const same=(a,b)=>process.platform==='win32'?resolve(a).toLowerCase()===resolve(b).toLowerCase():resolve(a)===resolve(b);
export async function queueFiles(input=INPUT){
 const root=await lstat(input);if(!root.isDirectory()||root.isSymbolicLink())throw Error('The Audio Queue must be a normal folder.');
 const files=[];
 for(const e of await readdir(input,{withFileTypes:true}))if(e.isFile()&&types.has(extname(e.name).toLowerCase())){
  const path=join(input,e.name),info=await lstat(path);if(info.isSymbolicLink()||!same(dirname(await realpath(path)),await realpath(input)))continue;
  files.push({path,name:e.name,bytes:info.size,mtime:info.mtimeMs});
 }
 return files;
}
export function selectLocalFile({videoId,title,files,mapping={},eligibleIds=[]}){
 const mapped=mapping[videoId];
 if(mapped){const matches=files.filter(f=>basename(f.path)===mapped);return matches.length===1?{file:matches[0],method:'explicit mapping'}:{reason:'The mapped final video is not in Audio Queue.'};}
 let matches=files.filter(f=>{const stem=basename(f.name,extname(f.name));return stem===videoId||stem.endsWith('['+videoId+']')||stem.endsWith('('+videoId+')');});
 if(matches.length===1)return {file:matches[0],method:'video ID'};if(matches.length>1)return {reason:'Several queue files match this ID. Keep only the final uploaded version.'};
 if(title&&title!==videoId){matches=files.filter(f=>normalize(basename(f.name,extname(f.name)))===normalize(title));if(matches.length===1)return {file:matches[0],method:'exact normalized title'};if(matches.length>1)return {reason:'Several queue files match this title. Keep only the final uploaded version.'};}
 if(files.length===1&&eligibleIds.length===1&&eligibleIds[0]===videoId)return {file:files[0],method:'single final file for single pending video'};
 return {reason:files.length?'Cannot match the final file unambiguously. Include the video ID in its filename.':'Add the final uploaded video to Audio Queue.'};
}
export async function prepareLocal(videoId,{library,state,config,send=fetch,now=Date.now,work=LOCAL_WORK}={}){
 const entry=library.find(v=>v.id===videoId);if(!entry)throw Error('Video is no longer listed.');
 const files=await queueFiles(config.input),eligibleIds=Object.values(state.jobs).filter(j=>j.lane==='urgent'&&!['published','removed'].includes(j.phase)&&!j.record&&library.some(v=>v.id===j.videoId)).map(j=>j.videoId);
 let title=entry.title;
 // Metadata only, never a YouTube media download. Single-file matching works if this lookup is unavailable.
 if(!title||title===videoId){try{const url=new URL('https://www.youtube.com/oembed');url.search=new URLSearchParams({url:'https://www.youtube.com/watch?v='+videoId,format:'json'});const response=await send(url,{redirect:'error',signal:AbortSignal.timeout(10000)});if(response.ok){const metadata=await response.json();if(typeof metadata.title==='string')title=metadata.title.slice(0,300);}else await response.body?.cancel();}catch{}}
 const chosen=selectLocalFile({videoId,title,files,mapping:config.mapping,eligibleIds});
 if(!chosen.file)return [{status:'waiting for replay',reason:chosen.reason}];
 if(chosen.file.bytes<=0||now()-chosen.file.mtime<60000)return [{status:'waiting for replay',reason:'Waiting for the final file to finish copying or saving.'}];
 const folder=join(work,videoId);await mkdir(folder,{recursive:true});
 await save(join(folder,'plan.json'),{records:[{id:videoId,source:chosen.file.path,title,visibility:entry.visibility,status:'ready'}]});
 const prepared=await prepare(folder,{limit:1,id:videoId}),item=prepared[videoId];
 if(!item?.sha256||item.sourceBytes!==chosen.file.bytes||item.sourceMtime!==chosen.file.mtime)throw Error('Local audio preparation did not finish or the source changed.');
 const current=await lstat(item.source);if(current.size!==item.sourceBytes||current.mtimeMs!==item.sourceMtime)throw Error('Source changed during preparation; it was kept.');
 return [{videoId,title:title||basename(item.source),file:item.output,bytes:item.bytes,sha256:item.sha256,audioDurationSeconds:item.durationSeconds,status:'local audio verified',sourceMode:'local',source:item.source,sourceBytes:item.sourceBytes,sourceMtime:item.sourceMtime,sourceHash:item.sourceHash,matchMethod:chosen.method,input:config.input,deleteSourceAfterUpload:config.deleteSourceAfterUpload===true}];
}
function outputPath(record,work=LOCAL_WORK){
 if(!/^[\w-]{11}$/.test(record.videoId||'')||record.sourceMode!=='local')throw Error('Invalid local recording.');
 const expected=join(work,record.videoId,'audio',record.videoId+'.m4a');if(!same(record.file,expected))throw Error('Unexpected generated local audio path.');return expected;
}
export async function uploadLocal(record,connection,{work=LOCAL_WORK}={}){
 const output=outputPath(record,work),item={...record,output};
 const bounded={sdk:connection.sdk,s3:{send:command=>connection.s3.send(command,{abortSignal:AbortSignal.timeout(15*60000)})}};
 if(!await ensureRemote(item,bounded,false)){
  const info=await lstat(output);if(!info.isFile()||info.isSymbolicLink()||!same(await realpath(output),output)||info.size!==record.bytes||await digest(output)!==record.sha256)throw Error('Generated audio changed; keeping source for review.');
  await ensureRemote(item,bounded);
 }
 record.remoteVerified=true;
}
export async function cleanLocal(record,{input=INPUT,work=LOCAL_WORK}={}){
 const output=outputPath(record,work);
 if(record.remoteVerified!==true||record.registrationVerified!==true)throw Error('Audio must be verified remotely and registered before cleanup.');
 const rootInfo=await lstat(input);if(!rootInfo.isDirectory()||rootInfo.isSymbolicLink()||!same(record.input,input)||!same(dirname(record.source),input))throw Error('Source is outside the dedicated Audio Queue. Nothing deleted.');
 const source=await lstat(record.source).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 const generated=await lstat(output).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 if(source&&(!source.isFile()||source.isSymbolicLink()||!same(dirname(await realpath(record.source)),await realpath(input))||source.size!==record.sourceBytes||source.mtimeMs!==record.sourceMtime||await digest(record.source)!==record.sourceHash))throw Error('Queued video changed after preparation; it was kept.');
 if(generated&&(!generated.isFile()||generated.isSymbolicLink()||!same(await realpath(output),output)||generated.size!==record.bytes||await digest(output)!==record.sha256))throw Error('Generated audio changed; queue files were kept.');
 // Delete only the selected, unchanged file, never the folder or other videos.
 if(source&&record.deleteSourceAfterUpload)await unlink(record.source);
 if(generated)await unlink(output);
}