import assert from 'node:assert/strict';
import {createNotificationCenter} from './members/functions/notification-center.mjs';
class Fail extends Error{constructor(code,message){super(message);this.code=code}}
const data=new Map(),sends=[];let clock=Date.parse('2026-11-28T07:59:00Z');
const ref=path=>({id:path.split('/').at(-1),async get(){const v=data.get(path);return {exists:v!==undefined,data:()=>v}},async set(v,opt){data.set(path,{...(opt?.merge?data.get(path):{}),...v})}});
const db={doc:ref,collection(path){return {limit(){return this},where(){return this},async get(){return {docs:[...data.entries()].filter(([key,row])=>key.startsWith(path+'/')&&(!path.endsWith('/schedules')||row.enabled)).map(([key])=>({id:key.split('/').at(-1),ref:ref(key),data:()=>data.get(key)}))}}}},async getAll(...refs){return Promise.all(refs.map(r=>r.get()))},async runTransaction(fn){return fn({get:r=>r.get(),create:(r,v)=>data.set('churchStudioPublications/notification-center/custom/'+r.id,v)})}};
const auth={getUser:async uid=>({uid,email:'admin@example.com',emailVerified:true,disabled:false,providerData:[{}]})};
const messaging={sendEachForMulticast:async payload=>{sends.push(payload);return {successCount:payload.tokens.length,failureCount:0,responses:payload.tokens.map(()=>({success:true}))}}};
const service=createNotificationCenter({db,auth,messaging,fail:Fail,emails:()=> 'admin@example.com',now:()=>clock});
const call=data=>service.manage({auth:{uid:'admin'},data});
data.set('webPushSubscribers/test',{token:'device'});
const result=await call({action:'createSchedule',audience:'public',title:'Hello',body:'Message',url:'https://lightcityfellowship.com/',schedule:{frequency:'daily',startDate:'2026-11-28',time:'09:00',endDate:'2026-11-30'}});
assert.equal((await call({action:'listSchedules'})).schedules.length,1);
clock+=60000;await service.runSchedules();await service.runSchedules();assert.equal(sends.length,1,'repeated scheduler runs cannot duplicate delivery');
await call({action:'stopSchedule',id:result.id});clock+=86400000;await service.runSchedules();assert.equal(sends.length,1,'stopped schedules do not send');
await assert.rejects(call({action:'createSchedule',audience:'public',title:'Bad',body:'Message',url:'https://evil.example/',schedule:{frequency:'daily',startDate:'2026-12-02',time:'09:00'}}),e=>e.code==='invalid-argument');
console.log('PASS: schedule creation, actual delivery, duplicate prevention, stopping and link validation.');
