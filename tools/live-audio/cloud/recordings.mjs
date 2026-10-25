import { sameSecret } from './auth.mjs';
export function recording(value) {
  if (!value || !/^[\w-]{11}$/.test(value.videoId || '') || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 300
    || value.objectKey !== `audio/${value.videoId}.m4a` || !Number.isSafeInteger(value.bytes) || value.bytes <= 0 || value.bytes > 500 * 1024 ** 2
    || !Number.isFinite(value.durationSeconds) || value.durationSeconds <= 0 || value.durationSeconds > 57600 || !/^[a-f\d]{64}$/.test(value.sha256 || '')) throw Error('Invalid recording');
  return { videoId: value.videoId, title: value.title.trim(), objectKey: value.objectKey, bytes: value.bytes, durationSeconds: value.durationSeconds, sha256: value.sha256 };
}
export async function recordingsRoute(request, env) {
  const path = new URL(request.url).pathname, match = path.match(/^\/upload\/recordings\/([\w-]{11})\.json$/);
  if (!match && path !== '/recordings/catalog') return null;
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!await sameSecret(supplied, match ? env.LIVE_UPLOAD_KEY : env.LIVE_PLAYBACK_KEY)) return new Response('Not authorized', { status: 403 });
  if (!match) {
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    const recordings = []; let cursor;
    do {
      const page = await env.AUDIO.list({ prefix: 'recorded-audio/', limit: 1000, include: ['customMetadata'], ...(cursor ? { cursor } : {}) });
      for (const object of page.objects) {
        try { const item = recording(JSON.parse(object.customMetadata?.recording)); if (object.key === `recorded-audio/${item.videoId}.json`) recordings.push(item); } catch {}
      }
      if (recordings.length > 10000) return new Response('Catalogue limit reached', { status: 503 });
      cursor = page.truncated ? page.cursor : null;
    } while (cursor);
    return Response.json({ recordings });
  }
  const key = `recorded-audio/${match[1]}.json`;
  if (request.method === 'GET') {
    const stored = await env.AUDIO.get(key);
    return stored ? new Response(await stored.text(), { headers: { 'Content-Type': 'application/json' } }) : new Response('Not registered', { status: 404 });
  }
  if (request.method !== 'PUT') return new Response('Method not allowed', { status: 405 });
  const length = Number(request.headers.get('Content-Length'));
  if (!length || length > 4096) return new Response('Invalid length', { status: 413 });
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength !== length) return new Response('Invalid length', { status: 400 });
  let item;
  try { item = recording(JSON.parse(new TextDecoder().decode(bytes))); } catch { return new Response('Invalid recording', { status: 400 }); }
  if (item.videoId !== match[1]) return new Response('Invalid video', { status: 400 });
  const audio = await env.AUDIO.head(item.objectKey);
  if (!audio || audio.size !== item.bytes || audio.customMetadata?.sha256 !== item.sha256) return new Response('Audio verification failed', { status: 409 });
  const previous = await env.AUDIO.get(key);
  if (previous) {
    const old = recording(JSON.parse(await previous.text()));
    if (old.sha256 !== item.sha256 || old.bytes !== item.bytes) return new Response('Different recording already registered', { status: 409 });
  }
  const text = JSON.stringify(item);
  await env.AUDIO.put(key, text, { httpMetadata: { contentType: 'application/json' }, customMetadata: { recording: text } });
  return Response.json({ registered: true, videoId: item.videoId, sha256: item.sha256 });
}
