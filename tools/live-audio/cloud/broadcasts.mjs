import { validSession, sameSecret, parsePlaylist } from './auth.mjs';
export const REPLAY_MS = 7 * 86400000;
export function broadcast(value, now = Date.now(), stored = false) {
  if (!value || !/^[\w-]{11}$/.test(value.videoId || '') || !validSession(value.session) || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 300 || !['public', 'members'].includes(value.visibility) || !Number.isFinite(value.offsetSeconds) || Math.abs(value.offsetSeconds) > 57600 || typeof value.active !== 'boolean' || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= 0 || (!stored && (value.expiresAt <= now || value.expiresAt > now + 16 * 3600000))) throw Error('Invalid broadcast');
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
    let replayUntil = 0;
    if (!data.active) {
      const playlist = await env.AUDIO.get(`live-test/${data.session}/audio.m3u8`);
      const uploaded = new Date(playlist?.uploaded).getTime();
      if (playlist && Number.isFinite(uploaded) && parsePlaylist(await playlist.text()).ended) replayUntil = uploaded + REPLAY_MS;
    }
    await env.AUDIO.put('live-broadcasts/' + data.videoId + '.json', JSON.stringify(data), { httpMetadata: { contentType: 'application/json' }, customMetadata: { expiresAt: String(data.expiresAt), active: String(data.active), replayUntil: String(replayUntil), recording: JSON.stringify(data) } });
    return Response.json({ registered: true, videoId: data.videoId });
  }
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  // Only a few simultaneous broadcasts are supported. Never scan all segments.
  const candidates = []; let cursor, pages = 0;
  do {
    const page = await env.AUDIO.list({ prefix: 'live-broadcasts/', limit: 1000, include: ['customMetadata'], ...(cursor ? { cursor } : {}) });
    for (const entry of page.objects) if ((entry.customMetadata?.active === 'true' && Number(entry.customMetadata.expiresAt) > now) || Number(entry.customMetadata?.replayUntil) > now) candidates.push(entry);
    if (candidates.length > 220 || candidates.filter(entry => entry.customMetadata?.active === 'true').length > 20 || ++pages > 5) return new Response('Too many registered broadcasts', { status: 503 });
    cursor = page.truncated ? page.cursor : null;
  } while (cursor);
  const recordings = [];
  for (const object of candidates) {
    try {
      const replayUntil = Number(object.customMetadata?.replayUntil);
      if (replayUntil > now && object.customMetadata?.recording) {
        const item = broadcast(JSON.parse(object.customMetadata.recording), now, true);
        if (item.active || replayUntil > now + REPLAY_MS) continue;
        recordings.push({ ...item, replay: true, expiresAt: replayUntil });
        continue;
      }
      const entry = await env.AUDIO.get(object.key);
      const item = broadcast(JSON.parse(await entry.text()), now);
      if (!item.active) continue;
      const playlist = await env.AUDIO.get(`live-test/${item.session}/audio.m3u8`);
      const uploaded = new Date(playlist?.uploaded).getTime();
      if (!playlist || !Number.isFinite(uploaded)) continue;
      if (parsePlaylist(await playlist.text()).ended) {
        // Bridge the few seconds between the final playlist upload and close registration.
        if (uploaded + REPLAY_MS > now) recordings.push({ ...item, active: false, replay: true, expiresAt: uploaded + REPLAY_MS });
      } else if (now - uploaded <= 90000) recordings.push(item);
    } catch { /* Expired, stale, and malformed sessions are unavailable. */ }
  }
  return Response.json({ recordings });
}
