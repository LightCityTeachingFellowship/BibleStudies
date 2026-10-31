import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createStreamReports,youtubeState,playlistEvidence,notifyStreamReport} from './members/functions/stream-reports.mjs';
class Fail extends Error{constructor(code,message){super(message);this.code=code;}}
const hash=s=>createHash('sha256').update(s).digest('hex'),id='abcdefghijk',now=Date.parse('2026-10-28T10:00:00Z');
const liveItem={id,snippet:{liveBroadcastContent:'live'},liveStreamingDetails:{actualStartTime:'2026-10-28T09:00:00Z'}};
assert.equal(youtubeState({...liveItem,liveStreamingDetails:{...liveItem.liveStreamingDetails,actualEndTime:'2026-10-28T09:59:00Z'}}).state,'ended','end time overrides stale live flag');
assert.equal(youtubeState({snippet:{liveBroadcastContent:'live'}}).state,'unknown','live label alone is insufficient');
const playlist='#EXTM3U\n#EXT-X-PROGRAM-DATE-TIME:2026-10-28T09:59:55Z\n#EXTINF:4.0,\nsegment-000001.ts';assert.equal(playlistEvidence(playlist,now).fresh,true);assert.equal(playlistEvidence(playlist+'\n#EXT-X-ENDLIST',now).fresh,false);assert.equal(playlistEvidence(playlist,now+120000).fresh,false);
function fixture({states=[liveItem],fresh=true,relayPresent=true}={}){
 const rows=new Map([['churchVideoLibrary/current',{videos:[{id,title:'Prayer meeting',visibility:'public'}]}]]),writes=[],requests=[];
 function doc(path){return {path,id:path.split('/').at(-1),get:async()=>({id:path.split('/').at(-1),ref:doc(path),exists:rows.has(path),data:()=>rows.get(path)}),set:async(v,o)=>{writes.push(path);rows.set(path,o?.merge?{...rows.get(path),...v}:v);},delete:async()=>rows.delete(path)};}
 const collection=path=>({get:async()=>({docs:await Promise.all([...rows.keys()].filter(k=>k.startsWith(path+'/')&&!k.slice(path.length+1).includes('/')).map(k=>doc(k).get()))}),where(field,_operator,value){const read=this.get;return {get:async()=>({docs:(await read()).docs.filter(d=>d.data()?.[field]===value)})};},orderBy(){return this;},limit(){return this;}});
 const db={doc,collection,getAll:async(...refs)=>Promise.all(refs.map(r=>r.get())),runTransaction:async fn=>fn({get:r=>r.get(),set:(r,v,o)=>r.set(v,o)})};
 let count=0,clock=now,relayChecks=0;
 const auth={verifyIdToken:async token=>{if(token!=='valid-device')throw Error();return {uid:'device'};},getUser:async uid=>({uid,email:'admin@example.com',emailVerified:true,providerData:[{}]}),getUserByEmail:async()=>({uid:'admin',emailVerified:true})};
 const deps={db,auth,fail:Fail,emails:()=> 'admin@example.com',key:()=> 'private-key',now:()=>clock,pause:async()=>{},live:{catalog:async()=>relayPresent?[{videoId:id,active:true}]:[],sign:async()=>({url:'https://relay.test/audio.m3u8'})},send:async url=>{requests.push(String(url));if(String(url).includes('youtube/v3'))return Response.json({items:[states[Math.min(count++,states.length-1)]]});return new Response(fresh?playlist.replace('segment-000001.ts','segment-'+String(++relayChecks).padStart(6,'0')+'.ts'):playlist+'\n#EXT-X-ENDLIST');}};
 return {db,auth,rows,writes,requests,service:createStreamReports(deps),advance:()=>clock+=31000};
}
const request=issue=>({data:{videoId:id,issue,senderName:'Visitor One',deviceToken:'valid-device'},rawRequest:{ip:'test'}});
let f=fixture();assert.equal((await f.service.submit(request('ended'))).state,'still-live');assert.ok(!f.writes.some(p=>p.includes('/reports/')));
await assert.rejects(f.service.submit(request('ended')),e=>e.code==='resource-exhausted');
f=fixture({fresh:false});assert.equal((await f.service.submit(request('ended'))).state,'uncertain');assert.ok(!f.writes.some(p=>p.includes('/reports/')),'stale relay plus live flag cannot generate an ended alert');
const ended={...liveItem,liveStreamingDetails:{...liveItem.liveStreamingDetails,actualEndTime:'2026-10-28T09:59:58Z'}};
f=fixture({states:[liveItem,ended]});assert.equal((await f.service.submit(request('ended'))).state,'reported','second check catches delayed end timestamp');f.advance();await f.service.submit(request('ended'));const reports=[...f.rows].filter(([p])=>p.includes('/reports/'));assert.equal(reports.length,1);assert.equal(reports[0][1].count,2);
f=fixture();assert.equal((await f.service.submit(request('volume'))).state,'reported');assert.equal([...f.rows.values()].find(r=>r.issue==='volume').verified,false,'volume request is viewer feedback, not a measured change');
f=fixture({states:[ended]});assert.equal((await f.service.submit(request('volume'))).state,'ended');assert.ok(!f.writes.some(p=>p.includes('/reports/')));
f=fixture();f.rows.set('churchVideoLibrary/current',{videos:[{id,visibility:'members'}]});await assert.rejects(f.service.submit(request('ended')),e=>e.code==='permission-denied');assert.equal(f.requests.length,0);
await assert.rejects(f.service.submit({...request('ended'),data:{videoId:'bad',issue:'ended',deviceToken:'valid-device'}}),e=>e.code==='invalid-argument');await assert.rejects(f.service.submit({...request('ended'),data:{videoId:id,issue:'ended',deviceToken:'bad'}}),e=>e.code==='unauthenticated');
f=fixture({states:[ended]});await f.service.submit(request('ended'));const [reportPath]=[...f.rows.keys()].filter(p=>p.includes('/reports/'));const reportId=reportPath.split('/').at(-1);let sends=[];
f.rows.set('churchStudioPublications/private-test-'+hash('admin')+'/devices/phone',{});f.rows.set('webPushSubscribers/phone',{token:'admin-token'});f.rows.set('webPushSubscribers/ordinary',{token:'member-token'});
const notify={id:reportId,db:f.db,auth:f.auth,emails:()=> 'admin@example.com',now:()=>now,messaging:{sendEachForMulticast:async data=>{sends.push(data);return {responses:[{}]};}}};await notifyStreamReport(notify);await notifyStreamReport(notify);assert.equal(sends.length,1);assert.deepEqual(sends[0].tokens,['admin-token']);assert.equal(sends[0].data.url,'https://lightcityfellowship.com/Admin/?reports=1');
console.log('PASS: stale live flags, independent relay evidence, delayed end detection, uncertain-no-alert, volume feedback, access/rate checks, grouped reports, admin-only push targets and delivery deduplication.');

