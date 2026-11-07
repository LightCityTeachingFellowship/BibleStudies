import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {spawn} from 'node:child_process';
export function createLearningMedia(sign){return async recording=>{
 const dir=await mkdtemp(join(tmpdir(),'lightcity-learning-')),cleanup=()=>rm(dir,{recursive:true,force:true});
 try{
  const {url}=await sign(recording.objectKey),response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Audio unavailable');
  let bytes=0;const cap=new Transform({transform(chunk,encoding,done){bytes+=chunk.length;done(bytes>500*1024**2?Error('Audio too large'):null,chunk);}});
  await pipeline(response.body,cap,createWriteStream(join(dir,'source.m4a')));
  const {default:ffmpeg}=await import('ffmpeg-static');
  await new Promise((resolve,reject)=>{const child=spawn(ffmpeg,['-nostdin','-v','error','-i',join(dir,'source.m4a'),'-vn','-ac','1','-ar','16000','-b:a','48k','-f','segment','-segment_time','900','-reset_timestamps','1',join(dir,'part-%03d.mp3')],{windowsHide:true,stdio:'ignore'}),timer=setTimeout(()=>{child.kill();reject(Error('Audio preparation timed out'));},180000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Could not prepare audio'));});});
  const names=(await readdir(dir)).filter(n=>/^part-\d+\.mp3$/.test(n)).sort();if(!names.length||names.length>25)throw Error('Invalid audio parts');
  return {cleanup,files:names.map((name,i)=>({seconds:Math.max(1,Math.min(900,recording.durationSeconds-i*900)),read:()=>readFile(join(dir,name))}))};
 }catch(error){await cleanup();throw error;}
};}
