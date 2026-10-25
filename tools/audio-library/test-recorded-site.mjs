import assert from 'node:assert/strict';
import worker from '../live-audio/cloud/worker.mjs';
import { createRecordedCatalog } from '../members/functions/recorded-catalog.mjs';
import { createMemberHandlers } from '../members/functions/core.mjs';
const objects = new Map(), upload = 'a'.repeat(64), playback = 'b'.repeat(64);
let touches = 0;
const env = { LIVE_UPLOAD_KEY: upload, LIVE_PLAYBACK_KEY: playback, AUDIO: {
  async head(key) { touches++; return objects.get(key) || null; },
  async get(key) { touches++; const o = objects.get(key); return o ? { text: async () => o.body } : null; },
  async put(key, body, options) { touches++; objects.set(key, { body, customMetadata: options.customMetadata }); },
  async list({ prefix }) { touches++; return { objects: [...objects].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, customMetadata: value.customMetadata })), truncated: false }; }
} };
const origin = 'https://audio.example.workers.dev', id = 'abcdefghijk', privateId = 'ABCDEFGHIJK';
const item = { videoId: id, title: 'Final edited upload', objectKey: `audio/${id}.m4a`, bytes: 100, durationSeconds: 42, sha256: 'c'.repeat(64) };
const send = (url, options) => worker.fetch(new Request(url, options), env);
const put = (r, token = upload) => { const body = JSON.stringify(r); return send(`${origin}/upload/recordings/${r.videoId}.json`, { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Length': String(Buffer.byteLength(body)) }, body }); };
assert.equal((await send(origin + '/recordings/catalog')).status, 403); assert.equal(touches, 0);
assert.equal((await put(item, playback)).status, 403);
assert.equal((await put(item)).status, 409, 'must upload audio before registration');
objects.set(item.objectKey, { size: 100, customMetadata: { sha256: item.sha256 } });
assert.equal((await put(item)).status, 200);
assert.equal((await put(item)).status, 200, 'registration retries are idempotent');
assert.equal((await put({ ...item, objectKey: '../secret' })).status, 400);
const changed = { ...item, sha256: 'd'.repeat(64) };
objects.set(item.objectKey, { size: 100, customMetadata: { sha256: changed.sha256 } });
assert.equal((await put(changed)).status, 409, 'different registration cannot overwrite');
objects.set(item.objectKey, { size: 100, customMetadata: { sha256: item.sha256 } });
const privateItem = { ...item, videoId: privateId, objectKey: `audio/${privateId}.m4a` };
objects.set(privateItem.objectKey, { size: 100, customMetadata: { sha256: item.sha256 } });
assert.equal((await put(privateItem)).status, 200);
let declarations = [{ id, visibility: 'public' }, { id: privateId, visibility: 'members' }];
const catalog = createRecordedCatalog(() => ({ origin, secret: playback }), { staticCatalog: [], library: async () => declarations, send });
class Failure extends Error { constructor(code, message) { super(message); this.code = code; } }
let active = true;
const handlers = createMemberHandlers({ audio: { catalog, sign: async key => ({ url: 'signed:' + key, expiresAt: 123 }) }, fail: Failure,
  auth: { getUser: async () => ({ emailVerified: true, disabled: false }) }, db: { doc: () => ({ get: async () => ({ exists: true, data: () => ({ active }) }) }) } });
assert.deepEqual((await handlers.getChurchAudio({ data: {} })).recordings.map(r => r.videoId), [id]);
await assert.rejects(handlers.getChurchAudio({ data: { videoId: privateId } }), e => e.code === 'unauthenticated');
const member = { auth: { uid: 'member' }, data: { includeMembers: true } };
assert.equal((await handlers.getChurchAudio(member)).recordings.length, 2);
assert.equal((await handlers.getChurchAudio({ ...member, data: { videoId: privateId } })).videoId, privateId);
active = false; await assert.rejects(handlers.getChurchAudio(member), e => e.code === 'permission-denied'); active = true;
declarations = [{ id, visibility: 'members' }, { id, visibility: 'public' }];
assert.equal((await handlers.getChurchAudio({ data: {} })).recordings.length, 0, 'current policy overrides cached public registration; members wins');
await assert.rejects(handlers.getChurchAudio({ ...member, data: { videoId: privateId } }), e => e.code === 'not-found');
declarations = null;
await assert.rejects(handlers.getChurchAudio({ data: {} }), e => e.code === 'unavailable');
const fallback = createRecordedCatalog(() => ({ origin, secret: playback }), { staticCatalog: [{ ...item, visibility: 'public' }], library: async () => [{ id, visibility: 'members' }], send: async () => { throw Error('offline'); } });
assert.equal((await fallback())[0].visibility, 'members', 'static fallback still obeys published policy');
console.log('PASS: authenticated registration, verified R2 object, immutable hash, public/member separation, current policy on cache hits, revoked membership, missing library fail-closed, and static fallback.');
