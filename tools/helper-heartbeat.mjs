import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export function startHelperHeartbeat(work,{name,details=()=>({}),interval=10000}={}){
 let stopped=false,flight=Promise.resolve();
 const write=state=>{flight=flight.catch(()=>{}).then(async()=>{await mkdir(work,{recursive:true});await writeFile(join(work,'process-status.json'),JSON.stringify({name,pid:process.pid,state,updatedAt:Date.now(),...details()})+'\n');}).catch(()=>{});return flight;};
 void write('running');const timer=setInterval(()=>void write('running'),interval);timer.unref?.();
 return {async stop(){if(stopped)return;stopped=true;clearInterval(timer);await write('stopped');}};
}
