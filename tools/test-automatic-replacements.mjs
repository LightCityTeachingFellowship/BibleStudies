import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {reconcileReplacements,splitReplacementNotifications,publishedNotificationLibrary,publicationRevisionDecision} from './video-replacements.mjs';
const a='abcdefghijk',b='ABCDEFGHIJK',c='12345678901',d='98765432109',e='ADDED000001';
const video=(id,visibility='public')=>({id,title:id,visibility});
let result=reconcileReplacements([video(a),video(b,'members')],[video(c),video(b,'members')]);assert.deepEqual(result.inferred,[{from:a,to:c,visibility:'public'}]);assert.deepEqual(result.videos[0].replaces,[a]);assert.equal(result.videos[0].replacementVisibility[a],'public');
assert.equal(splitReplacementNotifications(result.videos.filter(v=>v.id===c).map(v=>({...v,kind:'video'}))).notify.length,0);
const again=reconcileReplacements(result.videos,[video(d),video(b,'members')]);assert.deepEqual(again.videos[0].replaces,[a,c]);
const rerun=reconcileReplacements(again.videos,[video(d),video(b,'members')],[{from:a,to:c,visibility:'public'}]);assert.deepEqual(rerun.videos[0].replaces,[a,c],'a stale explicit record must not undo an automatic replacement');
result=reconcileReplacements([video(a)],[video(a),video(c),video(d)]);assert.equal(result.inferred.length,0);assert.ok(result.videos.every(v=>!v.replaces),'additions without removals notify normally');
assert.equal(reconcileReplacements([video(a),video(b)],[video(b),video(a)]).inferred.length,0,'reordering is not replacement');
assert.equal(reconcileReplacements([video(a)],[video(a,'members')]).inferred.length,0,'visibility changes are not replacement');
assert.equal(reconcileReplacements([video(a),video(b)],[video(b)]).inferred.length,0,'removal-only edits are not replacement');
assert.equal(reconcileReplacements([video(a)],[video(c,'members')]).inferred.length,0,'never guess across public/member lists');
assert.equal(reconcileReplacements([video(a),video(b,'members')],[video(c),video(d,'members')]).inferred.length,2,'one pair per audience can be inferred independently');
assert.throws(()=>reconcileReplacements([video(a)],[video(c),video(d)]),/Ambiguous/);assert.throws(()=>reconcileReplacements([video(a),video(b)],[video(c),video(d)]),/Ambiguous/);
result=reconcileReplacements([video(a)],[video(c),video(d)],[{from:a,to:c,visibility:'public'}]);assert.deepEqual(result.videos.find(v=>v.id===c).replaces,[a]);assert.equal(result.videos.find(v=>v.id===d).replaces,undefined,'explicit fallback supports a mixed batch');
assert.equal(publishedNotificationLibrary([video(c),video(d)],result.videos)[0].replaces[0],a);assert.throws(()=>publishedNotificationLibrary([video(a)],result.videos),/not ready/);
assert.equal(publicationRevisionDecision('new','old',(a,b)=>a==='old'&&b==='new'),'skip');assert.equal(publicationRevisionDecision('old','new',(a,b)=>a==='old'&&b==='new'),'apply');assert.throws(()=>publicationRevisionDecision('unrelated','new',()=>false),/unrelated/);
// Exercise the actual Firestore transaction body without credentials or network access.
const source=await readFile('tools/push/sync-members.mjs','utf8'),body=source.slice(source.indexOf("if (process.env.DRY_RUN"));
async function sync(previous,current,previousRevision){const writes=[];await vm.runInNewContext('(async()=>{'+body+'})()',{current,declared:[],revision:'new',isAncestor:()=>true,publicationRevisionDecision,reconcileReplacements,Buffer,process:{env:{FIREBASE_SERVICE_ACCOUNT:'{}'}},cert:v=>v,initializeApp(){},FieldValue:{serverTimestamp:()=>1},getFirestore:()=>({doc:()=>({path:'library'}),runTransaction:async fn=>fn({get:async()=>({exists:true,data:()=>({videos:previous,revision:previousRevision})}),set:(ref,value)=>writes.push(value)})}),console:{log(){}}});return writes;}
const writes=await sync([video(a)],[video(c)]);assert.deepEqual(Array.from(writes[0].videos[0].replaces),[a]);assert.equal((await sync([video(c)],[video(a)],'newer')).length,0,'an older deployment leaves published state untouched');await assert.rejects(sync([video(a)],[video(c),video(d)]),/Ambiguous/);
console.log('PASS: automatic replacement/addition/removal/reorder detection, audience boundaries, repeated versions, ambiguous batches, stale deploy protection, synchronized notification metadata and actual sync transaction.');