// Named custom messages are private, independent records and do not depend on YouTube status.
f=fixture({fresh:false});
await assert.rejects(f.service.submit({...request('message'),data:{...request('message').data,senderName:'',message:'Question'}}),e=>e.code==='invalid-argument');
await assert.rejects(f.service.submit({...request('message'),data:{...request('message').data,message:' '.repeat(5)}}),e=>e.code==='invalid-argument');
await assert.rejects(f.service.submit({...request('message'),data:{...request('message').data,message:'x'.repeat(2001)}}),e=>e.code==='invalid-argument');
const sendMessage=text=>f.service.submit({...request('message'),data:{...request('message').data,message:text}});
assert.equal((await sendMessage('What does this passage mean?')).state,'reported');f.advance();await sendMessage('My answer: love your neighbour.');
let messages=[...f.rows.values()].filter(v=>v.issue==='message');assert.equal(messages.length,2,'questions/answers never collapse into one grouped issue');assert.equal(messages[0].message,'What does this passage mean?');assert.equal(messages[0].sender.name,'Visitor One');assert.equal(messages[0].sender.source,'visitor');assert.equal(f.requests.length,0,'custom messages bypass stream verification');
f=fixture();f.auth.getUser=async uid=>({uid,emailVerified:true,displayName:'Google Account Name',providerData:[{}]});
await f.service.submit({auth:{uid:'member'},data:{...request('message').data,senderName:'Forged name',message:'<img onerror=alert(1)>\nA question'}});
const stored=[...f.rows.values()].find(v=>v.issue==='message');assert.equal(stored.sender.name,'Google Account Name');assert.equal(stored.sender.source,'account');assert.equal(stored.message,'<img onerror=alert(1)>\nA question','message is stored as plain text');
f.auth.getUser=async()=>({disabled:true});await assert.rejects(f.service.submit({auth:{uid:'disabled'},data:{...request('message').data,message:'Question'}}),e=>e.code==='permission-denied');
console.log('PASS: required sender names, message length, independent questions/answers, no YouTube gate, authoritative account names and disabled-account rejection.');
assert.equal(sends[0].webpush.notification.requireInteraction,true,'admin feedback requests persistent automatic background display');
assert.equal(sends[0].data.requireInteraction,'true','foreground delivery retains the persistence request');
console.log('PASS: admin feedback requests persistent alerts in both delivery paths.');
f=fixture();
for(let i=0;i<40;i++)f.rows.set('churchStudioPublications/stream-issues/reports/'+String(i).padStart(64,'0'),{resolved:true,createdAt:now+i});
const oldId='e'.repeat(64);f.rows.set('churchStudioPublications/stream-issues/reports/'+oldId,{resolved:false,createdAt:now-100000,title:'Older unresolved report'});
const remaining=await f.service.inbox({auth:{uid:'admin'},data:{}});assert.equal(remaining.reports.length,1);assert.equal(remaining.reports[0].id,oldId);
console.log('PASS: old unresolved reports remain available after more than 30 recent handled reports.');

