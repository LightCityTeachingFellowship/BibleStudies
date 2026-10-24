import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createMemberHandlers } from './members/functions/core.mjs';
import { createAudioSigner, checkAudioLink, AUDIO_LINK_SECONDS } from './members/functions/audio.mjs';
class Failure extends Error { constructor(code, message) { super(message); this.code = code; } }
const catalog = JSON.parse(readFileSync(new URL('./members/functions/audio-catalog.json', import.meta.url)));
let active = true, verified = true, disabled = false, signed = [];
const handlers = createMemberHandlers({
  auth: { getUser: async () => ({ emailVerified: verified, disabled }) },
  db: { doc: () => ({ get: async () => ({ exists: true, data: () => ({ active }) }) }) },
  secret: () => '', fail: Failure,
  audio: { catalog, sign: async key => { signed.push(key); return { url: 'signed', expiresAt: 123 }; }, check: async () => ({ ok: false, status: 403, code: 'SignatureDoesNotMatch' }), credentials: async key => { assert.equal(key, catalog[0].objectKey); return 'OK'; } }
});
const request = { auth: { uid: 'member', token: { member: true } }, data: { includeMembers: true } };
assert.deepEqual((await handlers.getChurchAudio({ data: {} })).recordings, []);
await assert.rejects(() => handlers.getChurchAudio({ data: { includeMembers: true } }), { code: 'unauthenticated' });
await assert.rejects(() => handlers.getChurchAudio({ data: { videoId: catalog[0].videoId } }), { code: 'unauthenticated' });
active = false;
await assert.rejects(() => handlers.getChurchAudio(request), { code: 'permission-denied' });
active = true; verified = false;
await assert.rejects(() => handlers.getChurchAudio(request), { code: 'failed-precondition' });
verified = true; disabled = true;
await assert.rejects(() => handlers.getChurchAudio(request), { code: 'permission-denied' });
disabled = false; assert.equal(signed.length, 0);
const listing = await handlers.getChurchAudio(request);
assert.equal(listing.recordings.length, 5);
assert.equal(JSON.stringify(listing).includes('objectKey'), false);
await handlers.getChurchAudio({ ...request, data: { videoId: catalog[0].videoId, objectKey: 'forged' } });
assert.deepEqual(signed, [catalog[0].objectKey]);
const checked = await handlers.getChurchAudio({ ...request, data: { videoId: catalog[0].videoId, diagnose: true } });
assert.deepEqual(checked, { diagnostic: { ok: false, status: 403, code: 'SignatureDoesNotMatch', credentials: 'OK' } });
assert.equal(JSON.stringify(checked).includes('url'), false);
await assert.rejects(() => handlers.getChurchAudio({ ...request, data: { videoId: '../secret' } }), { code: 'invalid-argument' });
await assert.rejects(() => handlers.getChurchAudio({ ...request, data: { videoId: 'aaaaaaaaaaa' } }), { code: 'not-found' });
const sign = createAudioSigner(() => ({ accountId: 'a'.repeat(32), bucket: 'lightcity-audio', accessKeyId: 'test-access', secretAccessKey: 'test-secret' }), () => 1000);
const result = await sign(catalog[0].objectKey), url = new URL(result.url);
assert.equal(url.protocol, 'https:');
assert.equal(url.hostname, 'a'.repeat(32) + '.r2.cloudflarestorage.com');
assert.ok(url.pathname.endsWith('/' + catalog[0].objectKey));
assert.equal(url.searchParams.get('X-Amz-Expires'), String(AUDIO_LINK_SECONDS));
assert.equal(url.searchParams.get('response-content-type'), 'audio/mp4');
assert.equal(result.expiresAt, 1000 + 8 * 3600 * 1000);
await assert.rejects(() => sign('../secret'));
const trimmed = await createAudioSigner(() => ({ accountId: ' ' + 'a'.repeat(32) + '\n', bucket: ' lightcity-audio ', accessKeyId: ' test-access\n', secretAccessKey: ' test-secret\r\n' }))(catalog[0].objectKey);
assert.equal(new URL(trimmed.url).searchParams.get('X-Amz-Credential').split('/')[0], 'test-access');
assert.equal(new URL(trimmed.url).pathname, url.pathname);
let cancelled = false;
const diagnostic = await checkAudioLink(result.url, async (address, options) => {
  assert.equal(options.headers.Range, 'bytes=0-0');
  assert.equal(options.redirect, 'error');
  return { ok: false, status: 403, body: { getReader: () => ({
    read: async () => ({ value: new TextEncoder().encode('<Error><Code>AccessDenied</Code><Message>private-details</Message></Error>') }),
    cancel: async () => { cancelled = true; }
  }) } };
});
assert.deepEqual(diagnostic, { ok: false, status: 403, code: 'AccessDenied' });
assert.equal(cancelled, true);
assert.deepEqual(await checkAudioLink(result.url, async () => { throw Error('private-url'); }), { ok: false, status: 0, code: 'StorageUnreachable' });
await assert.rejects(() => checkAudioLink('https://example.com/private', async () => { throw Error('must not run'); }));
const publicRecording = { ...catalog[0], videoId: 'public12345', objectKey: 'audio/public12345.m4a', visibility: 'public' };
catalog.push(publicRecording);
active = false;
assert.deepEqual((await handlers.getChurchAudio({ data: {} })).recordings.map(item => item.videoId), ['public12345']);
assert.deepEqual((await handlers.getChurchAudio({ ...request, data: {} })).recordings.map(item => item.videoId), ['public12345']);
assert.equal((await handlers.getChurchAudio({ data: { videoId: 'public12345' } })).videoId, 'public12345');
await assert.rejects(() => handlers.getChurchAudio({ ...request, data: { videoId: catalog[0].videoId } }), { code: 'permission-denied' });
active = true;
assert.equal((await handlers.getChurchAudio(request)).recordings.length, 6);
catalog.pop();
console.log('PASS: guest public listing/playback, protected member recordings, approval/verification/revocation, catalogue allowlist and offline R2 signing.');

