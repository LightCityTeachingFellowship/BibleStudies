import { personal } from './video-personal.js?v=shell-1';
import { createModeSwitch } from './media-mode-core.mjs';
import { mountLive } from './live-media.js?v=saved-history-1';
import { keepListening, savedListening, listeningLifecycle } from './listening-session.mjs';

const framePlayers = new WeakMap(), frameOwners = new WeakMap(), youtubePlayers = new Set(), controllers = new Set();
let apiPromise, activeAudio;
listeningLifecycle(controllers);
const storageKey = id => 'lc-audio-progress:' + id;
const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };
function youtubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const old = window.onYouTubeIframeAPIReady;
    const timer = setTimeout(() => { apiPromise = null; reject(Error('YouTube API unavailable')); }, 15000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      try { old?.(); } catch {}
      resolve(window.YT);
    };
    const script = element('script'); script.src = 'https://www.youtube.com/iframe_api'; script.async = true;
    script.onerror = () => { clearTimeout(timer); apiPromise = null; script.remove(); reject(Error('YouTube API unavailable')); };
    document.head.appendChild(script);
  });
  return apiPromise;
}
function pauseOthers(audio, video) {
  for (const item of controllers) if (item.audio !== audio) item.audio.pause();
  for (const player of youtubePlayers) if (player !== video) try { if (player.getIframe?.()?.isConnected === false) youtubePlayers.delete(player); else player.pauseVideo(); } catch {}
}
export function trackYouTube(frame, { autoplay = false } = {}) {
  if (framePlayers.has(frame)) return framePlayers.get(frame);
  const ready = youtubeAPI().then(YT => new Promise((resolve, reject) => {
    if (frame.isConnected === false) { reject(Error('Player removed')); return; }
    const timer = setTimeout(() => reject(Error('Video player unavailable')), 15000);
    new YT.Player(frame, { events: {
      onReady: async event => {
        clearTimeout(timer); const player = event.target; youtubePlayers.add(player);
        let id;
        try { id = new URL(frame.src || frame.getAttribute?.('src'), location.href || location.origin).pathname.split('/').pop(); } catch {}
        if (/^[\w-]{11}$/.test(id || '')) {
          let explicit = false; try { explicit = new URL(frame.src || frame.getAttribute('src')).searchParams.has('start'); } catch {}
          const held = !explicit && !frameOwners.has(frame) && player.getCurrentTime() < 2;
          const wasPlaying = [1,3].includes(player.getPlayerState());
          if (held) player.pauseVideo();
          await Promise.race([personal.ready, new Promise(done=>{const t=setTimeout(done,1500);t.unref?.();})]);
          const owner = personal.scope;
          const save = () => { try { if (frameOwners.get(frame)?.mode === 'audio') return; if(player.getPlayerState()===1)frame.lcHistoryStarted=true;if(!frame.lcHistoryStarted)return; personal.record({ videoId:id, title:player.getVideoData?.()?.title || frame.title, seconds:player.getCurrentTime(), duration:player.getDuration(), rate:player.getPlaybackRate(), mode:'video', completed:player.getPlayerState()===0 },owner); } catch {} };
          if (!explicit && !frameOwners.has(frame)) {
            const row = await Promise.race([personal.forVideo(id), new Promise(done=>{ const t=setTimeout(done,1500); t.unref?.(); })]);
            if (frame.isConnected !== false && personal.scope === owner && row && !row.completed && row.seconds > 5 && player.getCurrentTime() < 2) player.seekTo(row.seconds,true);
          }
          const visibility=()=>{if(document.visibilityState==='hidden')save();};
          const releaseHistory=()=>{clearInterval(historyTimer);window.removeEventListener?.('pagehide',save);document.removeEventListener?.('visibilitychange',visibility);delete frame.lcSaveHistory;};
          const historyTimer = setInterval(()=>{ try{if(frame.isConnected===false){releaseHistory();return;}if(player.getPlayerState()===1)save();}catch{releaseHistory();} },5000); historyTimer.unref?.();
          frame.lcSaveHistory = save;
          if (held && (wasPlaying || autoplay) && frameOwners.get(frame)?.mode !== 'audio' && frame.isConnected !== false) player.playVideo();
          window.addEventListener?.('pagehide',save); document.addEventListener?.('visibilitychange',visibility);
        }
        resolve(player);
        if (frameOwners.get(frame)?.mode === 'audio') player.pauseVideo();
        else if (autoplay && ![0, 2].includes(player.getPlayerState())) player.playVideo();
      },
      onStateChange: event => {
        if ([0,1,2].includes(event.data)) { frame.lcSaveHistory?.(); if(event.data!==1)void personal.flush(); }
        if (event.data !== 1) return;
        if (frameOwners.get(frame)?.mode === 'audio') { event.target.pauseVideo(); return; }
        pauseOthers(null, event.target);
      },
      onError: () => { clearTimeout(timer); reject(Error('Video unavailable')); },
      onAutoplayBlocked: () => frameOwners.get(frame)?.onAutoplayBlocked?.()
    } });
  }));
  framePlayers.set(frame, ready);
  ready.catch(() => { framePlayers.delete(frame); });
  return ready;
}
function waitForMetadata(audio, signal) {
  if (signal.aborted) return Promise.reject(Error('Cancelled'));
  if (audio.readyState >= 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = error => { clearTimeout(timer); audio.removeEventListener('loadedmetadata', loaded); audio.removeEventListener('error', failed); signal.removeEventListener('abort', failed); error ? reject(error) : resolve(); };
    const loaded = () => finish(); const failed = () => finish(Error('Audio unavailable'));
    const timer = setTimeout(failed, 20000);
    audio.addEventListener('loadedmetadata', loaded); audio.addEventListener('error', failed); signal.addEventListener('abort', failed, { once: true });
  });
}
function remember(id, audio) {
  if (globalThis.LightCityVideos) return;
  try { localStorage.setItem(storageKey(id), JSON.stringify({ seconds: audio.currentTime, rate: audio.playbackRate })); } catch {}
}
function session(item) {
  if (!navigator.mediaSession) return;
  activeAudio = item;
  navigator.mediaSession.playbackState = item.audio.paused ? 'paused' : 'playing';
  if (window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: item.title, artist: 'LightCity Teaching Fellowship', artwork: [{ src: 'https://i.ytimg.com/vi/' + item.videoId + '/hqdefault.jpg', sizes: '480x360', type: 'image/jpeg' }] });
  const seek = time => { if (Number.isFinite(item.audio.duration)) item.audio.currentTime = Math.max(0, Math.min(time, item.audio.duration)); };
  const actions = { play: () => void item.audio.play().catch(() => {}), pause: () => item.audio.pause(), seekbackward: event => seek(item.audio.currentTime - (event.seekOffset || 15)), seekforward: event => seek(item.audio.currentTime + (event.seekOffset || 15)), seekto: event => seek(event.seekTime) };
  for (const [name, handler] of Object.entries(actions)) try { navigator.mediaSession.setActionHandler(name, handler); } catch {}
}
function positionState(item) {
  if (activeAudio !== item || !navigator.mediaSession || !Number.isFinite(item.audio.duration) || item.audio.duration <= 0) return;
  try { navigator.mediaSession.setPositionState({ duration: item.audio.duration, position: Math.min(item.audio.currentTime, item.audio.duration), playbackRate: item.audio.playbackRate }); } catch {}
}
export function mount({ viewport, videoId, title, onState = () => {}, audio: existingAudio = null, expiresAt: initialExpiry = 0, recording = null }) {
  if (!/^[\w-]{11}$/.test(videoId)) throw Error('Invalid recording');
  if (recording?.kind === 'live') {
    const item = mountLive({ viewport, videoId, title, recording, onState, trackYouTube, pauseOthers, activate: session, position: positionState,
      ownFrame: (frame, owner) => frameOwners.set(frame, owner),
      releaseFrame: (frame, player) => { frameOwners.delete(frame); if (player) { youtubePlayers.delete(player); framePlayers.delete(frame); } },
      clearSession: owner => { if (activeAudio === owner) { activeAudio = null; if (navigator.mediaSession) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; } } },
      onDispose: owner => controllers.delete(owner)
    });
    controllers.add(item); personal.attachAudio(item); return keepListening(item, controllers);
  }
  const audio = existingAudio || element('audio');
  const panel = element('div', 'lc-inline-audio'); panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'Audio player');
  const kind = element('p', 'lc-inline-kind', '♫ AUDIO');
  const heading = element('p', 'lc-inline-title', title);
  const message = element('p', 'lc-inline-status'); message.setAttribute('role', 'status');
  const originalParent = existingAudio?.parentNode;
  const surfaces = Array.from(viewport.children).filter(child => child !== audio);
  audio.controls = true; audio.preload = 'metadata'; audio.crossOrigin = 'anonymous';
  panel.append(kind, heading, audio, message);
  let speed;
  if (!existingAudio) {
    speed = element('select'); speed.setAttribute('aria-label', 'Audio playback speed');
    for (const rate of [0.5, 0.75, 1, 1.25, 1.5, 2]) { const option = element('option', '', rate + '×'); option.value = rate; option.selected = rate === 1; speed.appendChild(option); }
    panel.appendChild(speed);
  }
  panel.hidden = !existingAudio; viewport.classList.add('lc-media-viewport'); viewport.appendChild(panel);
  let player, frame, expiresAt = initialExpiry, disposed = false, lastSaved = 0, core, createdFrame = false, changing = false, recovering = false, wantsPlayback = false, retryTimer = null, retries = 0;
  const listeners = [];
  const on = (target, name, callback) => { if (!target.addEventListener) return; target.addEventListener(name, callback); listeners.push(() => target.removeEventListener(name, callback)); };
  const clearSession = () => { if (activeAudio === item) { activeAudio = null; if (navigator.mediaSession) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; } } };
  async function video(create = false) {
    frame = viewport.querySelector('iframe');
    if (!frame && create) {
      const lite = viewport.querySelector('lite-youtube');
      if (lite) { await lite.addIframe({ autoplay: false }); frame = lite.querySelector('iframe'); }
      else {
        frame = element('iframe'); frame.title = title; frame.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen'; frame.allowFullscreen = true;
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        const params = new URLSearchParams({ enablejsapi: '1', origin: location.origin, playsinline: '1', controls: '1', rel: '0' });
        frame.src = 'https://www.youtube-nocookie.com/embed/' + videoId + '?' + params;
        viewport.appendChild(frame); createdFrame = true;
      }
    }
    if (!frame) return null;
    frameOwners.set(frame, item);
    player = await trackYouTube(frame);
    if (disposed) { player.pauseVideo(); return null; }
    return player;
  }
  let saved = {};
  try { saved = personal.history(videoId) || (!globalThis.LightCityVideos ? JSON.parse(localStorage.getItem(storageKey(videoId))) : {}) || {}; } catch {}
  const item = { viewport, videoId, title, audio, get mode() { return core?.mode || (existingAudio ? 'audio' : 'video'); }, switchTo: async mode => { changing = true; try { await core.switchTo(mode); } finally { changing = false; } }, dispose: () => core.dispose() };
  core = createModeSwitch({
    initialMode: existingAudio ? 'audio' : 'video', initialPosition: existingAudio?.currentTime || saved.seconds || 0,
    getRate: () => audio.playbackRate || 1,
    readAudio: () => core.readPendingAudio() || ({ time: audio.currentTime, playing: !audio.paused && !audio.ended, rate: audio.playbackRate }),
    readVideo: async () => { if (item.resumeCheckpoint) return { time: item.resumeCheckpoint.seconds, playing: false, rate: item.resumeCheckpoint.rate }; const current = await video();
      if (!current || [-1,5].includes(current.getPlayerState())) {
        const row = await personal.forVideo(videoId); let time = personal.resume(videoId);
        try { const query = new URLSearchParams(location.search); if(query.get('v')===videoId && query.has('t')) { const n=Number(query.get('t')); if(Number.isFinite(n)&&n>=0&&n<=172800)time=n; } } catch {}
        if(time || row?.completed) return { time, playing:true, rate:row?.rate || 1 };
      }
      return current ? { time: current.getCurrentTime(), playing: ![0,2].includes(current.getPlayerState()), rate:current.getPlaybackRate() } : null; },
    pauseAudio: () => { if (audio.readyState >= 1) remember(videoId, audio); audio.pause(); },
    pauseVideo: () => { try { player?.pauseVideo(); } catch {} },
    show: mode => {
      viewport.classList.toggle('lc-audio-mode', mode === 'audio'); panel.hidden = mode !== 'audio';
      for (const surface of surfaces) surface.hidden = mode === 'audio';
      if (frame && !surfaces.some(surface => surface.contains(frame))) frame.hidden = mode === 'audio';
      if (mode === 'video') clearSession();
    },
    loadAudio: async signal => {
      if (!audio.getAttribute('src') || expiresAt <= Date.now() + 30000 || audio.error) {
        const result = await globalThis.LightCityMembers.getAudio(videoId);
        if (signal.aborted || disposed) return;
        const url = new URL(result.url);
        if (url.protocol !== 'https:' || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(url.hostname) || result.videoId !== videoId || !(result.expiresAt > Date.now())) throw Error('Invalid audio link');
        expiresAt = result.expiresAt; audio.src = url.href; audio.load();
      }
      await waitForMetadata(audio, signal);
    },
    seekAudio: (time, rate) => { audio.currentTime = Number.isFinite(audio.duration) ? Math.min(time, Math.max(0, audio.duration - 0.01)) : time; audio.playbackRate = rate; if (speed) speed.value = String(rate); session(item); positionState(item); },
    playAudio: () => { pauseOthers(audio); return audio.play(); },
    loadVideo: () => video(true),
    seekVideo: (time, rate) => { player.seekTo(time, true); const rates = player.getAvailablePlaybackRates?.() || [1]; if (rates.includes(rate)) player.setPlaybackRate(rate); },
    playVideo: () => { pauseOthers(null, player); player.playVideo(); },
    onState: (mode, text) => { message.textContent = text || 'Continue listening with your screen locked.'; onState(mode, text); },
    dispose: () => {
      disposed = true; clearTimeout(retryTimer); listeners.forEach(remove => remove()); controllers.delete(item); clearSession();
      if (frame) frameOwners.delete(frame);
      if (existingAudio && originalParent) originalParent.appendChild(audio);
      else { audio.removeAttribute('src'); audio.load(); }
      panel.remove(); viewport.classList.remove('lc-media-viewport', 'lc-audio-mode');
      surfaces.forEach(surface => { surface.hidden = false; });
      if (createdFrame && frame) { try { player?.destroy(); } catch {} youtubePlayers.delete(player); framePlayers.delete(frame); frame.remove(); }
      else if (frame) frame.hidden = false;
      onState('video', '');
    }
  });
  on(audio, 'play', () => {
    if (item.mode !== 'audio') { audio.pause(); return; }
    wantsPlayback = true; retries = 0;
    if (expiresAt && expiresAt <= Date.now()) { void item.switchTo('audio'); return; }
    pauseOthers(audio); session(item); message.textContent = 'Continue listening with your screen locked.';
    if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
  });
  on(audio, 'pause', () => { if (!changing && !recovering && !audio.error) wantsPlayback = false; if (audio.readyState >= 1) remember(videoId, audio); if (activeAudio === item && navigator.mediaSession) navigator.mediaSession.playbackState = 'paused'; });
  on(audio, 'timeupdate', () => { positionState(item); if (Date.now() - lastSaved > 5000) { lastSaved = Date.now(); remember(videoId, audio); } });
  on(audio, 'ratechange', () => positionState(item));
  const recover = async () => {
    if (disposed || changing || recovering || !wantsPlayback || item.mode !== 'audio' || retries >= 3) return;
    if (!audio.error && audio.readyState >= 3) { session(item); return; }
    recovering = true; retries++; expiresAt = 0;
    try { await item.switchTo('audio'); if (!disposed && item.mode === 'audio' && !audio.error) await audio.play(); }
    catch {} finally { recovering = false; }
  };
  on(audio, 'error', () => {
    if (item.mode !== 'audio' || !audio.getAttribute('src')) return;
    message.textContent = 'Audio connection interrupted. Reconnecting…';
    if (!retryTimer && wantsPlayback && retries < 3) retryTimer = setTimeout(() => { retryTimer = null; void recover(); }, 2000);
  });
  on(window, 'online', () => void recover()); on(window, 'pageshow', () => void recover());
  on(document, 'visibilitychange', () => { if (document.visibilityState !== 'hidden') void recover(); });
  if (speed) on(speed, 'change', () => { audio.playbackRate = Number(speed.value); remember(videoId, audio); });
  controllers.add(item);
  if (existingAudio) { surfaces.forEach(surface => { surface.hidden = true; }); viewport.classList.add('lc-audio-mode'); }
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  personal.attachAudio(item);
  return keepListening(item,controllers);
}
globalThis.LightCityMedia = { mount, trackYouTube, savedListening };

window.dispatchEvent?.(new Event('lightcity-media-ready'));
for (const frame of document.querySelectorAll?.('#videotab-container iframe, #watch-player iframe') || []) void trackYouTube(frame).catch(() => {});
