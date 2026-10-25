import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import worker from './cloud/worker.mjs';
import { sha256, issueToken, verifyToken, parsePlaylist, workerOrigin } from './cloud/auth.mjs';
import { publishSnapshot } from './publish-test.mjs';
import { ROOT } from './pilot.mjs';

// Synthetic keys only; the test never opens cloud-secrets.json or contacts Cloudflare.
const uploadKey = 'a'.repeat(64), playbackKey = 'b'.repeat(64), session = 'session-1792874042803';
const origin = 'https://lightcity-live-audio-test.example.workers.dev';
const now = Math.floor(Date.now() / 1000), token = await issueToken(session, playbackKey, now + 3600);
assert.ok(await verifyToken(session, token, playbackKey));
assert.ok(!await verifyToken('session-1792874042804', token, playbackKey));
assert.ok(!await verifyToken(session, token, uploadKey));
assert.ok(!await verifyToken(session, token, playbackKey, (now + 3601) * 1000));
assert.ok(!await verifyToken(session, await issueToken(session, playbackKey, now + 9000), playbackKey));
assert.ok(!await verifyToken(session, 'bad', playbackKey));
assert.throws(() => workerOrigin('http://example.workers.dev/'));
assert.throws(() => workerOrigin('https://example.com/'));
assert.throws(() => workerOrigin(origin + '/unexpected'));
assert.equal(workerOrigin(origin), origin);

let operations = [], version = 0, loseNextManifestResponse = false;
const objects = new Map();
const bucket = {
  async list({ prefix, limit, cursor }) {
    operations.push(['list', prefix]);
    const entries = [...objects.keys()].filter(key => key.startsWith(prefix)).sort();
    const offset = Number(cursor || 0), end = offset + limit;
    return { objects: entries.slice(offset, end).map(key => ({ key })), truncated: end < entries.length, cursor: String(end) };
  },
  async head(key) { operations.push(['head', key]); const entry = objects.get(key); return entry ? { size: entry.bytes.length, customMetadata: entry.metadata, etag: entry.etag } : null; },
  async get(key, options) {
    operations.push(['get', key]); const entry = objects.get(key); if (!entry) return null;
    let bytes = entry.bytes, range;
    if (options?.range?.get('Range')) { const [start, end] = options.range.get('Range').slice(6).split('-').map(Number); range = { offset: start, length: end - start + 1 }; bytes = bytes.slice(start, end + 1); }
    return { size: entry.bytes.length, customMetadata: entry.metadata, etag: entry.etag, range, body: new Response(bytes).body, text: async () => entry.bytes.toString('utf8') };
  },
  async put(key, bytes, options) {
    operations.push(['put', key]);
    const previous = objects.get(key);
    if (options.onlyIf?.etagDoesNotMatch === '*' && previous) return null;
    if (options.onlyIf?.etagMatches && previous?.etag !== options.onlyIf.etagMatches) return null;
    const entry = { bytes: Buffer.from(bytes), metadata: options.customMetadata, etag: String(++version) }; objects.set(key, entry); return entry;
  }
};
const env = { AUDIO: bucket, LIVE_UPLOAD_KEY: uploadKey, LIVE_PLAYBACK_KEY: playbackKey };
const get = (path, e = env, method = 'GET') => worker.fetch(new Request(origin + path, { method }), e);
const put = async (file, body, key = uploadKey, checksum) => {
  const bytes = Buffer.from(body);
  return worker.fetch(new Request(`${origin}/upload/${session}/${file}`, { method: 'PUT', headers: { Authorization: 'Bearer ' + key, 'Content-Length': String(bytes.length), 'X-Content-SHA256': checksum || await sha256(bytes) }, body: bytes }), env);
};
const playlist = (count, ended = false) => '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:EVENT\n' + Array.from({ length: count }, (_, i) => `#EXTINF:4.000000,\n#EXT-X-PROGRAM-DATE-TIME:${new Date(Date.parse('2026-10-24T20:00:00Z') + i * 4000).toISOString()}\nsegment-${String(i).padStart(6, '0')}.ts\n`).join('') + (ended ? '#EXT-X-ENDLIST\n' : '');
assert.throws(() => parsePlaylist(playlist(1).replace('segment-000000.ts', 'https://example.com/secret')));
assert.throws(() => parsePlaylist(playlist(1) + '#EXT-X-KEY:METHOD=AES-128,URI="secret"\n'));
assert.equal(parsePlaylist(playlist(10800)).segments.length, 10800, 'twelve-hour event history must fit the registered live window');
assert.throws(() => parsePlaylist(playlist(12001)), /Invalid playlist segments/);
assert.equal((await get(`/live/${session}/audio.m3u8`)).status, 403);
assert.equal(operations.length, 0, 'unauthorized listeners must not touch storage');
assert.equal((await get(`/live/${session}/audio.m3u8?token=${token}`, { ...env, LIVE_PLAYBACK_KEY: '' })).status, 503);
assert.equal((await put('segment-000000.ts', 'first', playbackKey)).status, 403);
assert.equal((await put('segment-000000.ts', 'first', uploadKey, 'wrong')).status, 400);
assert.equal((await put('audio.m3u8', playlist(1))).status, 409, 'playlist must not precede its segment');
assert.equal((await put('segment-000000.ts', 'first')).status, 200);
const writes = operations.filter(([op]) => op === 'put').length;
assert.equal((await put('segment-000000.ts', 'first')).status, 200);
assert.equal(operations.filter(([op]) => op === 'put').length, writes, 'retry must not rewrite existing segment');
assert.equal((await put('segment-000000.ts', 'different')).status, 409);
assert.equal((await put('audio.m3u8', playlist(1))).status, 200);
const rewritten = await get(`/live/${session}/audio.m3u8?token=${token}`);
assert.equal(rewritten.status, 200);
assert.ok((await rewritten.text()).includes('segment-000000.ts?token='));
assert.equal(rewritten.headers.get('cache-control'), 'private, no-store');
assert.equal((await get(`/live/session-1792874042804/segment-000000.ts?token=${token}`)).status, 403);
assert.equal((await get(`/live/${session}/../audio/anything?token=${token}`)).status, 404);
const segment = await get(`/live/${session}/segment-000000.ts?token=${token}`); assert.equal(await segment.text(), 'first');
const range = await worker.fetch(new Request(`${origin}/live/${session}/segment-000000.ts?token=${token}`, { headers: { Range: 'bytes=1-3' } }), env);
assert.equal(range.status, 206); assert.equal(await range.text(), 'irs'); assert.equal(range.headers.get('content-range'), 'bytes 1-3/5');
assert.equal((await get(`/live/${session}/segment-000000.ts?token=${token}`, env, 'HEAD')).body, null);
assert.equal((await put('segment-000001.ts', 'second')).status, 200);
assert.equal((await put('audio.m3u8', playlist(2))).status, 200);
assert.equal((await put('audio.m3u8', playlist(1))).status, 409, 'reject stale playlist rollback');
assert.equal((await put('audio.m3u8', playlist(2).replace('4.000000', '3.000000'))).status, 409, 'immutable content timeline');
assert.equal((await put('audio.m3u8', playlist(2, true))).status, 200);
assert.equal((await put('audio.m3u8', playlist(2))).status, 409, 'completed session cannot reopen');
assert.ok((await (await get('/')).text()).includes("history.replaceState(null,''"));

