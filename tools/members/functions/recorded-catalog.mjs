import { liveOrigin } from './live-audio.mjs';
export function validRecording(r) {
  return r && /^[\w-]{11}$/.test(r.videoId || '') && r.objectKey === `audio/${r.videoId}.m4a`
    && typeof r.title === 'string' && r.title.trim().length > 0 && r.title.length <= 300
    && Number.isSafeInteger(r.bytes) && r.bytes > 0 && r.bytes <= 500 * 1024 ** 2
    && Number.isFinite(r.durationSeconds) && r.durationSeconds > 0 && r.durationSeconds <= 57600 && /^[a-f\d]{64}$/.test(r.sha256 || '');
}
export function createRecordedCatalog(config, { staticCatalog, library, send = fetch, now = Date.now } = {}) {
  let cached = [], until = 0, loading;
  async function remote() {
    if (until > now()) return cached;
    if (loading) return loading;
    loading = (async () => {
      const settings = config(), secret = settings.secret?.trim();
      if (!/^[a-f\d]{64}$/.test(secret || '')) throw Error('Recorded catalogue not configured');
      const response = await send(liveOrigin(settings.origin) + '/recordings/catalog', { headers: { Authorization: 'Bearer ' + secret }, redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!response.ok) { await response.body?.cancel(); throw Error('Recorded catalogue unavailable'); }
      const data = await response.json();
      if (!Array.isArray(data.recordings) || data.recordings.length > 10000 || data.recordings.some(r => !validRecording(r)) || new Set(data.recordings.map(r => r.videoId)).size !== data.recordings.length) throw Error('Invalid recorded catalogue');
      cached = data.recordings; until = now() + 30000; return cached;
    })();
    try { return await loading; } finally { loading = null; }
  }
  const catalog = async () => {
    // Read access policy every request, including cache hits; the uploader cannot grant access.
    const declarations = await library();
    if (!Array.isArray(declarations)) throw Error('Published library unavailable');
    const access = new Map();
    for (const item of declarations) if (/^[\w-]{11}$/.test(item.id || '') && access.get(item.id) !== 'members') access.set(item.id, item.visibility === 'public' ? 'public' : 'members');
    let dynamic = [];
    try { dynamic = await remote(); } catch { /* Existing bundled recordings continue through gateway outages. */ }
    const merged = new Map(staticCatalog.map(r => [r.videoId, r]));
    for (const r of dynamic) if (!merged.has(r.videoId)) merged.set(r.videoId, r);
    return [...merged.values()].filter(r => access.has(r.videoId)).map(r => ({ ...r, visibility: access.get(r.videoId) }));
  };
  catalog.registered = async () => [...new Map([...staticCatalog, ...await remote()].map(r=>[r.videoId,r])).values()];
  return catalog;
}
