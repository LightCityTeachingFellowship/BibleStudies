import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {startHelperHeartbeat} from './helper-heartbeat.mjs';
const directory=await mkdtemp(join(tmpdir(),'lightcity-heartbeat-'));
let heartbeat;
const read=async()=>{for(let i=0;i<20;i++)try{return JSON.parse(await readFile(join(directory,'process-status.json'),'utf8'));}catch{await new Promise(r=>setTimeout(r,10));}throw Error('Heartbeat was not written');};
try{
 let phase='working';heartbeat=startHelperHeartbeat(directory,{name:'Test helper',interval:15,details:()=>({phase})});
 const before=await read();assert.equal(before.pid,process.pid);assert.equal(before.state,'running');
 phase='retrying';await new Promise(r=>setTimeout(r,70));const after=await read();assert.ok(after.updatedAt>before.updatedAt);assert.equal(after.phase,'retrying');
 await heartbeat.stop();const stopped=await read();assert.equal(stopped.state,'stopped');await new Promise(r=>setTimeout(r,40));assert.deepEqual(await read(),stopped);
 console.log('PASS: current heartbeat during work/retry, real PID, graceful stop and no lingering interval.');
}finally{await heartbeat?.stop();if(!resolve(directory).startsWith(resolve(tmpdir())+sep))throw Error('Unexpected test directory');await rm(directory,{recursive:true,force:true});}
