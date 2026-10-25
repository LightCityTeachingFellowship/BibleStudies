import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { request } from 'node:http';
import { previewServer, byteRange } from './preview.mjs';
import { ROOT } from './pilot.mjs';
assert.deepEqual(byteRange('bytes=1-4', 10), { start: 1, end: 4 });
assert.deepEqual(byteRange('bytes=-3', 10), { start: 7, end: 9 });
assert.throws(() => byteRange('bytes=10-', 10));
const parent = resolve(ROOT, 'tools/live-audio/work'), work = join(parent, 'preview-test-' + Date.now());
await mkdir(join(work, 'session-123'), { recursive: true });
await writeFile(join(work, 'session-123', 'audio.m3u8'), '#EXTM3U\n#EXTINF:4,\n#EXT-X-PROGRAM-DATE-TIME:2026-10-24T12:00:00Z\nsegment-000000.ts\n#EXT-X-ENDLIST\n');
await writeFile(join(work, 'session-123', 'segment-000000.ts'), '0123456789');
const server = previewServer({ work });
await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
const port = server.address().port;
const get = (path, headers = {}, method = 'GET') => new Promise((accept, reject) => {
  const req = request({ host: '127.0.0.1', port, path, headers, method }, response => { const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => accept({ status: response.statusCode, headers: response.headers, text: Buffer.concat(chunks).toString() })); });
  req.on('error', reject); req.end();
});
try {
  const page = await get('/'); assert.equal(page.status, 200); assert.ok(page.text.includes('LightCity Live Audio Test')); assert.ok(page.text.includes('hls.js@1.7.3'));
  const list = await get('/sessions'); assert.equal(JSON.parse(list.text)[0].id, 'session-123');
  const timing = await get('/timing?video=BaqEiXEDE5A'); assert.equal(timing.status, 200); assert.ok(timing.text.includes('Switch at the same moment.'));
  assert.equal((await get('/timing-client.mjs')).headers['content-type'], 'text/javascript; charset=utf-8');
  assert.equal((await get('/live-sync.mjs')).status, 200);
  assert.equal((await get('/streams/session-123/audio.m3u8')).headers['content-type'], 'application/vnd.apple.mpegurl');
  const range = await get('/streams/session-123/segment-000000.ts', { Range: 'bytes=1-4' }); assert.equal(range.status, 206); assert.equal(range.text, '1234');
  assert.equal((await get('/streams/session-123/segment-000000.ts', { Range: 'bytes=100-' })).status, 416);
  assert.equal((await get('/streams/session-123/session.json')).status, 404);
  assert.equal((await get('/streams/session-123/../../pilot.mjs')).status, 404);
  assert.equal((await get('/sessions', { Origin: 'https://example.com' })).status, 403);
  assert.equal((await get('/sessions', { Host: 'example.com:' + port })).status, 403);
  assert.equal((await get('/sessions', {}, 'POST')).status, 405);
  assert.equal((await get('/sessions', {}, 'HEAD')).text, '');
  console.log('PASS: session discovery, player page, HLS content types, byte ranges, read-only routes, local origin/host checks, and restricted file access.');
} finally {
  await new Promise(accept => server.close(accept));
  const target = resolve(work); if (!target.startsWith(parent + '\\') && !target.startsWith(parent + '/')) throw Error('Unsafe test cleanup path');
  await rm(target, { recursive: true, force: true });
}
