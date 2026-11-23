import assert from 'node:assert/strict';
import {createCalendarEvents,matchesCalendarQuestion} from './members/functions/calendar-events.mjs';
class Fail extends Error{constructor(code,message){super(message);this.code=code;}}
const store=new Map(),path='churchStudioPublications/calendar/events/';
function ref(key){return {get:async()=>({exists:store.has(key),data:()=>structuredClone(store.get(key))})};}
const db={doc:ref,collection:name=>({doc:id=>ref(name+'/'+id),limit:()=>({get:async()=>({docs:[...store.entries()].filter(([k])=>k.startsWith(name+'/')).map(([k,v])=>({id:k.slice(name.length+1),data:()=>structuredClone(v)}))})})}),runTransaction:async fn=>fn({get:r=>r.get(),set:(r,v)=>store.set(r.path,v),delete:r=>store.delete(r.path)})};
db.doc=key=>({...ref(key),path:key});db.collection=name=>{const query=(filters=[])=>({doc:id=>db.doc(name+'/'+id),where:(key,op,value)=>query([...filters,[key,op,value]]),limit:()=>({get:async()=>({docs:[...store.entries()].filter(([k,v])=>k.startsWith(name+'/')&&filters.every(([key,op,value])=>op==='=='?v[key]===value:op==='>='?v[key]>=value:v[key]<=value)).map(([k,v])=>({id:k.slice(name.length+1),data:()=>structuredClone(v)}))})})});return query();};
const users={admin:{email:'admin@example.com',emailVerified:true,providerData:[{}]},member:{email:'member@example.com',emailVerified:true,providerData:[{}]},stranger:{email:'other@example.com',emailVerified:true,providerData:[{}]}};
const auth={getUser:async uid=>users[uid]};store.set('churchMembers/member',{active:true});
const svc=createCalendarEvents({db,auth,fail:Fail,emails:()=> 'admin@example.com',now:()=>1});
const admin=data=>({auth:{uid:'admin'},data:{...data,accountUid:'admin'}}),member=query=>({auth:{uid:'member'},data:{query,accountUid:'member'}}),publicQuery=query=>({data:{query}});
await svc.manage(admin({action:'save',event:{id:'',title:'Ada was born',date:'2020-05-17',description:'A family event',keywords:'',visibility:'members'}}));
await svc.manage(admin({action:'save',event:{id:'',title:'Easter programme',date:'2024-03-31',visibility:'public'}}));
assert.equal((await svc.search(publicQuery('when was Ada born'))).events.length,0,'public search cannot reveal member events');
assert.equal((await svc.search(member('when was Ada born'))).events[0].date,'2020-05-17');
assert.equal((await svc.search(member('when was prayer groups started'))).events[0].date,'2024-01-28');
assert.equal((await svc.search(publicQuery('when was Easter programme'))).events[0].date,'2024-03-31');
assert.equal((await svc.range(false,'2020-01-01','2020-12-31')).length,0);
assert.equal((await svc.range(true,'2020-01-01','2020-12-31')).length,1);
await assert.rejects(svc.manage({auth:{uid:'stranger'},data:{action:'list',accountUid:'stranger'}}),e=>e.code==='permission-denied');
const listed=(await svc.manage(admin({action:'list'}))).events,ada=listed.find(x=>x.title==='Ada was born');
await svc.manage(admin({action:'save',event:{...ada,title:'Ada birth',date:'2020-05-18'}}));
await assert.rejects(svc.manage(admin({action:'delete',id:ada.id,revision:ada.revision})),e=>e.code==='aborted');
assert.ok(matchesCalendarQuestion({title:'Ada was born'},'When was Ada born?'));
console.log('PASS: member-default privacy, public events, questions, event updates and admin authorization.');
