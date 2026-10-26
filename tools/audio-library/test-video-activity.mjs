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

active=true;disabled=false;verified=true;declarations=[{id:b,title:'Uploaded version',visibility:'public',replaces:[a]}];
data.set('churchVideoActivity/replacement-user/saved/'+a,{title:'Original livestream',updatedAt:100});data.set('churchVideoActivity/replacement-user/history/'+a,{title:'Original livestream',seconds:800,duration:1000,mode:'audio',updatedAt:100});
let point=await api.getMyVideoActivity(call('replacement-user',{videoId:b}));assert.equal(point.saved,true);assert.equal(point.history,null,'edited uploads never inherit old live timestamps');
let savedPage=await api.getMyVideoActivity(call('replacement-user',{view:'saved'}));assert.deepEqual(savedPage.rows.map(r=>r.videoId),[b]);assert.equal(savedPage.rows[0].title,'Uploaded version');
assert.equal((await api.getMyVideoActivity(call('replacement-user',{view:'history'}))).rows.length,0);
await api.updateMyVideoActivity(call('replacement-user',{action:'save',videoId:b}));assert.equal((await api.getMyVideoActivity(call('replacement-user',{view:'saved'}))).rows.length,1,'old and new saves appear once');
await api.updateMyVideoActivity(call('replacement-user',{action:'unsave',videoId:b}));assert.equal((await api.getMyVideoActivity(call('replacement-user',{videoId:b}))).saved,false,'unsaving clears old aliases too');
await api.updateMyVideoActivity(call('replacement-user',{action:'save',videoId:a}));assert.ok(data.has('churchVideoActivity/replacement-user/saved/'+b),'a queued old save writes to the current version');
await assert.rejects(api.updateMyVideoActivity(call('replacement-user',{action:'progress',videoId:a,seconds:1,duration:10,mode:'video',rate:1})),e=>e.code==='permission-denied','old-player progress cannot be written to the edited upload');
declarations=[{id:b,title:'Member upload',visibility:'members',replaces:[a]}];active=false;assert.equal((await api.getMyVideoActivity(call('replacement-user',{view:'saved'}))).rows.length,0);await assert.rejects(api.getMyVideoActivity(call('replacement-user',{videoId:a})),e=>e.code==='not-found');
await api.updateMyVideoActivity(call('replacement-user',{action:'unsave',videoId:a}));active=true;assert.equal((await api.getMyVideoActivity(call('replacement-user',{videoId:b}))).saved,false,'users can clear their own replacement bookmark after access revocation');
console.log('PASS: replacement bookmarks resolve across devices, deduplicate, unsave permanently, preserve member access and leave edited timelines independent.');

declarations=[{id:b,title:'Public replacement',visibility:'public',replaces:[a,'PUBLICOLD01'],replacementVisibility:{[a]:'members',PUBLICOLD01:'public'}},{id:'MEMBERNEW01',title:'Private replacement',visibility:'members',replaces:['PRIVATEOLD1'],replacementVisibility:{PRIVATEOLD1:'public'}}];
const publicAliases=await api.getVideoReplacements();assert.deepEqual(publicAliases.replacements,{PUBLICOLD01:b},'public redirect endpoint excludes member source IDs and member destinations');
console.log('PASS: automatic public redirect discovery reveals only public-to-public replacements and requires no member sign-in.');
