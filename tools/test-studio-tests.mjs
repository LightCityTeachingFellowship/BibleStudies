import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createStudioTests} from './members/functions/studio-tests.mjs';
class Fail extends Error{constructor(code,message){super(message);this.code=code;}}
const rows=new Map(),calls=[],root=uid=>'churchStudioPublications/private-test-'+createHash('sha256').update(uid).digest('hex');
function doc(path){return {path,id:path.split('/').at(-1),get:async()=>({id:path.split('/').at(-1),ref:doc(path),exists:rows.has(path),data:()=>rows.get(path)}),set:async(v,o)=>rows.set(path,o?.merge?{...rows.get(path),...v}:v),delete:async()=>rows.delete(path)};}
const db={doc,collection:path=>({get:async()=>({docs:await Promise.all([...rows.keys()].filter(k=>k.startsWith(path+'/')&&k.slice(path.length+1).indexOf('/')<0).map(k=>doc(k).get()))})}),getAll:async(...refs)=>Promise.all(refs.map(r=>r.get())),runTransaction:async fn=>fn({get:r=>r.get(),set:(r,v,o)=>r.set(v,o)})};
let clock=1000,regular=false,invalid=false;
const service=createStudioTests({db,fail:Fail,now:()=>clock,emails:()=> 'admin@example.com',auth:{getUser:async()=>({email:regular?'member@example.com':'admin@example.com',emailVerified:true,providerData:[{}]}),verifyIdToken:async token=>{if(invalid)throw Error();return {uid:token};}},send:async()=>Response.json({title:'Private prayer test'}),messaging:{sendEachForMulticast:async payload=>{calls.push(payload);return {successCount:payload.tokens.length,responses:payload.tokens.map(()=>({success:true}))};}}});
const req=(data,uid='admin')=>({auth:{uid},data:{accountUid:uid,...data}}),id='abcdefghijk';
await assert.rejects(service.publish({data:{videoId:id}}),e=>e.code==='unauthenticated');regular=true;await assert.rejects(service.publish(req({videoId:id})),e=>e.code==='permission-denied');regular=false;
await assert.rejects(service.publish(req({videoId:id})),e=>e.code==='failed-precondition');assert.equal(calls.length,0,'no broad audience fallback');
await assert.rejects(service.manage(req({action:'register',deviceToken:'phone'})),e=>e.code==='failed-precondition');
rows.set('webPushSubscribers/phone',{token:'phone-token'});rows.set('webPushSubscribers/computer',{token:'computer-token'});rows.set('webPushSubscribers/member',{token:'other-person'});
invalid=true;await assert.rejects(service.manage(req({action:'register',deviceToken:'phone'})),e=>e.code==='permission-denied');invalid=false;
for(const deviceToken of ['phone','computer'])await service.manage(req({action:'register',deviceToken}));
const result=await service.publish(req({videoId:id}));assert.equal(result.accepted,2);assert.equal(result.visibility,'test');assert.deepEqual(calls[0].tokens,['phone-token','computer-token']);assert.equal(calls[0].data.url,'https://lightcityfellowship.com/Admin/?test='+id);
assert.ok([...rows.keys()].every(k=>k.startsWith('webPushSubscribers/')||k.startsWith(root('admin'))),'no library, GitHub or normal push writes');
assert.equal((await service.status(req({videoId:id}))).title,'Private prayer test');
await assert.rejects(service.status(req({videoId:id},'another-admin')),e=>e.code==='not-found','separate admin cannot read owner test');
regular=true;await assert.rejects(service.status(req({videoId:id})),e=>e.code==='permission-denied');regular=false;
await assert.rejects(service.publish(req({videoId:id})),e=>e.code==='resource-exhausted');
await service.manage(req({action:'unregister',deviceToken:'phone'}));clock+=31000;calls.length=0;
await service.publish(req({videoId:id}));assert.deepEqual(calls[0].tokens,['computer-token']);
rows.delete('webPushSubscribers/computer');clock+=31000;await assert.rejects(service.publish(req({videoId:id})),e=>e.code==='failed-precondition');
console.log('PASS: admin-only tests/preview, verified device registration, no public/member delivery fallback, only registered targets, private storage, rate limit and device removal.');
