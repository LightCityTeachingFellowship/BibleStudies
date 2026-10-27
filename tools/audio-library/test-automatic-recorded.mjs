import assert from 'node:assert/strict';
import { tick, updateQueue, registerRecording, downloadBudget, YOUTUBE_SPACING, DOWNLOAD_WINDOW, DAILY_DOWNLOAD_LIMIT } from './automatic.mjs';
const a = 'abcdefghijk', b = 'ABCDEFGHIJK', c = '12345678901';
const state = { version: 1, seenIds: [a], jobs: {} };
updateQueue(state, [{ id: a }, { id: b }], [], 1000);
assert.equal(state.jobs[a], undefined, 'baseline library does not start a thousand downloads');
assert.equal(state.jobs[b].phase, 'pending');
let library = [{ id: b, visibility: 'members' }], downloads = 0, uploads = 0, registrations = 0, cleans = 0, saved = 0, time = 1000;
const r = { videoId: b, title: 'Final upload', file: 'local-file', bytes: 10, sha256: 'a'.repeat(64), audioDurationSeconds: 42, status: 'local audio verified' };
const options = { state, catalog: [], now: () => time, library: async () => library,
  download: async id => { assert.equal(id, b); downloads++; return [r]; },
  remote: async () => { uploads++; }, register: async () => { registrations++; }, cleanup: async () => { cleans++; }, persist: async () => { saved++; } };
await tick(options);
assert.equal(state.jobs[b].phase, 'published'); assert.equal(downloads, 1); assert.equal(uploads, 1); assert.equal(registrations, 1); assert.equal(cleans, 1);
await tick(options); assert.equal(downloads, 1, 'published queue entry never downloads again');
const pending = { version: 1, seenIds: [], jobs: {} };
let fail = true;
const interrupted = { ...options, state: pending, remote: async () => { if (fail) throw Error('storage offline'); } };
await tick(interrupted); assert.equal(pending.jobs[b].phase, 'retry'); assert.equal(cleans, 1, 'failed upload cannot delete local audio');
library.push({ id: c });
await tick(interrupted); assert.equal(pending.jobs[c].phase, 'pending'); assert.equal(downloads, 2, 'one retained artifact blocks accumulating downloads');
fail = false; time = pending.jobs[b].nextAttempt;
await tick(interrupted); assert.equal(pending.jobs[b].phase, 'published'); assert.equal(downloads, 2, 'upload retry reuses downloaded audio');
const waiting = { version: 1, seenIds: [], jobs: {} };
library = [{ id: b }];
await tick({ ...options, state: waiting, download: async () => [{ status: 'waiting for replay', reason: 'Processing' }] });
assert.equal(waiting.jobs[b].phase, 'waiting'); assert.equal(waiting.jobs[b].attempts, 0);
const removed = { version: 1, seenIds: [], jobs: {} };
let calls = 0;
await tick({ ...options, state: removed, library: async () => ++calls < 2 ? [{ id: b }] : [] });
assert.equal(removed.jobs[b].phase, 'removed');
assert.equal(cleans, 2, 'removed-before-upload does not clean/publish');
const credential = 'b'.repeat(64);
const registered = await registerRecording(r, { origin: 'https://audio.example.workers.dev', uploadKey: credential, send: async (url, init) => {
  assert.ok(url.endsWith('/' + b + '.json')); assert.equal(init.headers.Authorization, 'Bearer ' + credential);
  const body = JSON.parse(init.body); assert.equal(body.objectKey, `audio/${b}.m4a`); assert.equal(body.durationSeconds, 42); assert.ok(!('file' in body));
  return Response.json({ registered: true, videoId: b, sha256: r.sha256 });
} });
assert.equal(registered.videoId, b);
assert.ok(saved > 5);
console.log('PASS: baseline excludes backlog, new IDs queue, automatic download/upload/register/cleanup, durable retry without duplicate download, processing waits, bounded retained files, and removal checks.');

const blocked={version:1,seenIds:[a,b],jobs:{[a]:{videoId:a,phase:'pending',attempts:0,nextAttempt:0},[b]:{videoId:b,phase:'pending',attempts:0,nextAttempt:0}}};
let checks=0, clock=1000;
const restricted={state:blocked,catalog:[],library:async()=>[{id:a},{id:b}],now:()=>clock,persist:async()=>{},download:async()=>{checks++;return [{status:'needs retry',reason:'YouTube requested a sign-in/bot check. No browser login or cookies were accessed.'}];}};
await tick(restricted);assert.equal(checks,1);assert.equal(blocked.jobs[a].attempts,0);assert.equal(blocked.jobs[b].phase,'pending');
await tick(restricted);assert.equal(checks,1,'global cooldown must suppress attempts on other pending videos');
clock=blocked.youtubeNotBefore;await tick(restricted);assert.equal(checks,2,'only one probe is allowed after cooldown');
blocked.jobs[b].record=r;blocked.jobs[b].phase='downloaded';blocked.jobs[b].nextAttempt=0;
let published=0;await tick({...restricted,remote:async()=>{},register:async()=>{published++;},cleanup:async()=>{}});assert.equal(published,1,'already downloaded audio can publish during cooldown');
console.log('PASS: bot checks pause the whole download queue, preserve attempts and completed work, allow one later probe, and do not block retained audio uploads.');

