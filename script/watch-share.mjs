import {videoShareLink} from './share-links.mjs?v=1';
export function watchShare({ base, videoId, title }) {
  if (!/^[\w-]{11}$/.test(videoId || '')) return null;
  const url = new URL(base);
  if (url.protocol !== 'https:') return null;
  const preview=videoShareLink(videoId,{base:url.href});
  return { title: String(title || 'Watch on LightCity').trim(), text: String(title || 'Watch on LightCity').trim(), url: preview };
}
export function setupWatchMenu(document) {
  const menu=document.getElementById('watch-menu'), toggle=document.getElementById('watch-menu-toggle');
  if(!menu || !toggle)return () => {};
  const close=(focus=false)=>{if(!menu.open)return;menu.open=false;if(focus)toggle.focus();};
  document.addEventListener('click',event=>{if(menu.open&&!menu.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){event.preventDefault();close(true);}});
  menu.addEventListener('focusout',event=>{if(event.relatedTarget&&!menu.contains(event.relatedTarget))close();});
  // Save stays open so its updated state remains visible.
  return () => close(true);
}
export function setupWatchShare({ document, navigator, location }) {
  const closeMenu=setupWatchMenu(document);
  const panel = document.getElementById('watch-share');
  if (!panel) return;
  const videoId = new URL(location.href).searchParams.get('v');
  const data = () => watchShare({ base: panel.dataset.watchUrl, videoId, title: document.getElementById('watch-title')?.textContent });
  let initial; try { initial = data(); } catch { return; }
  if (!initial) return;
  const share = document.getElementById('watch-share-native'), copy = document.getElementById('watch-copy-link');
  const status = document.getElementById('watch-share-status'), link = document.getElementById('watch-share-link');
  panel.hidden = false;
  share.hidden = false;
  share.addEventListener('click', async () => {
    status.textContent = '';
    if(typeof navigator.share!=='function'){copy.click();return;}
    closeMenu();
    try { await navigator.share(data()); }
    catch (error) { if (error.name !== 'AbortError') status.textContent = 'Use Copy link to share this recording.'; }
  });
  copy.addEventListener('click', async () => {
    const item = data(); status.textContent = '';closeMenu();
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