const longSession = 'session-1792874042820';
for (let i = 0; i < 1100; i++) objects.set(`live-test/${longSession}/segment-${String(i).padStart(6, '0')}.ts`, { bytes: Buffer.from('audio'), metadata: {}, etag: String(++version) });
const longBytes = Buffer.from(playlist(1100, true));
const startOps = operations.length;
const longResult = await worker.fetch(new Request(`${origin}/upload/${longSession}/audio.m3u8`, { method: 'PUT', headers: { Authorization: 'Bearer ' + uploadKey, 'Content-Length': String(longBytes.length), 'X-Content-SHA256': await sha256(longBytes) }, body: longBytes }), env);
assert.equal(longResult.status, 200);
assert.equal(operations.slice(startOps).filter(([op]) => op === 'list').length, 2, 'large catch-up snapshots use paginated listings');
assert.equal(operations.slice(startOps).filter(([op]) => op === 'head').length, 0, 'avoid per-segment subrequest exhaustion');

// Publisher integration, including a lost response after a successful remote write.
const parent = resolve(ROOT, 'tools/live-audio/work'), folder = join(parent, 'cloud-test-' + Date.now(), 'session-1792874042810');
await mkdir(folder, { recursive: true });
try {
  await writeFile(join(folder, 'audio.m3u8'), playlist(2, true));
  await writeFile(join(folder, 'segment-000000.ts'), 'one');
  await writeFile(join(folder, 'segment-000001.ts'), 'two');
  const receipts = {};
  const send = async (url, options) => {
    const response = await worker.fetch(new Request(url, options), env);
    if (loseNextManifestResponse && url.endsWith('/audio.m3u8')) { loseNextManifestResponse = false; throw Error('simulated connection interruption'); }
    return response;
  };
  loseNextManifestResponse = true;
  await assert.rejects(publishSnapshot({ folder, origin, uploadKey, receipts, send }), /connection interruption/);
  assert.equal(Object.keys(receipts).length, 2, 'completed segments survive an interrupted playlist response');
  const putCount = operations.filter(([op]) => op === 'put').length;
  const completed = await publishSnapshot({ folder, origin, uploadKey, receipts, send });
  assert.equal(completed.ended, true); assert.equal(completed.segments, 2);
  assert.equal(operations.filter(([op]) => op === 'put').length, putCount + 1, 'only playlist retried; audio segments skipped');
  assert.ok(operations.filter(([op]) => op === 'put').every(([, key]) => key.startsWith('live-test/')), 'cannot write into recorded audio prefix');
  console.log('PASS: private session tokens, expiry/scope/key separation, fail-closed setup, immutable segments/timeline, upload ordering/checksums, private playback/ranges, and interrupted-upload recovery.');
} finally {
  const target = resolve(dirnameOf(folder));
  if (!target.startsWith(parent + '\\') && !target.startsWith(parent + '/')) throw Error('Unsafe cleanup');
  await rm(target, { recursive: true, force: true });
}
function dirnameOf(path) { return resolve(path, '..'); }
