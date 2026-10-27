import assert from 'node:assert/strict';
import {createAdminDashboard} from './members/functions/admin.mjs';
import {streamId,watchLink,dashboardRows,filterRows} from '../script/admin-core.mjs';
const a='abcdefghijk',b='ABCDEFGHIJK';
class Failure extends Error{constructor(code,message){super(message);this.code=code;}}
let user={email:'lightcityteachingfellowship@gmail.com',emailVerified:true,disabled:false,providerData:[{providerId:'google.com'}]},reads=0,catalogueCalls=0;
const published=[{id:a,title:'Prayer meeting',visibility:'members',replaces:['12345678901']}],pending=[...published,{id:b,title:'Edited recording',visibility:'members',replaces:[a]}];
const handler=createAdminDashboard({emails:()=> 'lightcityteachingfellowship@gmail.com',fail:Failure,auth:{getUser:async()=>user},db:{doc:path=>({get:async()=>{reads++;return {exists:true,data:()=>({videos:path.endsWith('/current')?published:pending})};}})},audio:async()=>{catalogueCalls++;return [{videoId:a,url:'secret-signed-url'}];},live:{catalog:async()=>[{videoId:a,active:true,expiresAt:Date.now()+100000,secret:'must not return'}]},privateReadings:[{title:'Private summary',url:'/private-summary/',kind:'Summary',visibility:'members'}],send:async()=>Response.json({publications:[{title:'Article',url:'/article/',kind:'Article',date:'2026-10-27'},{title:'Bad',url:'https://evil.example/',kind:'Article'},{title:'Bad2',url:'javascript:alert(1)',kind:'Summary'}]})});
await assert.rejects(handler({}),e=>e.code==='unauthenticated');
user={...user,email:'member@example.com'};await assert.rejects(handler({auth:{uid:'member'}}),e=>e.code==='permission-denied');assert.equal(reads,0);assert.equal(catalogueCalls,0);
user={...user,email:'lightcityteachingfellowship@gmail.com',emailVerified:false};await assert.rejects(handler({auth:{uid:'owner'}}),e=>e.code==='permission-denied');assert.equal(reads,0);
user={...user,emailVerified:true,disabled:true};await assert.rejects(handler({auth:{uid:'owner'}}),e=>e.code==='permission-denied');assert.equal(reads,0);
user={...user,disabled:false};await assert.rejects(handler({auth:{uid:'owner'},data:{accountUid:'another'}}),e=>e.code==='permission-denied');assert.equal(reads,0);
const data=await handler({auth:{uid:'owner'},data:{accountUid:'owner'}});assert.equal(reads,2);assert.equal(data.videos[0].live,true);assert.equal(data.videos[0].audio,true);assert.equal(data.videos[1].published,false);assert.equal(data.videos[1].replacement,true);assert.equal(data.readings.length,2);assert.equal(data.readings[1].visibility,'members');
assert.ok(!JSON.stringify(data).includes('secret'));assert.ok(!JSON.stringify(data).includes('signed-url'));assert.ok(!JSON.stringify(data).includes('12345678901'),'unneeded aliases are not returned');
for(const link of [a,'https://youtu.be/'+a,'https://youtube.com/live/'+a+'?feature=share','https://www.youtube.com/watch?v='+a])assert.equal(streamId(link),a);
for(const link of ['https://youtube.com.evil.example/watch?v='+a,'javascript:alert(1)','https://evil.example/'+a,'bad'])assert.equal(streamId(link),null);
assert.equal(watchLink(a),'https://lightcityfellowship.com/Watch/?v='+a);assert.equal(watchLink(a,true),'https://lightcityfellowship.com/Listen/?v='+a);
const rows=dashboardRows(data);assert.equal(filterRows(rows,'Pending').length,1);assert.equal(filterRows(rows,'Audio').length,1);assert.equal(filterRows(rows,'Live').length,1);assert.equal(filterRows(rows,'Summary','private')[0].title,'Private summary');assert.ok(filterRows(rows,'Video',b).some(row=>row.id===b));assert.ok(rows.every(row=>row.url.startsWith('https://lightcityfellowship.com/')));
console.log('PASS: server-only admin authorization before private reads, verified active account enforcement, pending/live/audio metadata, private readings, safe links and content filters.');

const degraded=createAdminDashboard({emails:()=>user.email,fail:Failure,auth:{getUser:async()=>user},db:{doc:path=>({get:async()=>({exists:true,data:()=>({videos:published})})})},audio:async()=>{throw Error('offline');},live:{catalog:async()=>{throw Error('offline');}},send:async()=>new Response('',{status:503})});
const fallback=await degraded({auth:{uid:'owner'}});assert.equal(fallback.videos.length,1);assert.deepEqual(fallback.checks,{audio:false,live:false,readings:false});
console.log('PASS: catalogue outages preserve the authorized video list and report unavailable status sources.');
