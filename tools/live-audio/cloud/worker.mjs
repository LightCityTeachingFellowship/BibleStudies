import { validSecret, validSession, sameSecret, sha256, verifyToken, parsePlaylist } from './auth.mjs';
import phonePage from './phone-page.mjs';
import { broadcastRoute } from './broadcasts.mjs';
import { recordingsRoute } from './recordings.mjs';
const prefix = (session, file) => `live-test/${session}/${file}`;
function result(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers } });
}
const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') return result(phonePage, 200, { 'Content-Type': 'text/html; charset=utf-8' });
    // Fail closed until both independent secrets and the private bucket are bound.
    if (!env.AUDIO || !validSecret(env.LIVE_UPLOAD_KEY) || !validSecret(env.LIVE_PLAYBACK_KEY) || env.LIVE_UPLOAD_KEY === env.LIVE_PLAYBACK_KEY) return result('Not configured', 503);
    try {
      const registration = await recordingsRoute(request, env) || await broadcastRoute(request, env);
      if (registration) return result(registration.body, registration.status, { 'Content-Type': registration.headers.get('Content-Type') || 'text/plain' });
    } catch { return result('Live catalogue temporarily unavailable', 503); }
    const match = url.pathname.match(/^\/(upload|live)\/(session-\d{13})\/(audio\.m3u8|segment-\d{6,}\.ts)$/);
    if (!match || !validSession(match[2])) return result('Not found', 404);
    const [, route, session, file] = match;
    try {
      if (route === 'upload') {
        const supplied = request.headers.get('Authorization')?.replace(/^Bearer /, '');
        if (!await sameSecret(supplied, env.LIVE_UPLOAD_KEY)) return result('Not authorized', 403);
        if (request.method !== 'PUT') return result('Method not allowed', 405);
        const length = Number(request.headers.get('Content-Length'));
        if (!length || length > 2 * 1024 * 1024) return result('Invalid content length', 413);
        const bytes = await request.arrayBuffer();
        if (bytes.byteLength !== length || bytes.byteLength > 2 * 1024 * 1024) return result('Invalid body length', 413);
        const hash = await sha256(bytes);
        if (hash !== request.headers.get('X-Content-SHA256')) return result('Checksum mismatch', 400);
        if (file === 'audio.m3u8') {
          let playlist; try { playlist = parsePlaylist(new TextDecoder().decode(bytes)); } catch { return result('Invalid playlist', 400); }
          const previous = await env.AUDIO.get(prefix(session, file));
          const oldText = previous ? await previous.text() : '';
          const old = oldText ? parsePlaylist(oldText) : { lines: [], segments: [], ended: false };
          // EVENT playlists only grow. Do not replace a completed session or roll it back.
          if (old.ended && oldText !== new TextDecoder().decode(bytes)) return result('Session already ended', 409);
          if (playlist.segments.length < old.segments.length || old.segments.some((segment, i) => playlist.segments[i] !== segment)) return result('Playlist rollback', 409);
          const oldPrefix = old.lines.filter(line => line !== '#EXT-X-ENDLIST');
          if (oldPrefix.some((line, i) => playlist.lines[i] !== line)) return result('Playlist history changed', 409);
          const added = playlist.segments.slice(old.segments.length);
          if (added.length <= 25) {
            for (const segment of added) if (!await env.AUDIO.head(prefix(session, segment))) return result('Upload segments first', 409);
          } else {
            // A reconnect can add many segments. Paginate rather than exceed
            // Workers subrequest limits by issuing thousands of individual HEADs.
            const found = new Set(); let cursor;
            do {
              const page = await env.AUDIO.list({ prefix: prefix(session, 'segment-'), limit: 1000, ...(cursor ? { cursor } : {}) });
              for (const object of page.objects) found.add(object.key.slice(prefix(session, '').length));
              cursor = page.truncated ? page.cursor : null;
            } while (cursor);
            if (added.some(segment => !found.has(segment))) return result('Upload segments first', 409);
          }
          const written = await env.AUDIO.put(prefix(session, file), bytes, { onlyIf: previous ? { etagMatches: previous.etag } : { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/vnd.apple.mpegurl' }, customMetadata: { sha256: hash } });
          if (!written) return result('Playlist changed concurrently; retry', 409);
        } else {
          const existing = await env.AUDIO.head(prefix(session, file));
          if (existing) {
            if (existing.customMetadata?.sha256 !== hash || existing.size !== length) return result('Segment already exists with different data', 409);
          } else {
            const written = await env.AUDIO.put(prefix(session, file), bytes, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'video/mp2t' }, customMetadata: { sha256: hash } });
            if (!written) return result('Concurrent segment upload; retry', 409);
          }
        }
        return result(JSON.stringify({ sha256: hash, bytes: length }), 200, { 'Content-Type': 'application/json' });
      }
      if (!await verifyToken(session, url.searchParams.get('token'), env.LIVE_PLAYBACK_KEY)) return result('Link expired or invalid', 403);
      if (!['GET', 'HEAD'].includes(request.method)) return result('Method not allowed', 405);
      const object = await env.AUDIO.get(prefix(session, file), file.endsWith('.ts') && request.headers.has('Range') ? { range: request.headers } : undefined);
      if (!object) return result('Waiting for audio', 404);
      if (file === 'audio.m3u8') {
        const playlist = parsePlaylist(await object.text());
        const body = playlist.lines.map(line => line.startsWith('#') ? line : line + '?token=' + encodeURIComponent(url.searchParams.get('token'))).join('\n') + '\n';
        return result(request.method === 'HEAD' ? null : body, 200, { 'Content-Type': 'application/vnd.apple.mpegurl' });
      }
      const headers = { 'Content-Type': 'video/mp2t', 'Accept-Ranges': 'bytes' };
      let status = 200;
      if (object.range) {
        const { offset, length } = object.range;
        if (!Number.isInteger(offset) || !Number.isInteger(length)) return result('Invalid range', 416);
        headers['Content-Range'] = `bytes ${offset}-${offset + length - 1}/${object.size}`;
        headers['Content-Length'] = String(length); status = 206;
      } else headers['Content-Length'] = String(object.size);
      if (request.method === 'HEAD') { await object.body?.cancel(); return result(null, status, headers); }
      return result(object.body, status, headers);
    } catch { return result('Audio temporarily unavailable', 503); }
  }
};
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = !origin || ['https://lightcityfellowship.com', 'https://www.lightcityfellowship.com', 'https://lightcityteachingfellowship.github.io'].includes(origin) || /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
    if (!allowed) return result('Origin not allowed', 403);
    if (request.method === 'OPTIONS') {
      if (!['GET', 'HEAD'].includes(request.headers.get('Access-Control-Request-Method'))) return result('Method not allowed', 405);
      return result(null, 204, { 'Access-Control-Allow-Origin': origin || '*', 'Access-Control-Allow-Methods': 'GET, HEAD', 'Access-Control-Allow-Headers': 'Range', 'Access-Control-Max-Age': '600', Vary: 'Origin' });
    }
    const response = await worker.fetch(request, env);
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
      response.headers.set('Vary', 'Origin');
    }
    return response;
  }
};
