import { validSession, sameSecret, parsePlaylist } from './auth.mjs';
export function broadcast(value, now = Date.now()) {
  if (!value || !/^[\w-]{11}$/.test(value.videoId || '') || !validSession(value.session) || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 300 || !['public', 'members'].includes(value.visibility) || !Number.isFinite(value.offsetSeconds) || Math.abs(value.offsetSeconds) > 600 || typeof value.active !== 'boolean' || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now || value.expiresAt > now + 16 * 3600000) throw Error('Invalid broadcast');
  return { videoId: value.videoId, session: value.session, title: value.title.trim(), visibility: value.visibility, offsetSeconds: value.offsetSeconds, active: value.active, expiresAt: value.expiresAt };
}
export async function broadcastRoute(request, env, now = Date.now()) {
  const path = new URL(request.url).pathname;
  const match = path.match(/^\/upload\/broadcasts\/([\w-]{11})\.json$/);
  if (!match && path !== '/catalog') return null;
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  const expected = match ? env.LIVE_UPLOAD_KEY : env.LIVE_PLAYBACK_KEY;
  if (!await sameSecret(supplied, expected)) return new Response('Not authorized', { status: 403 });
  if (match) {
    if (request.method !== 'PUT') return new Response('Method not allowed', { status: 405 });
    const length = Number(request.headers.get('Content-Length'));
    if (!length || length > 4096) return new Response('Invalid length', { status: 413 });
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength !== length) return new Response('Invalid length', { status: 400 });
    let data;
    try { data = broadcast(JSON.parse(new TextDecoder().decode(bytes)), now); } catch { return new Response('Invalid broadcast', { status: 400 }); }
    if (data.videoId !== match[1]) return new Response('Invalid video', { status: 400 });
    await env.AUDIO.put('live-broadcasts/' + data.videoId + '.json', JSON.stringify(data), { httpMetadata: { contentType: 'application/json' }, customMetadata: { expiresAt: String(data.expiresAt), active: String(data.active) } });
    return Response.json({ registered: true, videoId: data.videoId });
  }
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  // Only a few simultaneous broadcasts are supported. Never scan all segments.
  const candidates = []; let cursor, pages = 0;
  do {
    const page = await env.AUDIO.list({ prefix: 'live-broadcasts/', limit: 1000, include: ['customMetadata'], ...(cursor ? { cursor } : {}) });
    for (const entry of page.objects) if (entry.customMetadata?.active === 'true' && Number(entry.customMetadata.expiresAt) > now) candidates.push(entry);
    if (candidates.length > 20 || ++pages > 5) return new Response('Too many registered broadcasts', { status: 503 });
    cursor = page.truncated ? page.cursor : null;
  } while (cursor);
  const recordings = [];
  for (const object of candidates) {
    try {
      const entry = await env.AUDIO.get(object.key);
      const item = broadcast(JSON.parse(await entry.text()), now);
      if (!item.active) continue;
      const playlist = await env.AUDIO.get(`live-test/${item.session}/audio.m3u8`);
      if (!playlist || now - new Date(playlist.uploaded).getTime() > 90000 || !Number.isFinite(new Date(playlist.uploaded).getTime())) continue;
      if (parsePlaylist(await playlist.text()).ended) continue;
      recordings.push(item);
    } catch { /* Expired, stale, malformed, and completed sessions are unavailable. */ }
  }
  return Response.json({ recordings });
}
