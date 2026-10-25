import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { discoverBroadcast, youtubeVideos } from './automatic/discovery.mjs';
import { AutomaticPublisher } from './automatic/engine.mjs';
import { validControl } from './automatic/helper.mjs';
import { startCapture } from './automatic/capture.mjs';
const run = promisify(execFile), id = 'abcdefghijk', member = 'lmnopqrstuv', channel = 'UC' + 'a'.repeat(22);
const library = Array.from({ length: 1000 }, (_, i) => ({ id: String(i).padStart(11, '0'), visibility: 'public' }));
let batches = 0;
assert.equal((await discoverBroadcast(library, async ids => { batches++; assert.ok(ids.length <= 50); return ids.includes(library[999].id) ? [{ id: library[999].id, title: 'Live', live: true }] : []; })).video.id, library[999].id);
assert.equal(batches, 20);
assert.equal((await discoverBroadcast([{ id }, { id: member }], async ids => ids.map(id => ({ id, title: 'Live', live: true })))).video, null);
assert.equal((await discoverBroadcast([{ id }], async () => [{ id, title: 'Ended', live: false }])).video, null);
const records = await youtubeVideos([id, member], { apiKey: 'x'.repeat(39), channelId: channel, send: async () => Response.json({ items: [
 { id, snippet: { title: 'Live', channelId: channel, liveBroadcastContent: 'live' }, liveStreamingDetails: { actualStartTime: new Date().toISOString() }, status: { privacyStatus: 'unlisted' } },
 { id: member, snippet: { title: 'Other channel', channelId: 'UC' + 'b'.repeat(22), liveBroadcastContent: 'live' }, liveStreamingDetails: { actualStartTime: new Date().toISOString() }, status: { privacyStatus: 'public' } }
] }) });
assert.equal(records.length, 1); assert.equal(records[0].live, true);
let declarations = [{ id, visibility: 'members' }], registrations = [], ended = false, now = Date.now();
const context = { folder: '.', session: 'session-1792874042803', streamStartedAt: now - 10000, captureStartedAt: now, ended: false };
const engine = new AutomaticPublisher({ context, origin: 'unused', uploadKey: 'unused', library: async () => declarations, lookup: async () => [{ id, title: 'Automatic title', live: true }], now: () => now,
 publish: async () => ({ ended }), register: async ({ entry }) => registrations.push(entry) });
await engine.tick(); assert.equal(registrations[0].visibility, 'members'); assert.equal(registrations[0].offsetSeconds, -10);
declarations = [{ id, visibility: 'public' }]; await engine.tick(); assert.equal(registrations.at(-1).visibility, 'public');
ended = true; await engine.tick(); assert.equal(registrations.at(-1).active, false); assert.equal(engine.retired, true);
// When YouTube ends before OBS capture, retain the entry until the last audio is uploaded.
let captureEnded = false, finalWrites = [], probes = 0;
const finishingContext = { ...context, ended: false };
const finishing = new AutomaticPublisher({ context: finishingContext, origin: 'unused', uploadKey: 'unused', now: () => now,
 library: async () => [{ id, visibility: 'public' }], lookup: async () => [{ id, title: 'Live', live: ++probes === 1 }],
 publish: async () => ({ ended: captureEnded }), register: async ({ entry }) => finalWrites.push(entry) });
await finishing.tick(); now += 31000; await finishing.tick();
assert.equal(finishing.retired, true); assert.ok(finishing.entry, 'do not discard entry before capture finalizes');
await assert.rejects(finishing.close({ keepReplay: true }), /finalized/);
assert.equal(finalWrites.length, 1, 'never close before final playlist upload succeeds');
captureEnded = true; await finishing.close({ keepReplay: true });
assert.equal(finalWrites.at(-1).active, false); assert.equal(finishing.entry, null);
// A list edit during upload must be rechecked before any registration.
let reads = 0, raced = [];
const race = new AutomaticPublisher({ context: { ...context, ended: false }, origin: 'unused', uploadKey: 'unused',
 library: async () => ++reads < 3 ? [{ id, visibility: 'public' }] : [],
 lookup: async () => [{ id, title: 'Live', live: true }], publish: async () => ({ ended: false }), register: async x => raced.push(x) });
await race.tick(); assert.equal(raced.length, 0);
const abort = new AbortController();
const interrupted = new AutomaticPublisher({ context: { ...context, ended: false }, origin: 'unused', uploadKey: 'unused',
 library: async () => [{ id, visibility: 'public' }], lookup: async () => [{ id, title: 'Live', live: true }],
 publish: async () => { abort.abort(); return { ended: false }; }, register: async x => raced.push(x) });
await interrupted.tick(abort.signal); assert.equal(raced.length, 0);
const cancelled = new AbortController(); cancelled.abort();
await assert.rejects(discoverBroadcast([{ id }], async () => [], cancelled.signal), /Cancelled/);
assert.ok(validControl({ version: 1, profile: 'normal', streaming: false, updatedAt: now }, 'normal', now));
assert.ok(!validControl({ version: 1, profile: 'test', streaming: true, updatedAt: now }, 'normal', now));
assert.ok(!validControl({ version: 1, profile: 'normal', streaming: false, updatedAt: now - 16000 }, 'normal', now));
const root = resolve('tools/live-audio/work'), temp = join(root, 'automatic-fixture-' + Date.now());
await mkdir(temp);
try {
 const ffmpeg = resolve('tools/audio-pilot/runtime/ffmpeg.exe'), source = join(temp, 'source.aac');
 await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '9', '-c:a', 'aac', '-b:a', '128k', '-f', 'adts', source], { windowsHide: true });
 const socket = new PassThrough();
 const capture = await startCapture({ socket, folder: join(temp, 'session'), ffmpeg, streamStartedAt: now, captureStartedAt: now });
 socket.end(await readFile(source));
 const report = await capture.completed;
 assert.equal(report.ended, true); assert.ok(report.segments.length >= 2); assert.ok(report.durationSeconds >= 9);
 await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', join(temp, 'session/audio.m3u8'), '-f', 'null', '-'], { windowsHide: true });
} finally {
 if (!temp.startsWith(root + '\\')) throw Error('Invalid fixture cleanup path');
 await rm(temp, { recursive: true, force: true });
}
console.log('PASS: thousand-ID matching, ambiguity, channel checks, member/public updates, stream end, control freshness, and real 128 kbps AAC capture/finalization/decoding.');
