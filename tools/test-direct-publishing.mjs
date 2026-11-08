import assert from 'node:assert/strict';
import {createDirectPublishing} from './members/functions/direct-publishing.mjs';
import {mergeStudioVideos,acknowledgeStudio,publicVideoLibrary} from './members/functions/direct-library.mjs';
import {serveVideoShare} from './members/functions/video-share.mjs';
import {watchAccess} from '../script/watch-access.mjs';
const a='abcdefghijk',b='ABCDEFGHIJK',c='12345678901';
class Fail extends Error{constructor(code,message){super(message);this.code=code;}}
const rows=new Map([['churchVideoLibrary/current',{revision:'old',videos:[{id:a,title:'Old stream',visibility:'members'},{id:c,title:'Public',visibility:'public'}]}],['churchVideoLibrary/desired',{videos:[{id:a,title:'Old stream',visibility:'members'},{id:c,title:'Public',visibility:'public'}]}]]);
const db={doc:path=>({path,get:async()=>({exists:rows.has(path),data:()=>structuredClone(rows.get(path))}),set:async(value,options)=>rows.set(path,options?.merge?{...rows.get(path),...value}:value)}),runTransaction:async cb=>cb({get:ref=>ref.get(),set:(ref,value,options)=>ref.set(value,options)})};
let owner=true,live=[],recordings=[],metadataTitle='Prayer meeting',clock=100;
const service=createDirectPublishing({db,auth:{getUser:async()=>({email:owner?'owner@example.com':'guest@example.com',emailVerified:true,providerData:[{}]})},fail:Fail,emails:()=> 'owner@example.com',now:()=>clock,live:{catalog:async()=>live},recordings:async()=>recordings,send:async()=>Response.json({title:metadataTitle})});
const request={auth:{uid:'owner'},data:{videoId:b,visibility:'members',direct:true}};
await assert.rejects(service.publish({}),e=>e.code==='unauthenticated');owner=false;await assert.rejects(service.publish(request),e=>e.code==='permission-denied');owner=true;
await service.publish(request);assert.equal(rows.get('churchVideoLibrary/current').videos[0].id,a,'audio-less upload remains pending');
assert.equal((await service.source())[0].id,b,'OBS/local audio helper sees ID before any GitHub write');
assert.equal((await service.status(request)).state,'publishing');
live=[{videoId:b,title:'Live',active:true,expiresAt:10000}];
assert.equal((await service.status(request)).state,'ready','active feed publishes without GitHub or generated share page');
assert.equal(rows.get('churchVideoLibrary/current').videos[0].id,b);assert.equal(rows.get('churchVideoLibrary/current').revision,'old');
assert.equal((await service.status(request)).url,'https://auth.lightcityfellowship.com/Share/Video/'+b+'/');
assert.equal((await publicVideoLibrary(db)).some(v=>v.id===b),false,'member video never enters public catalogue');
await assert.rejects(service.publish({...request,data:{videoId:b,visibility:'public'}}),e=>e.code==='failed-precondition');
await service.publish(request);assert.equal(rows.get('churchVideoLibrary/studio').entries.length,1,'duplicate submit is idempotent');
const state=rows.get('churchVideoLibrary/studio'),stale=[{id:a,title:'Old stream',visibility:'members'},{id:c,title:'Public',visibility:'public'}];
assert.equal(mergeStudioVideos(stale,state)[0].id,b,'a build started before publication cannot erase it');
const acknowledged=acknowledgeStudio(state,[b,a,c]);assert.equal(acknowledged.entries[0].sourceSeen,true);
assert.ok(!mergeStudioVideos(stale,acknowledged).some(v=>v.id===b),'later intentional source removal is respected after backup observed');
clock++;metadataTitle='Edited replacement';recordings=[];live=[];
const replacement={auth:{uid:'owner'},data:{videoId:'zzzzzzzzzzz',visibility:'members',replaceVideoId:b,direct:true}};
await service.publish(replacement);assert.ok(rows.get('churchVideoLibrary/current').videos.some(v=>v.id===b),'original remains until matching replacement audio ready');
recordings=[{videoId:'zzzzzzzzzzz',bytes:100,sha256:'a'.repeat(64),title:'Edited replacement'}];
await service.status(replacement);const updated=rows.get('churchVideoLibrary/current').videos;
assert.ok(!updated.some(v=>v.id===b));assert.deepEqual(updated[0].replaces,[b]);
assert.equal(await watchAccess(c,{api:{ready:Promise.resolve(),publicLibrary:[{id:c}]}}),true);
assert.equal(await watchAccess(b,{publicIds:[b],api:{ready:Promise.resolve(),publicLibrary:[]}}),false,'fresh audience policy supersedes stale public HTML');
assert.equal(await watchAccess(b,{api:{ready:Promise.resolve(),publicLibrary:[],library:[{id:b}],user:{uid:'anon',isAnonymous:true}}}),false);
const response={headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},type(){return this;},send(body){this.body=body;return this;}};
await serveVideoShare({method:'GET',path:'/Share/Video/'+b+'/'},response,db);assert.equal(response.code,200);assert.ok(response.body.includes('Edited replacement'));assert.ok(response.body.includes('/Watch/?v=zzzzzzzzzzz'));assert.ok(response.body.includes('mqdefault.jpg'));assert.equal(response.headers['Cache-Control'],'no-store');
await serveVideoShare({method:'GET',path:'/Share/Video/unknown0000/'},response,db);assert.equal(response.code,404);
const publicRow=rows.get('churchVideoLibrary/current');publicRow.videos.push({id:'yyyyyyyyyyy',title:'Public replacement',visibility:'public',replaces:[a,c],replacementVisibility:{[a]:'members',[c]:'public'}});
const safe=(await publicVideoLibrary(db)).find(v=>v.id==='yyyyyyyyyyy');assert.deepEqual(safe.replaces,[c]);assert.ok(!JSON.stringify(safe).includes(a));
console.log('PASS: direct publication, pending audio, live readiness, idempotency, auth/audiences, GitHub outage independence, stale build protection, source retirement, replacements, public privacy, dynamic share previews and Watch access.');
// Replacing an older item must not displace the newest item, before OR after readiness.
const newest='newest00001',older='older000001',replacementId='replace0001';
rows.set('churchVideoLibrary/current',{videos:[{id:newest,title:'Newest',visibility:'members'},{id:older,title:'Older',visibility:'members'},{id:c,title:'Last',visibility:'public'}]});
rows.set('churchVideoLibrary/desired',structuredClone(rows.get('churchVideoLibrary/current')));rows.set('churchVideoLibrary/studio',{entries:[]});
recordings=[];live=[];
await assert.rejects(service.replaceFromHelper({videoId:replacementId,replaceVideoId:older,visibility:'members',expectedVersion:'stale'}),e=>e.code==='aborted');
await service.replaceFromHelper({videoId:replacementId,replaceVideoId:older,visibility:'members',expectedVersion:'legacy'});
assert.deepEqual((await service.source()).map(v=>v.id),[newest,replacementId,c]);
assert.deepEqual(rows.get('churchVideoLibrary/current').videos.map(v=>v.id),[newest,older,c]);
recordings=[{videoId:replacementId,bytes:100,sha256:'a'.repeat(64)}];await service.promote(replacementId);
assert.deepEqual(rows.get('churchVideoLibrary/current').videos.map(v=>v.id),[newest,replacementId,c]);
assert.deepEqual(rows.get('churchVideoLibrary/current').videos[1].replaces,[older]);
// A recovery is explicit, scoped, and cannot restore an admin removal.
rows.set('churchVideoLibrary/current',{videos:[{id:newest,title:'Newest',visibility:'members'},{id:c,title:'Last',visibility:'public'}]});rows.set('churchVideoLibrary/desired',structuredClone(rows.get('churchVideoLibrary/current')));
rows.set('churchVideoLibrary/studio',{entries:[],removed:[{id:older,visibility:'members'}]});
rows.set('churchStudioPublications/'+older,{state:'removed',title:'Older',visibility:'members',removedBy:'admin'});rows.delete('churchStudioPublications/'+replacementId);recordings=[];
const recovery={videoId:replacementId,replaceVideoId:older,visibility:'members',expectedVersion:'legacy',recoverRemoved:true,afterId:newest,beforeId:c};
await assert.rejects(service.replaceFromHelper(recovery),e=>e.code==='failed-precondition');
rows.get('churchStudioPublications/'+older).removedBy='local-list-helper';
await service.replaceFromHelper(recovery);
assert.deepEqual(rows.get('churchVideoLibrary/current').videos.map(v=>v.id),[newest,older,c]);
assert.deepEqual((await service.source()).map(v=>v.id),[newest,replacementId,c]);
assert.equal(rows.get('churchStudioPublications/'+older).state,'recovered');
recordings=[{videoId:replacementId,bytes:100,sha256:'a'.repeat(64)}];await service.promote(replacementId);
assert.deepEqual(rows.get('churchVideoLibrary/current').videos.map(v=>v.id),[newest,replacementId,c]);
console.log('PASS: older replacement preserves slot, keeps original until ready, rejects stale versions and safely recovers helper-only accidental removals.');
// A ready source must not wait for an unrelated stalled source.
for(const readyKind of ['recorded','live']){
 const id=readyKind==='recorded'?'fastrec0001':'fastliv0001';
 const fast=createDirectPublishing({db,auth:{getUser:async()=>({email:'owner@example.com',emailVerified:true,providerData:[{}]})},fail:Fail,emails:()=> 'owner@example.com',now:()=>clock,
 recordings:()=>readyKind==='recorded'?Promise.resolve([{videoId:id,bytes:100,sha256:'a'.repeat(64)}]):new Promise(()=>{}),
 live:{catalog:()=>readyKind==='live'?Promise.resolve([{videoId:id,active:true,expiresAt:clock+10000}]):new Promise(()=>{})},send:async()=>Response.json({title:'Fast publication'})});
 let timer;try{await Promise.race([fast.publish({auth:{uid:'owner'},data:{videoId:id,visibility:'members'}}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Ready publication waited for stalled source')),1000);})]);}finally{clearTimeout(timer);}
 assert(rows.get('churchVideoLibrary/current').videos.some(v=>v.id===id));
}
console.log('PASS: ready live or recorded audio publishes while the unrelated source is stalled.');

// Explicit replacements must never silently target an unrelated existing publication.
const originalA='original001',originalB='original002',newId='recorded001',otherId='recorded002';
const resetReplacement=()=>{
 rows.clear();
 rows.set('churchVideoLibrary/current',{videos:[
  {id:originalA,title:'First original',visibility:'members'},
  {id:originalB,title:'Second original',visibility:'members'}
 ]});
 rows.set('churchVideoLibrary/studio',{entries:[]});
 recordings=[];live=[];clock++;
};
const replaceRequest=(videoId=newId,replaceVideoId=originalA)=>({auth:{uid:'owner'},data:{videoId,replaceVideoId,visibility:'members',direct:true}});
resetReplacement();
rows.get('churchVideoLibrary/current').videos.push({id:newId,title:'Already published separately',visibility:'members'});
await assert.rejects(service.publish(replaceRequest()),e=>e.code==='failed-precondition');
assert.deepEqual(rows.get('churchVideoLibrary/current').videos.map(v=>v.id),[originalA,originalB,newId]);
assert.equal(rows.get('churchVideoLibrary/studio').entries.length,0);
resetReplacement();
await service.publish(replaceRequest());
const pendingOperation=rows.get('churchStudioPublications/'+newId).operationId;
await service.publish(replaceRequest());
assert.equal(rows.get('churchVideoLibrary/studio').entries.length,1);
assert.equal(rows.get('churchStudioPublications/'+newId).operationId,pendingOperation);
await assert.rejects(service.publish(replaceRequest(newId,originalB)),e=>e.code==='failed-precondition');
await assert.rejects(service.publish(replaceRequest(otherId)),e=>e.code==='failed-precondition');
assert.equal(rows.get('churchVideoLibrary/studio').entries.length,1);
assert.deepEqual(rows.get('churchVideoLibrary/current').videos.map(v=>v.id),[originalA,originalB]);
recordings=[{videoId:newId,bytes:100,sha256:'a'.repeat(64)}];
await service.promote(newId);
await service.publish(replaceRequest());
assert.equal(rows.get('churchStudioPublications/'+newId).operationId,pendingOperation);
assert.deepEqual(rows.get('churchVideoLibrary/current').videos.map(v=>v.id),[newId,originalB]);
assert.deepEqual(rows.get('churchVideoLibrary/current').videos[0].replaces,[originalA]);
assert.equal((await service.status(replaceRequest())).state,'ready');
console.log('PASS: Studio replacements reject already published targets and conflicting pending requests, while same-request retries preserve the audio gate and original slot.');

// A source build can see a pending ID while the published snapshot still retains its original.
resetReplacement();
await service.publish(replaceRequest());
rows.get('churchVideoLibrary/studio').entries[0].sourceSeen=true;
rows.set('churchVideoLibrary/desired',{videos:[
 {id:newId,title:'Replacement recording',visibility:'members'},
 {id:originalB,title:'Second original',visibility:'members'}
]});
recordings=[{videoId:newId,bytes:100,sha256:'a'.repeat(64)}];
assert.equal(await service.promote(newId),true);
assert.deepEqual(rows.get('churchVideoLibrary/current').videos.map(v=>v.id),[newId,originalB]);
assert.deepEqual(rows.get('churchVideoLibrary/current').videos[0].replaces,[originalA]);
assert.equal(rows.get('churchVideoLibrary/studio').entries[0].sourceSeen,false);
assert.equal(rows.get('churchStudioPublications/'+newId).state,'ready');
const sentPath='webPushSent/'+(await import('node:crypto')).createHash('sha256').update('video:'+newId).digest('hex');
rows.set(sentPath,{silent:true,sent:true,replacementOf:[originalA]});
const previousSent=structuredClone(rows.get(sentPath));
// A ready marker cannot confirm success after a stale publication loses the target.
rows.set('churchVideoLibrary/current',{videos:[
 {id:originalA,title:'First original',visibility:'members'},
 {id:originalB,title:'Second original',visibility:'members'}
]});
rows.get('churchVideoLibrary/studio').entries[0].sourceSeen=true;
recordings=[];
assert.equal(await service.promote(newId),false,'a ready job still needs matching audio to restore a missing publication');
assert.deepEqual(rows.get('churchVideoLibrary/current').videos.map(v=>v.id),[originalA,originalB]);
recordings=[{videoId:newId,bytes:100,sha256:'a'.repeat(64)}];
assert.equal(await service.promote(newId),true);
assert.deepEqual(rows.get('churchVideoLibrary/current').videos.map(v=>v.id),[newId,originalB]);
assert.deepEqual(rows.get('churchVideoLibrary/current').videos[0].replaces,[originalA]);
assert.deepEqual(rows.get(sentPath),previousSent,'ready-state repair never changes an existing notification marker');
assert.equal(rows.get('churchStudioPublications/'+newId).state,'ready','ready-state repair does not retrigger a pending-to-ready notification');
// Seeing an ID in an older build does not authorize restoring a later source-file removal.
rows.set('churchVideoLibrary/current',{videos:[{id:originalA,title:'First original',visibility:'members'}]});
rows.get('churchVideoLibrary/studio').entries[0].sourceSeen=true;
rows.set('churchVideoLibrary/desired',{videos:[{id:originalA,title:'First original',visibility:'members'}]});
assert.equal(await service.promote(newId),false,'a source-retired recording remains retired');
rows.set('churchVideoLibrary/desired',{videos:[{id:newId,title:'Wrong audience',visibility:'public'}]});
assert.equal(await service.promote(newId),false,'the desired source must retain the same audience');
rows.set('churchVideoLibrary/desired',{videos:[{id:newId,title:'Replacement',visibility:'members'}]});
const removedOther='removed0001';
rows.get('churchVideoLibrary/studio').entries.push({video:{id:removedOther,title:'Removed item',visibility:'members'},state:'ready',sourceSeen:false});
rows.get('churchVideoLibrary/studio').removed=[{id:removedOther}];
assert.equal(await service.promote(newId),true);
assert.ok(!rows.get('churchVideoLibrary/current').videos.some(video=>video.id===removedOther),'repair preserves other removal protections');
// Removed jobs and missing Studio entries never become publications through recovery.
rows.set('churchVideoLibrary/current',{videos:[{id:originalA,title:'First original',visibility:'members'}]});
rows.get('churchStudioPublications/'+newId).state='removed';
assert.equal(await service.promote(newId),false);
rows.get('churchStudioPublications/'+newId).state='ready';
rows.get('churchVideoLibrary/studio').removed=[{id:newId}];
assert.equal(await service.promote(newId),false);
rows.get('churchVideoLibrary/studio').removed=[];
rows.get('churchVideoLibrary/studio').entries=[];
assert.equal(await service.promote(newId),false);
assert.deepEqual(rows.get('churchVideoLibrary/current').videos.map(v=>v.id),[originalA]);
console.log('PASS: observed pending IDs actually activate, ready jobs recover missing publications only with matching audio, replacements preserve their slot/aliases, and removed or missing entries stay excluded.');

// Silent additions stay new videos, wait for audio, and reserve suppression atomically.
const silentId='silent00001';
recordings=[];live=[];
await assert.rejects(service.publish({auth:{uid:'owner'},data:{videoId:silentId,visibility:'members',notifyViewers:'false'}}),e=>e.code==='invalid-argument');
const silentRequest={auth:{uid:'owner'},data:{videoId:silentId,visibility:'members',notifyViewers:false}};
await service.publish(silentRequest);
assert.equal(rows.get('churchStudioPublications/'+silentId).notifyViewers,false);
assert.ok(!rows.get('churchVideoLibrary/current').videos.some(v=>v.id===silentId));
// A duplicate/default retry must not turn a pending silent publication into an alert.
await service.publish({auth:{uid:'owner'},data:{videoId:silentId,visibility:'members'}});
assert.equal(rows.get('churchStudioPublications/'+silentId).notifyViewers,false);
recordings=[{videoId:silentId,bytes:100,sha256:'a'.repeat(64)}];
await service.promote(silentId);
const added=rows.get('churchVideoLibrary/current').videos.find(v=>v.id===silentId);
assert.ok(added);assert.equal(added.replaces,undefined);
const {createHash}=await import('node:crypto');
assert.equal(rows.get('webPushSent/'+createHash('sha256').update('video:'+silentId).digest('hex')).silent,true,'the GitHub notifier also sees suppression before publication becomes visible');
console.log('PASS: silent new additions, readiness gating, validation and durable retry-safe notification suppression.');