// Private tests stay outside the published library, use real status checks and target their owner only.
const privateRoot='churchStudioPublications/private-test-'+hash('admin');
const privateRequest=issue=>({...request(issue),auth:{uid:'admin'},data:{...request(issue).data,privateTest:true,message:'Private test question'}});
const preparePrivate=options=>{const item=fixture(options);item.rows.set('churchVideoLibrary/current',{videos:[]});item.rows.set(privateRoot+'/videos/'+id,{videoId:id,title:'Private prayer test'});return item;};
f=preparePrivate({relayPresent:false});assert.equal((await f.service.submit(privateRequest('message'))).state,'reported');
let privateReports=[...f.rows.entries()].filter(([p,r])=>p.includes('/reports/')&&r.privateTest);assert.equal(privateReports.length,1);assert.equal(privateReports[0][1].testOwner,'admin');assert.equal(f.requests.length,0);assert.deepEqual(f.rows.get('churchVideoLibrary/current').videos,[]);
const privateId=privateReports[0][0].split('/').at(-1);assert.equal((await f.service.inbox({auth:{uid:'other-admin'}})).reports.length,0,'another admin cannot read the private test report');
await assert.rejects(f.service.resolve({auth:{uid:'other-admin'},data:{reportId:privateId}}),e=>e.code==='not-found');
f.rows.set(privateRoot+'/devices/phone',{});f.rows.set('webPushSubscribers/phone',{token:'owner-phone'});f.rows.set('churchStudioPublications/private-test-'+hash('other-admin')+'/devices/other',{});f.rows.set('webPushSubscribers/other',{token:'other-admin-phone'});
let privateSends=[];f.auth.getUserByEmail=async email=>({uid:email==='admin@example.com'?'admin':'other-admin',emailVerified:true});
await notifyStreamReport({id:privateId,db:f.db,auth:f.auth,emails:()=> 'admin@example.com,other@example.com',messaging:{sendEachForMulticast:async data=>{privateSends.push(data);return {responses:[{}]};}}});assert.equal(privateSends.length,1);assert.deepEqual(privateSends[0].tokens,['owner-phone']);assert.match(privateSends[0].notification.title,/Private test/);
f=preparePrivate({relayPresent:false});assert.equal((await f.service.submit(privateRequest('volume'))).state,'reported','private volume feedback works without a public relay');
f=preparePrivate({relayPresent:false});assert.equal((await f.service.submit(privateRequest('ended'))).state,'uncertain');assert.ok(![...f.rows.keys()].some(p=>p.includes('/reports/')),'private tests cannot bypass ended-stream verification');
f=preparePrivate({states:[ended],relayPresent:false});assert.equal((await f.service.submit(privateRequest('ended'))).state,'reported');
f=preparePrivate();await assert.rejects(f.service.submit({...privateRequest('message'),auth:{uid:'other-admin'}}),e=>e.code==='not-found');
await assert.rejects(f.service.submit({...privateRequest('message'),auth:null}),e=>e.code==='unauthenticated');
f.auth.getUser=async uid=>({uid,email:'member@example.com',emailVerified:true,providerData:[{}]});await assert.rejects(f.service.submit(privateRequest('message')),e=>e.code==='permission-denied');
console.log('PASS: private preview ownership, real ended-stream verification, volume without a relay, private inbox/resolve access and owner-only notification targets.');

// No-sound feedback must not depend on a healthy relay, and is not proof a stream ended.
f=fixture({relayPresent:false,states:[{}]});assert.equal((await f.service.submit(request('no-sound'))).state,'reported');
const noSoundEntry=[...f.rows.entries()].find(([p,r])=>p.includes('/reports/')&&r.issue==='no-sound');assert.equal(noSoundEntry[1].verified,false);assert.match(noSoundEntry[1].message,/No sound/);assert.equal(noSoundEntry[1].sender.name,'Visitor One');
assert.ok(f.requests.every(url=>!url.includes('relay.test')),'a sound fault can be reported when the relay is unavailable');
const {cleanReports}=await import('./studio-desktop/core.mjs');const compatible=cleanReports([{id:noSoundEntry[0].split('/').at(-1),...noSoundEntry[1]}]);assert.match(compatible[0].message,/No sound/,'the installed Windows alert panel retains readable fault details');
f.rows.set(privateRoot+'/devices/phone',{});f.rows.set('webPushSubscribers/phone',{token:'admin-token'});let soundAlert;
await notifyStreamReport({id:noSoundEntry[0].split('/').at(-1),db:f.db,auth:f.auth,emails:()=> 'admin@example.com',messaging:{sendEachForMulticast:async data=>{soundAlert=data;return {responses:[{}]};}}});assert.equal(soundAlert.notification.title,'No sound on the stream');assert.match(soundAlert.notification.body,/no sound/i);
f=preparePrivate({relayPresent:false});assert.equal((await f.service.submit(privateRequest('no-sound'))).state,'reported');assert.equal([...f.rows.values()].find(v=>v.issue==='no-sound').testOwner,'admin');
f=fixture({states:[ended]});assert.equal((await f.service.submit(request('no-sound'))).state,'ended');assert.ok(![...f.rows.keys()].some(p=>p.includes('/reports/')));
console.log('PASS: no-sound reports, missing-relay tolerance, sender identity, private scope, known-ended guidance, push text and installed-Windows compatibility.');
