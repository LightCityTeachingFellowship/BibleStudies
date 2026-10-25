import { createServer } from 'node:http';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectManifest } from './pilot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export async function sessions(work) {
  const result = [];
  for (const name of await readdir(work).catch(error => { if (error.code === 'ENOENT') return []; throw error; })) {
    if (!/^session-\d+$/.test(name)) continue;
    try {
      const info = inspectManifest(await readFile(join(work, name, 'audio.m3u8'), 'utf8'));
      if (!info.segments.length) continue;
      result.push({ id: name, startedAt: new Date(Number(name.slice(8))).toISOString(), ended: info.ended, seconds: info.durationSeconds });
    } catch { /* First segment may still be being written. Try on the next refresh. */ }
  }
  return result.sort((a, b) => Number(b.id.slice(8)) - Number(a.id.slice(8)));
}
export function byteRange(value, size) {
  if (!value) return null;
  const match = value.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) throw Error('Invalid range');
  let start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  let end = match[1] ? (match[2] ? Number(match[2]) : size - 1) : size - 1;
  end = Math.min(end, size - 1);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) throw Error('Unsatisfiable range');
  return { start, end };
}
export function previewServer({ work = join(HERE, 'work') } = {}) {
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    const port = request.socket.localPort;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    const origin = request.headers.origin;
    if (!hosts.includes(request.headers.host) || (origin && !hosts.map(host => 'http://' + host).includes(origin))) { response.writeHead(403).end(); return; }
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const fixed = { '/': ['preview.html', 'text/html; charset=utf-8'], '/preview.js': ['preview-client.js', 'text/javascript; charset=utf-8'], '/timing': ['timing.html', 'text/html; charset=utf-8'], '/timing-client.mjs': ['timing-client.mjs', 'text/javascript; charset=utf-8'], '/live-sync.mjs': ['live-sync.mjs', 'text/javascript; charset=utf-8'] }[url.pathname];
      if (fixed) {
        const body = await readFile(url.pathname === '/live-sync.mjs' ? join(HERE, '../../script/media-live-core.mjs') : join(HERE, fixed[0]));
        response.writeHead(200, { 'Content-Type': fixed[1], 'Content-Length': body.length });
        response.end(request.method === 'HEAD' ? undefined : body); return;
      }
      if (url.pathname === '/sessions') {
        const body = JSON.stringify(await sessions(work));
        response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(request.method === 'HEAD' ? undefined : body); return;
      }
      const match = url.pathname.match(/^\/streams\/(session-\d+)\/(audio\.m3u8|segment-\d{6,}\.ts)$/);
      if (!match) { response.writeHead(404).end(); return; }
      const path = await realpath(join(work, match[1], match[2]));
      const root = await realpath(work);
      if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
      const size = (await stat(path)).size;
      let range;
      try { range = byteRange(request.headers.range, size); }
      catch { response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end(); return; }
      const headers = { 'Content-Type': path.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t', 'Accept-Ranges': 'bytes', 'Content-Length': range ? range.end - range.start + 1 : size };
      if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
      response.writeHead(range ? 206 : 200, headers);
      if (request.method === 'HEAD') { response.end(); return; }
      await pipeline(createReadStream(path, range || undefined), response);
    } catch (error) {
      if (!response.headersSent) response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
      else response.destroy();
    }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = previewServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'The local player is already running on port 4011.' : 'Could not start the local player.'); process.exitCode = 1; });
  server.listen(4011, '127.0.0.1', () => console.log('Local audio test player: http://127.0.0.1:4011/\nKeep this terminal open. A second terminal can run the OBS receiver.'));
}
