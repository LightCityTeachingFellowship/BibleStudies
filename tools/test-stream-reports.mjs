import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createStreamReports,youtubeState,playlistEvidence,notifyStreamReport} from './members/functions/stream-reports.mjs';
class Fail extends Error{constructor(code,message){super(message);this.code=code;}}
const hash=s=>createHash('sha256').update(s).digest('hex'),id='abcdefghijk',now=Date.parse('2026-10-28T10:00:00Z');
const liveItem={id,snippet:{liveBroadcastContent:'live'},liveStreamingDetails:{actualStartTime:'2026-10-28T09:00:00Z'}};
assert.equal(youtubeState({...liveItem,liveStreamingDetails:{...liveItem.liveStreamingDetails,actualEndTime:'2026-10-28T09:59:00Z'}}).state,'ended','end time overrides stale live flag');
assert.equal(youtubeState({snippet:{liveBroadcastContent:'live'}}).state,'unknown','live label alone is insufficient');
const playlist='#EXTM3U\n#EXT-X-PROGRAM-DATE-TIME:2026-10-28T09:59:55Z\n#EXTINF:4.0,\nsegment-000001.ts';assert.equal(playlistEvidence(playlist,now).fresh,true);assert.equal(playlistEvidence(playlist+'\n#EXT-X-ENDLIST',now).fresh,false);assert.equal(playlistEvidence(playlist,now+120000).fresh,false);
function fixture({states=[liveItem],fresh=true}={}){
 const rows=new Map([['churchVideoLibrary/current',{videos:[{id,title:'Prayer meeting',visibility:'public'}]}]]),writes=[],requests=[];
 function doc(path){return {path,id:path.split('/').at(-1),get:async()=>({id:path.split('/').at(-1),ref:doc(path),exists:rows.has(path),data:()=>rows.get(path)}),set:async(v,o)=>{writes.push(path);rows.set(path,o?.merge?{...rows.get(path),...v}:v);},delete:async()=>rows.delete(path)};}
 const collection=path=>({get:async()=>({docs:await Promise.all([...rows.keys()].filter(k=>k.startsWith(path+'/')&&!k.slice(path.length+1).includes('/')).map(k=>doc(k).get()))}),orderBy(){return this;},limit(){return this;}});
 const db={doc,collection,getAll:async(...refs)=>Promise.all(refs.map(r=>r.get())),runTransaction:async fn=>fn({get:r=>r.get(),set:(r,v,o)=>r.set(v,o)})};
 let count=0,clock=now,relayChecks=0;
 const auth={verifyIdToken:async token=>{if(token!=='valid-device')throw Error();return {uid:'device'};},getUser:async uid=>({uid,email:'admin@example.com',emailVerified:true,providerData:[{}]}),getUserByEmail:async()=>({uid:'admin',emailVerified:true})};
 const deps={db,auth,fail:Fail,emails:()=> 'admin@example.com',key:()=> 'private-key',now:()=>clock,pause:async()=>{},live:{catalog:async()=>[{videoId:id,active:true}],sign:async()=>({url:'https://relay.test/audio.m3u8'})},send:async url=>{requests.push(String(url));if(String(url).includes('youtube/v3'))return Response.json({items:[states[Math.min(count++,states.length-1)]]});return new Response(fresh?playlist.replace('segment-000001.ts','segment-'+String(++relayChecks).padStart(6,'0')+'.ts'):playlist+'\n#EXT-X-ENDLIST');}};
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