export const TITLE_REFRESH_MS = 24 * 3600000;
const valid = id => /^[\w-]{11}$/.test(id || '');
export async function refreshVideoTitles(videos, cache = {}, { now = Date.now(), send = fetch, apiKey = '', classify = () => null, deadlineMs = 240000 } = {}) {
  const wanted = new Set(videos.map(v => v.id));
  const titles = Object.fromEntries(Object.entries(cache.titles || {}).filter(([id, r]) => wanted.has(id) && typeof r?.title === 'string' && r.title.trim()));
  const due = !Number.isFinite(cache.checkedAt) || now - cache.checkedAt >= TITLE_REFRESH_MS || now < cache.checkedAt;
  if (!due) return { videos: applyTitles(videos, titles), cache: { ...cache, titles }, refreshed: false };
  const end = Date.now() + deadlineMs;
  let successes = 0, failures = 0, cursor = 0;
  const saveTitle = (id, title) => { if (!valid(id) || !wanted.has(id) || typeof title !== 'string' || !title.trim()) return false;
    const clean = title.trim(); titles[id] = { title: clean, category: classify(clean), checkedAt: now }; successes++; return true; };
  if (apiKey) {
    // Official API batches up to 50 IDs, avoiding a request per recording.
    for (let i = 0; i < videos.length && Date.now() < end; i += 50) {
      const batch = videos.slice(i, i + 50);
      try {
        const url = new URL('https://www.googleapis.com/youtube/v3/videos');
        url.search = new URLSearchParams({ part: 'snippet', id: batch.map(v => v.id).join(','), key: apiKey });
        const response = await send(url, { signal: AbortSignal.timeout(Math.max(1, Math.min(10000, end-Date.now()))) });
        if (!response.ok) { failures += batch.length; continue; }
        const body = await response.json(); const found = new Set();
        for (const item of body.items || []) if (batch.some(v => v.id === item.id) && saveTitle(item.id, item.snippet?.title)) found.add(item.id);
        failures += batch.length - found.size;
      } catch { failures += batch.length; }
    }
  } else {
    // No extra key is required. Failed or unavailable titles keep the last good value.
    await Promise.all(Array.from({ length: Math.min(4, videos.length) }, async () => {
      while (cursor < videos.length && Date.now() < end) {
        const { id } = videos[cursor++];
        try {
          const url = new URL('https://www.youtube.com/oembed');
          url.search = new URLSearchParams({ url: `https://www.youtube.com/watch?v=${id}`, format: 'json' });
          const response = await send(url, { signal: AbortSignal.timeout(Math.max(1, Math.min(10000, end-Date.now()))) });
          if (!response.ok || !saveTitle(id, (await response.json()).title)) failures++;
        } catch { failures++; }
      }
    }));
  }
  return { videos: applyTitles(videos, titles), cache: { checkedAt: now, titles }, refreshed: true, successes, failures };
}
export function applyTitles(videos, titles) {
  return videos.map(v => { const fresh = titles[v.id]; return fresh ? { ...v, title: fresh.title, ...(fresh.category ? { category: fresh.category } : {}) } : v; });
}
