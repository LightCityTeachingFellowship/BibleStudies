// Per-tab playback checkpoint only. Never persist capability URLs or credentials.
const KEY = 'lc-listening-session';
let leaving = false;
const page = () => new URL(location.href).pathname + new URL(location.href).search;
export function savedListening() {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY));
    if (value?.version === 1 && value.page === page() && /^[\w-]{11}$/.test(value.videoId) && Number.isFinite(value.seconds) && value.seconds >= 0 && Number.isFinite(value.rate) && value.rate >= 0.25 && value.rate <= 4 && typeof value.playing === 'boolean' && Date.now() - value.savedAt >= 0 && Date.now() - value.savedAt < 12 * 3600000 && (value.session === null || /^session-\d{13}$/.test(value.session))) return value;
  } catch {}
  return null;
}
function forget(item) {
  try { const value = savedListening(); if (value?.videoId === item.videoId) sessionStorage.removeItem(KEY); } catch {}
}
export function keepListening(item, controllers) {
  let lastSaved = 0;
  const save = () => {
    if (leaving || !controllers.has(item) || item.mode !== 'audio') return;
    try { sessionStorage.setItem(KEY, JSON.stringify({ version: 1, page: page(), videoId: item.videoId, seconds: item.audio.currentTime, rate: item.audio.playbackRate, playing: !item.audio.paused && !item.audio.ended, session: item.liveSession || null, savedAt: Date.now() })); } catch {}
  };
  for (const event of ['play', 'pause', 'ratechange']) item.audio.addEventListener(event, save);
  item.audio.addEventListener('timeupdate', () => { if (Date.now() - lastSaved > 5000) { lastSaved = Date.now(); save(); } });
  const dispose = item.dispose;
  item.dispose = () => { if (!leaving) forget(item); dispose.call(item); };
  item.saveListening = save;
  item.restoreListening = async value => {
    if (value.videoId !== item.videoId || value.session !== (item.liveSession || null)) return;
    item.resumeCheckpoint = value;
    try { await item.switchTo('audio'); } finally { delete item.resumeCheckpoint; }
    if (!controllers.has(item) || item.mode !== 'audio') return;
    const audio = item.audio;
    let reachable = !item.liveSession;
    for (let i = 0; i < (audio.seekable?.length || 0); i++) if (value.seconds >= audio.seekable.start(i) && value.seconds < audio.seekable.end(i)) reachable = true;
    if (reachable) audio.currentTime = Number.isFinite(audio.duration) ? Math.min(value.seconds, Math.max(0, audio.duration - 0.01)) : value.seconds;
    audio.playbackRate = value.rate;
    if (value.playing) { try { await audio.play(); } catch {} } else audio.pause();
    save();
  };
  return item;
}
export function listeningLifecycle(controllers) {
  document.addEventListener?.('visibilitychange', () => { for (const item of controllers) item.saveListening?.(); });
  window.addEventListener?.('pagehide', event => { for (const item of controllers) item.saveListening?.(); leaving = !event.persisted; });
  window.addEventListener?.('pageshow', () => { leaving = false; });
}
