import assert from 'node:assert/strict';
import {finishDirectPublication} from './members/functions/direct-notifications.mjs';
import {createHash} from 'node:crypto';
const id='abcdefghijk',store=new Map([
 ['churchStudioPublications/'+id,{direct:true,state:'ready',visibility:'members'}],
 ['churchVideoLibrary/current',{videos:[{id,title:'Members stream',visibility:'members'}]}],
 ['churchDevices/member',{memberUid:'approved'}],['churchMembers/approved',{active:true}]
]);
function doc(path){return {path,id:path.split('/').at(-1),ref:{delete:async()=>store.delete(path)},get:async()=>({exists:store.has(path),data:()=>structuredClone(store.get(path))}),set:async(v,o)=>store.set(path,o?.merge?{...store.get(path),...v}:v)};}
const subscribers=['member','guest'].map(id=>({id,data:()=>({token:id+'-token'}),ref:{delete:async()=>{}}}));
const db={doc,getAll:async(...refs)=>Promise.all(refs.map(r=>r.get())),collection:path=>({get:async()=>({docs:subscribers})}),runTransaction:async cb=>cb({get:r=>r.get(),set:(r,v,o)=>r.set(v,o)}),batch:()=>{const writes=[];return {set:(r,v)=>writes.push([r,v]),commit:async()=>{for(const[r,v]of writes)await r.set(v);}};}};
let sent=[],backupFails=true;
const deps={id,db,auth:{getUsers:async()=>({users:[{uid:'approved',emailVerified:true,disabled:false}]})},messaging:{sendEachForMulticast:async payload=>{sent.push(payload);return {responses:payload.tokens.map(()=>({success:true}))};}},github:{add:async()=>{if(backupFails)throw Error('GitHub unavailable');}}};
await assert.rejects(finishDirectPublication(deps),/GitHub unavailable/);assert.deepEqual(sent[0].tokens,['member-token'],'verified church devices only');assert.ok(store.get('churchVideoLibrary/current').videos.some(v=>v.id===id),'GitHub outage never undoes publication');
backupFails=false;await finishDirectPublication(deps);assert.equal(sent.length,1,'backup retry does not resend notification');assert.equal(store.get('churchStudioPublications/'+id).backedUp,true);
await finishDirectPublication(deps);assert.equal(sent.length,1,'duplicate event does not resend');
const key=createHash('sha256').update('video:'+id).digest('hex');store.delete('webPushSent/'+key);store.set('churchVideoLibrary/current',{videos:[{id,title:'Replacement',visibility:'members',replaces:['ABCDEFGHIJK']}]});
await finishDirectPublication(deps);assert.equal(sent.length,1,'replacement is silent');assert.equal(store.get('webPushSent/'+key).silent,true);
console.log('PASS: member notification isolation, durable deduplication, silent replacement, GitHub outage independence and background backup retry.');