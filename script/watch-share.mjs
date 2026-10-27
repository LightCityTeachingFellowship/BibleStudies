export function watchShare({ base, videoId, title }) {
  if (!/^[\w-]{11}$/.test(videoId || '')) return null;
  const url = new URL(base);
  if (url.protocol !== 'https:') return null;
  url.search = ''; url.hash = ''; url.searchParams.set('v', videoId);
  return { title: String(title || 'Watch on LightCity').trim(), text: 'Watch on LightCity', url: url.href };
}
export function setupWatchShare({ document, navigator, location }) {
  const panel = document.getElementById('watch-share');
  if (!panel) return;
  const videoId = new URL(location.href).searchParams.get('v');
  const data = () => watchShare({ base: panel.dataset.watchUrl, videoId, title: document.getElementById('watch-title')?.textContent });
  let initial; try { initial = data(); } catch { return; }
  if (!initial) return;
  const share = document.getElementById('watch-share-native'), copy = document.getElementById('watch-copy-link');
  const status = document.getElementById('watch-share-status'), link = document.getElementById('watch-share-link');
  panel.hidden = false;
  share.hidden = typeof navigator.share !== 'function';
  share.addEventListener('click', async () => {
    status.textContent = '';
    try { await navigator.share(data()); }
    catch (error) { if (error.name !== 'AbortError') status.textContent = 'Use Copy link to share this recording.'; }
  });
  copy.addEventListener('click', async () => {
    const item = data(); status.textContent = '';
    try {
      if (!navigator.clipboard?.writeText) throw Error('Copy unavailable');
      await navigator.clipboard.writeText(item.url);
      status.textContent = 'LightCity link copied.'; link.hidden = true;
    } catch {
      link.value = item.url; link.hidden = false; link.focus(); link.select();
      status.textContent = 'Copy this link to share on WhatsApp or elsewhere.';
    }
  });
}
if (typeof document !== 'undefined') setupWatchShare({ document, navigator, location });