const backlog={version:1,seenIds:[a,b,c],backlogEnabled:true,jobs:{[a]:{videoId:a,phase:'published'}}};
updateQueue(backlog,[{id:a},{id:b},{id:c}],[{videoId:c}],1000);
assert.equal(backlog.jobs[a].phase,'published');assert.equal(backlog.jobs[b].phase,'pending');assert.equal(backlog.jobs[c],undefined);
const policyState={youtubeDownloadStarts:Array.from({length:DAILY_DOWNLOAD_LIMIT},(_,i)=>1000+i*YOUTUBE_SPACING),youtubeNotBefore:0};
const end=policyState.youtubeDownloadStarts.at(-1);
let policy=downloadBudget(policyState,end+YOUTUBE_SPACING);
assert.equal(policy.remaining,0);assert.equal(policy.nextAllowed,1000+DOWNLOAD_WINDOW);
assert.equal(downloadBudget(policyState,1000+DOWNLOAD_WINDOW).remaining,1,'rolling quota releases only the expired attempt');
assert.equal(downloadBudget(JSON.parse(JSON.stringify(policyState)),end+YOUTUBE_SPACING).remaining,0,'restart preserves the quota');
const spaced={version:1,seenIds:[a,b],jobs:{[a]:{videoId:a,phase:'pending',attempts:0,nextAttempt:0},[b]:{videoId:b,phase:'pending',attempts:0,nextAttempt:0}}};
let starts=0;clock=1000;
const paceOptions={...restricted,state:spaced,download:async()=>{starts++;throw Error('request timed out');}};
await tick(paceOptions);assert.equal(starts,1);assert.equal(spaced.youtubeDownloadStarts.length,1,'failed attempts count too');
clock+=60000;await tick(paceOptions);assert.equal(starts,1,'failed downloads cannot bypass spacing by trying the next video');
const exhausted={...spaced,youtubeDownloadStarts:policyState.youtubeDownloadStarts};clock=end+YOUTUBE_SPACING;
await tick({...paceOptions,state:exhausted});assert.equal(starts,1,'full rolling quota prevents all fresh YouTube attempts');
exhausted.jobs[b].record=r;exhausted.jobs[b].phase='downloaded';exhausted.jobs[b].nextAttempt=0;
await tick({...paceOptions,state:exhausted,remote:async()=>{},register:async()=>{},cleanup:async()=>{}});assert.equal(exhausted.jobs[b].phase,'published','quota must not block an already downloaded file');
console.log('PASS: full backlog discovery, completed exclusions, 35-attempt rolling daily cap, 40-minute spacing, restart durability, failures counted and retained uploads allowed.');

assert.equal(downloadBudget({jobs:{[a]:{completedAt:new Date(1000).toISOString()}}},2000).starts.length,1,'upgrade counts earlier completed jobs in the daily budget');

const oldBlock={version:1,seenIds:[a],youtubeNotBefore:9999,jobs:{[a]:{videoId:a,phase:'attention',attempts:6,message:'YouTube requested a sign-in/bot check.'}}};updateQueue(oldBlock,[{id:a}],[],1000);assert.equal(oldBlock.jobs[a].phase,'retry');assert.equal(oldBlock.jobs[a].nextAttempt,9999);

// A newly queued replacement goes ahead of older backlog insertion order.
const priority={version:1,seenIds:[a,b],jobs:{[a]:{videoId:a,phase:'pending',attempts:0,nextAttempt:0},[b]:{videoId:b,phase:'pending',attempts:0,nextAttempt:0}}};
let selected;
await tick({...options,state:priority,library:async()=>[{id:b},{id:a}],now:()=>1000,
 download:async id=>{selected=id;return [{status:'waiting for replay',reason:'Processing'}];}});
assert.equal(selected,b,'newest library item is attempted before old backlog');
priority.jobs[a].record={...r,videoId:a};priority.jobs[a].phase='downloaded';priority.jobs[a].nextAttempt=0;
let retainedId;
await tick({...options,state:priority,library:async()=>[{id:b},{id:a}],now:()=>1000,
 remote:async record=>{retainedId=record.videoId;},download:async()=>{throw Error('retained upload must take priority');}});
assert.equal(retainedId,a,'retained audio still uploads first during download spacing');
console.log('PASS: recent replacement priority preserves retained-upload priority and download pacing.');
