import assert from 'node:assert/strict';
import worker from './cloud/worker.mjs';
import { createLiveAudio } from '../members/functions/live-audio.mjs';
import { createMemberHandlers } from '../members/functions/core.mjs';
import { registerBroadcast } from './publish-site.mjs';
const originalNow = Date.now;
let clock = originalNow(); Date.now = () => clock;
try {
  const objects = new Map(); let gets = 0;
  const env = { LIVE_UPLOAD_KEY: 'a'.repeat(64), LIVE_PLAYBACK_KEY: 'b'.repeat(64), AUDIO: {
    async get(key) { gets++; const o = objects.get(key); return o ? { uploaded: o.uploaded, text: async () => o.body, body: new Response(o.body).body, size: o.body.length } : null; },
    async put(key, body, options) { objects.set(key, { body: String(body), uploaded: new Date(clock), customMetadata: options.customMetadata }); },
    async list({ prefix }) { return { objects: [...objects].filter(([k]) => k.startsWith(prefix)).map(([key, o]) => ({ key, customMetadata: o.customMetadata })), truncated: false }; }
  } };
  const origin = 'https://audio.example.workers.dev', session = 'session-1792874042803', id = 'abcdefghijk', edited = 'ABCDEFGHIJK';
  const key = `live-test/${session}/audio.m3u8`;
  const body = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:EVENT\n#EXTINF:4.000000,\n#EXT-X-PROGRAM-DATE-TIME:2026-10-25T20:00:00.000Z\nsegment-000000.ts\n';
  objects.set(key, { body, uploaded: new Date(clock) });
  const send = (url, options) => worker.fetch(new Request(url, options), env);
  const entry = { videoId: id, title: 'Service', session, offsetSeconds: -1, active: true, visibility: 'public', expiresAt: clock + 3600000 };
  await registerBroadcast({ origin, uploadKey: env.LIVE_UPLOAD_KEY, entry, send });
  const live = createLiveAudio(() => ({ origin, secret: env.LIVE_PLAYBACK_KEY }), { send, cacheMs: 0, now: () => clock });
  let policy = [{ id, visibility: 'public' }];
  class Failure extends Error { constructor(code, msg) { super(msg); this.code = code; } }
  const handler = createMemberHandlers({ live, fail: Failure, db: { doc: () => ({ get: async () => ({ exists: true, data: () => ({ videos: policy }) }) }) } });
  const originalLink = await handler.getChurchLiveAudio({ data: { videoId: id } });
  assert.equal(originalLink.replay, false);
  objects.get(key).body += '#EXT-X-ENDLIST\n';
  const immediately = (await handler.getChurchLiveAudio({ data: {} })).recordings[0];
  assert.equal(immediately.replay, true, 'the final playlist immediately bridges to replay');
  assert.equal(immediately.session, originalLink.session);
  const playingResponse = await send(originalLink.url);
  assert.equal(playingResponse.status, 200); assert.ok((await playingResponse.text()).includes('#EXT-X-ENDLIST'), 'current listener keeps the same source URL');
  await registerBroadcast({ origin, uploadKey: env.LIVE_UPLOAD_KEY, entry: { ...entry, active: false }, send });
  clock += 2 * 86400000;
  gets = 0;
  assert.equal((await live.catalog())[0].replay, true, 'replay survives original live expiry and the 90-second freshness window');
  assert.equal(gets, 0, 'retained replay metadata avoids a per-playlist scan');
  const renewed = await handler.getChurchLiveAudio({ data: { videoId: id } });
  assert.equal(renewed.replay, true); assert.equal((await send(renewed.url)).status, 200);
  await assert.rejects(handler.getChurchLiveAudio({ data: { videoId: edited } }), e => e.code === 'not-found', 'edited upload cannot inherit another ID’s replay');
  policy = [{ id, visibility: 'members' }];
  assert.equal((await handler.getChurchLiveAudio({ data: {} })).recordings.length, 0);
  await assert.rejects(handler.getChurchLiveAudio({ data: { videoId: id } }), e => e.code === 'unauthenticated');
  policy = [];
  await assert.rejects(handler.getChurchLiveAudio({ data: { videoId: id } }), e => e.code === 'not-found');
  clock += 6 * 86400000;
  assert.equal((await live.catalog()).length, 0, 'temporary replay retires after seven days');
  console.log('PASS: immediate end-of-live replay, unchanged listener source, inactive registration retention, renewal after two days, scoped video IDs, current member policy, and seven-day expiry.');
} finally { Date.now = originalNow; }
