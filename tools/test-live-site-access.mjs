import assert from 'node:assert/strict';
import worker from './live-audio/cloud/worker.mjs';
import { createLiveAudio, liveOrigin } from './members/functions/live-audio.mjs';
import { createMemberHandlers } from './members/functions/core.mjs';
import { registerBroadcast, videoId } from './live-audio/publish-site.mjs';
import { checkedLiveLink } from '../script/live-media.js';
const objects = new Map(); let touches = 0;
const bucket = {
  async put(key, body, options) { touches++; objects.set(key, { body: String(body), metadata: options.customMetadata, uploaded: new Date() }); },
  async get(key) { touches++; const item = objects.get(key); return item ? { ...item, text: async () => item.body, body: new Response(item.body).body, size: item.body.length } : null; },
  async list({ prefix }) { touches++; return { objects: [...objects].filter(([key]) => key.startsWith(prefix)).map(([key, item]) => ({ key, customMetadata: item.metadata })), truncated: false }; }
};
const upload = 'a'.repeat(64), playback = 'b'.repeat(64), origin = 'https://lightcity-live-audio-test.example.workers.dev';
const env = { AUDIO: bucket, LIVE_UPLOAD_KEY: upload, LIVE_PLAYBACK_KEY: playback };
const send = (url, options) => worker.fetch(new Request(url, options), env);
const session = 'session-1792874042803', publicId = 'R42uVd9spDw', privateId = '0xma1jqVwsg';
const manifest = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:EVENT\n#EXTINF:4.000000,\n#EXT-X-PROGRAM-DATE-TIME:2026-10-24T20:00:00.000Z\nsegment-000000.ts\n';
objects.set(`live-test/${session}/audio.m3u8`, { body: manifest, uploaded: new Date() });
const entry = { videoId: publicId, session, title: 'Live teaching', visibility: 'public', offsetSeconds: 0.5, active: true, expiresAt: Date.now() + 3600000 };
assert.equal((await send(origin + '/catalog')).status, 403); assert.equal(touches, 0);
await assert.rejects(registerBroadcast({ origin, uploadKey: playback, entry, send }), /403/);
await registerBroadcast({ origin, uploadKey: upload, entry, send });
await registerBroadcast({ origin, uploadKey: upload, entry: { ...entry, videoId: privateId, visibility: 'public' }, send });
const live = createLiveAudio(() => ({ origin, secret: playback }), { send, cacheMs: 0 });
class Failure extends Error { constructor(code, message) { super(message); this.code = code; } }
let active = true, verified = true, disabled = false, checks = 0, libraryAvailable = true;
const handlers = createMemberHandlers({ live, fail: Failure, secret: () => '', auth: { getUser: async () => { checks++; return { disabled, emailVerified: verified }; } }, db: { doc: path => ({ get: async () => ({ exists: path !== 'churchVideoLibrary/current' || libraryAvailable, data: () => path === 'churchVideoLibrary/current' ? { videos: [{ id: publicId, visibility: 'public' }, { id: privateId, visibility: 'members' }] } : { active } }) }) } });
assert.deepEqual((await handlers.getChurchLiveAudio({ data: {} })).recordings.map(item => item.videoId), [publicId]); assert.equal(checks, 0);
libraryAvailable = false; await assert.rejects(handlers.getChurchLiveAudio({ data: {} }), error => error.code === 'unavailable'); libraryAvailable = true;
await registerBroadcast({ origin, uploadKey: upload, entry: { ...entry, videoId: 'unknown1234' }, send });
assert.deepEqual((await handlers.getChurchLiveAudio({ data: {} })).recordings.map(item => item.videoId), [publicId]);
const signed = await handlers.getChurchLiveAudio({ data: { videoId: publicId } });
assert.equal(checkedLiveLink(signed, publicId, session), signed.url);
let response = await send(signed.url, { headers: { Origin: 'https://lightcityfellowship.com' } });
assert.equal(response.status, 200); assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://lightcityfellowship.com');
assert.match(await response.text(), /segment-000000.ts\?token=/);
assert.equal((await send(signed.url, { headers: { Origin: 'https://untrusted.example' } })).status, 403);
assert.equal((await send(origin + '/live/' + session + '/audio.m3u8?token=forged')).status, 403);
await assert.rejects(handlers.getChurchLiveAudio({ data: { videoId: privateId } }), error => error.code === 'unauthenticated');
const request = { auth: { uid: 'member' }, data: { includeMembers: true } };
assert.equal((await handlers.getChurchLiveAudio(request)).recordings.length, 2);
assert.equal((await handlers.getChurchLiveAudio({ ...request, data: { videoId: privateId } })).kind, 'live');
active = false; await assert.rejects(handlers.getChurchLiveAudio(request), error => error.code === 'permission-denied'); active = true;
verified = false; await assert.rejects(handlers.getChurchLiveAudio(request), error => error.code === 'failed-precondition'); verified = true;
disabled = true; await assert.rejects(handlers.getChurchLiveAudio(request), error => error.code === 'permission-denied'); disabled = false;
await assert.rejects(handlers.getChurchLiveAudio({ data: { videoId: '../object' } }), error => error.code === 'invalid-argument');
assert.throws(() => checkedLiveLink({ ...signed, session: 'session-1792874042804' }, publicId, session));
assert.throws(() => checkedLiveLink({ ...signed, url: 'https://untrusted.example/audio.m3u8' }, publicId, session));
assert.throws(() => liveOrigin('https://example.com')); assert.throws(() => videoId('https://example.com/live/' + publicId));
assert.equal(videoId('https://youtube.com/live/' + publicId + '?feature=share'), publicId);
assert.equal(videoId('https://youtu.be/' + publicId), publicId);
objects.get(`live-test/${session}/audio.m3u8`).uploaded = new Date(Date.now() - 91000);
assert.equal((await live.catalog()).length, 0, 'stopped upload must not advertise an active broadcast');
objects.get(`live-test/${session}/audio.m3u8`).uploaded = new Date();
objects.get(`live-test/${session}/audio.m3u8`).body += '#EXT-X-ENDLIST\n';
assert.ok((await live.catalog()).every(item => item.replay === true && item.active === false), 'completed playlists remain available as replay, not live');
console.log('PASS: owner-only registration, public/member separation, revoked/disabled/unverified accounts, capability scope, browser CORS, strict playback URLs, and stale/ended broadcast filtering.');