class Element {
  constructor() { this.children = []; this.events = {}; this.dataset = {}; this.attributes = {}; this.value = '1'; this.currentTime = 0; this.playbackRate = 1; }
  addEventListener(name, fn) { this.events[name] = fn; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name]; }
  removeAttribute(name) { delete this.attributes[name]; if (name === 'src') this.src = ''; }
  pause() { this.paused = true; }
  load() {}
  async play() { this.paused = false; }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
}
const nodes = new Map(), events = {}, storage = new Map();
const get = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
let resolvePlayback;
const api = { library: [], ready: Promise.resolve(), getAudio: async id => id ? new Promise(resolve => { resolvePlayback = resolve; }) : { recordings: Array.isArray(api.library) ? catalog : [publicRecording] } };
const windowMock = { LightCityMembers: api, addEventListener: (name, fn) => { events[name] = fn; } };
vm.runInNewContext(readFileSync(new URL('../script/audio-pilot.js', import.meta.url), 'utf8'), {
  window: windowMock, document: { readyState: 'complete', getElementById: get, createElement: () => new Element() },
  navigator: { mediaSession: { setActionHandler() {} } }, URL, Date, console, AbortController, TextDecoder, setTimeout, clearTimeout,
  fetch: async () => ({ ok: false, status: 403, body: { getReader: () => ({ read: async () => ({ value: new TextEncoder().encode('<Error><Code>SignatureDoesNotMatch</Code><Secret>not-displayed</Secret></Error>') }), cancel: async () => {} }) } }),
  localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }
});
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
await settle(); assert.equal(get('audio-recordings').children.length, 5);
get('audio-recordings').children[0].events.click(); await settle();
api.library = null; events['lightcity-members-changed'](); await settle();
resolvePlayback({ videoId: catalog[0].videoId, url: result.url, expiresAt: Date.now() + 10000 });
await settle();
assert.equal(get('pilot-audio').src, '', 'A late signed response cannot restart playback after sign-out');
assert.equal(get('audio-recordings').children.length, 1);
assert.equal(get('audio-recordings').children[0].dataset.videoId, 'public12345');
assert.equal(get('audio-player-panel').hidden, false);
assert.equal(get('audio-signin').hidden, false);
assert.ok([...storage.values()].every(value => !value.includes('https:')), 'Signed URLs must not be persisted');
console.log('PASS: audience-specific player rendering, sign-out replaces member recordings with public recordings, stale response protection and no persisted signed links.');
get('pilot-audio').play = async () => { throw Object.assign(Error('Unsupported'), { name: 'NotSupportedError' }); };
get('audio-recordings').children[0].events.click(); await settle();
resolvePlayback({ videoId: publicRecording.videoId, url: result.url, expiresAt: Date.now() + 10000 });
await settle(); await settle();
assert.match(get('audio-status').textContent, /HTTP 403, SignatureDoesNotMatch/);
assert.equal(get('audio-status').textContent.includes('not-displayed'), false);
assert.equal(get('audio-status').textContent.includes('https:'), false);
console.log('PASS: file-loading errors are not mislabeled as autoplay blocks; diagnostics expose only HTTP status and safe storage error code.');
