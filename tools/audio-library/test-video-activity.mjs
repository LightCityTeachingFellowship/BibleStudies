import assert from 'node:assert/strict';
import { createVideoActivity } from '../members/functions/video-activity.mjs';
const a='abcdefghijk', b='ABCDEFGHIJK', data=new Map();
let active=true, verified=true, disabled=false, tick=1000;
let declarations=[{id:a,title:'Public teaching',visibility:'public'},{id:b,title:'Private teaching',visibility:'members'}];
const snapshot=(path,value)=>({id:path.split('/').pop(),ref:{path},exists:value!==undefined,data:()=>value});
function doc(path){return {path,async get(){if(path==='churchVideoLibrary/current')return snapshot(path,{videos:declarations});if(path.startsWith('churchMembers/'))return snapshot(path,{active});return snapshot(path,data.get(path));},async set(v){data.set(path,v);},async delete(){data.delete(path);}};}
function collection(path){
 let after=null, maximum=100;
 const api={doc:id=>doc(path+'/'+id),orderBy(){return api;},startAfter(time,id){after={time,id};return api;},limit(n){maximum=n;return api;},async get(){
  let rows=[...data].filter(([k])=>k.startsWith(path+'/')&&k.split('/').length===path.split('/').length+1).map(([k,v])=>snapshot(k,v));
  rows.sort((a,b)=>b.data().updatedAt-a.data().updatedAt||b.id.localeCompare(a.id));
  if(after)rows=rows.filter(r=>r.data().updatedAt<after.time||(r.data().updatedAt===after.time&&r.id<after.id));
  rows=rows.slice(0,maximum);return {docs:rows,size:rows.length};
 }};return api;
}
class Failure extends Error{constructor(code,message){super(message);this.code=code;}}
const api=createVideoActivity({auth:{getUser:async()=>({disabled,emailVerified:verified,providerData:[{providerId:'google.com'}]})},db:{doc,collection,batch:()=>{const paths=[];return {delete:r=>paths.push(r.path),commit:async()=>paths.forEach(p=>data.delete(p))};}},fail:Failure,now:()=>++tick});
const call=(uid,body)=>({auth:uid?{uid}:undefined,data:body});
await assert.rejects(api.getMyVideoActivity(call(null,{view:'saved'})),e=>e.code==='unauthenticated');
await api.updateMyVideoActivity(call('alice',{action:'save',videoId:a}));
await api.updateMyVideoActivity(call('alice',{action:'save',videoId:b}));
assert.equal((await api.getMyVideoActivity(call('alice',{view:'saved'}))).rows.length,2);
assert.equal((await api.getMyVideoActivity(call('bob',{view:'saved',uid:'alice'}))).rows.length,0,'caller cannot select another user');
active=false;
assert.deepEqual((await api.getMyVideoActivity(call('alice',{view:'saved'}))).rows.map(r=>r.videoId),[a]);
await assert.rejects(api.updateMyVideoActivity(call('alice',{action:'progress',videoId:b,seconds:30,duration:100,rate:1,mode:'video'})),e=>e.code==='permission-denied');
active=true;
await api.updateMyVideoActivity(call('alice',{action:'progress',videoId:a,seconds:120.5,duration:1000,rate:1.25,mode:'audio'}));
assert.equal((await api.getMyVideoActivity(call('alice',{videoId:a}))).history.seconds,120.5);
await assert.rejects(api.updateMyVideoActivity(call('alice',{action:'progress',videoId:a,seconds:-1,duration:100,rate:1,mode:'video'})),e=>e.code==='invalid-argument');
await api.updateMyVideoActivity(call('alice',{action:'clearHistory'}));
assert.equal((await api.getMyVideoActivity(call('alice',{view:'history'}))).rows.length,0);
assert.equal((await api.getMyVideoActivity(call('alice',{view:'saved'}))).rows.length,2);
for(let i=0;i<105;i++){const id=String(i).padStart(11,'0');declarations.push({id,title:id,visibility:'public'});await api.updateMyVideoActivity(call('alice',{action:'progress',videoId:id,seconds:30,duration:1000,rate:1,mode:'video'}));}
const first=await api.getMyVideoActivity(call('alice',{view:'history'}));assert.equal(first.rows.length,100);assert.ok(first.cursor);
const next=await api.getMyVideoActivity(call('alice',{view:'history',cursor:first.cursor}));assert.equal(next.rows.length,5);assert.equal(next.cursor,null);
assert.equal(new Set([...first.rows,...next.rows].map(r=>r.videoId)).size,105);
declarations=[{id:a,visibility:'public'}];assert.equal((await api.getMyVideoActivity(call('alice',{view:'history'}))).rows.length,0,'removed IDs are filtered');
verified=false;await assert.rejects(api.getMyVideoActivity(call('alice',{view:'saved'})),e=>e.code==='permission-denied');verified=true;disabled=true;await assert.rejects(api.getMyVideoActivity(call('alice',{view:'saved'})),e=>e.code==='permission-denied');
console.log('PASS: private per-user API, guest denial, current member access and revocation, input validation, fractional resume timestamps, clear-history isolation, removed IDs, and paginated results.');

disabled=false;await assert.rejects(api.updateMyVideoActivity(call('bob',{action:'save',videoId:a,accountUid:'alice'})),e=>e.code==='permission-denied','an in-flight account switch must not write old-account activity under the new identity');
