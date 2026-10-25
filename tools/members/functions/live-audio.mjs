import { createHmac } from 'node:crypto';
const defaultOrigin = 'https://lightcity-live-audio-test.lightcityteachingfellowship.workers.dev';
export function liveOrigin(value = defaultOrigin) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname) || url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/') throw Error('Invalid live gateway');
  return url.origin;
}
export function validLive(value, now = Date.now()) {
  return value && /^[\w-]{11}$/.test(value.videoId || '') && /^session-\d{13}$/.test(value.session || '') && typeof value.title === 'string' && value.title.length > 0 && value.title.length <= 300 && ['public', 'members'].includes(value.visibility) && value.active === true && Number.isFinite(value.offsetSeconds) && Math.abs(value.offsetSeconds) <= 600 && Number.isSafeInteger(value.expiresAt) && value.expiresAt > now && value.expiresAt <= now + 16 * 3600000;
}
export function createLiveAudio(config, { send = fetch, now = Date.now, cacheMs = 10000 } = {}) {
  let cached = null, cacheUntil = 0, loading = null;
  function settings() {
    const value = config();
    const secret = value.secret?.trim();
    if (!/^[a-f0-9]{64}$/.test(secret || '')) throw Error('Live listening is not configured');
    return { origin: liveOrigin(value.origin), secret };
  }
  return {
    async catalog() {
      if (cached && cacheUntil > now()) return cached.filter(item => validLive(item, now()));
      if (loading) return loading;
      loading = (async () => {
        const { origin, secret } = settings();
        const response = await send(origin + '/catalog', { headers: { Authorization: 'Bearer ' + secret }, redirect: 'error', signal: AbortSignal.timeout(10000) });
        if (!response.ok) { await response.body?.cancel(); throw Error('Live catalogue unavailable'); }
        const data = await response.json();
        if (!Array.isArray(data.recordings) || data.recordings.length > 20 || data.recordings.some(item => !validLive(item, now())) || new Set(data.recordings.map(item => item.videoId)).size !== data.recordings.length) throw Error('Invalid live catalogue');
        cached = data.recordings; cacheUntil = now() + cacheMs;
        return cached;
      })();
      try { return await loading; } finally { loading = null; }
    },
    async sign(item) {
      if (!validLive(item, now())) throw Error('Broadcast unavailable');
      const { origin, secret } = settings();
      const expires = Math.floor(Math.min(now() + 3600000, item.expiresAt) / 1000);
      const signature = createHmac('sha256', secret).update(`lightcity-live-test:v1:${item.session}:${expires}`).digest('hex');
      return { kind: 'live', videoId: item.videoId, title: item.title, session: item.session, offsetSeconds: item.offsetSeconds, url: `${origin}/live/${item.session}/audio.m3u8?token=${expires}.${signature}`, expiresAt: expires * 1000 };
    }
  };
}
