import { createLiveSwitch, chooseTransport, availableAudioRanges, resumeYouTube, refreshYouTubeTimeline, seekYouTubePosition, settledPosition } from './media-live-core.mjs';
const node = (tag, className, text) => { const value = document.createElement(tag); if (className) value.className = className; if (text) value.textContent = text; return value; };
let hlsReady;
function hlsAPI() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (!hlsReady) hlsReady = new Promise((resolve, reject) => {
    const script = node('script'); script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.js'; script.referrerPolicy = 'no-referrer';
    const timer = setTimeout(() => { hlsReady = null; script.remove(); reject(Error('The audio player could not load. Please retry.')); }, 15000);
    script.onload = () => { clearTimeout(timer); resolve(window.Hls); };
    script.onerror = () => { clearTimeout(timer); hlsReady = null; script.remove(); reject(Error('The audio player could not load. Please retry.')); };
    document.head.appendChild(script);
  });
  return hlsReady;
}
export function checkedLiveLink(result, videoId, session, now = Date.now()) {
  const url = new URL(result?.url);
  if (result.kind !== 'live' || result.videoId !== videoId || result.session !== session || !(result.expiresAt > now + 10000) || result.expiresAt > now + 3605000 || !Number.isFinite(result.offsetSeconds) || Math.abs(result.offsetSeconds) > 600 || url.protocol !== 'https:' || !/^[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname) || url.port || url.username || url.password || url.hash || url.pathname !== `/live/${session}/audio.m3u8` || !/^\d{10}\.[a-f0-9]{64}$/.test(url.searchParams.get('token') || '') || [...url.searchParams.keys()].some(key => key !== 'token')) throw Error('This live broadcast has changed. Refresh the page to continue.');
  return url.href;
}
export function mountLive({ viewport, videoId, title, recording, onState, trackYouTube, ownFrame, releaseFrame, pauseOthers, activate, position, clearSession, onDispose }) {
  const surfaces = [...viewport.children];
  const panel = node('div', 'lc-inline-audio'), audio = node('audio');
  panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'Live audio player');
  audio.controls = true; audio.preload = 'metadata'; audio.crossOrigin = 'anonymous';
  const message = node('p', 'lc-inline-status'); message.setAttribute('role', 'status');
  panel.append(node('p', 'lc-inline-kind', '♫ LIVE AUDIO'), node('p', 'lc-inline-title', title), audio, message);
  panel.hidden = true; viewport.classList.add('lc-media-viewport'); viewport.appendChild(panel);
  let disposed = false, requested = null, frame = null, player = null, createdFrame = false, hls = null, details = null, expiresAt = 0, blocked = false, audioFailure = null, renewalTimer = null, revision = 0;
  const pending = new Set(), listeners = [];
  const waitUntil = (check, signal, timeout = 15000) => new Promise((resolve, reject) => {
    const started = performance.now(); let timer;
    const finish = error => { clearTimeout(timer); pending.delete(cancel); signal?.removeEventListener('abort', cancel); error ? reject(error) : resolve(); };
    const cancel = () => finish(new DOMException('Cancelled', 'AbortError'));
    const tick = () => {
      if (disposed || signal?.aborted) return cancel();
      try { if (check()) return finish(); } catch (error) { return finish(error); }
      if (performance.now() - started > timeout) return finish(Error('Playback could not reach that moment. Please retry.'));
      timer = setTimeout(tick, 100);
    };
    pending.add(cancel); signal?.addEventListener('abort', cancel, { once: true }); tick();
  });
  const on = (target, event, handler) => { target.addEventListener(event, handler); listeners.push(() => target.removeEventListener(event, handler)); };
  const status = text => { const friendly = text.startsWith('Preparing ') ? 'Preparing playback…' : text.startsWith('Playing with provisional') || text.startsWith('Playing with the timing') ? 'Live audio and video may take a moment to align when switching.' : text; message.textContent = friendly; onState(core.mode, friendly); };
  const show = mode => {
    panel.hidden = mode !== 'audio'; viewport.classList.toggle('lc-audio-mode', mode === 'audio');
    surfaces.forEach(surface => { surface.hidden = mode === 'audio'; });
    if (frame && !surfaces.some(surface => surface.contains(frame))) frame.hidden = mode === 'audio';
    if (mode === 'video') clearSession(item);
  };
  async function video(create) {
    frame = viewport.querySelector('iframe');
    if (!frame && create) {
      const lite = viewport.querySelector('lite-youtube');
      if (lite) { await lite.addIframe({ autoplay: false }); frame = lite.querySelector('iframe'); }
      else {
        frame = node('iframe'); frame.title = title; frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; frame.allowFullscreen = true; frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.src = 'https://www.youtube-nocookie.com/embed/' + videoId + '?' + new URLSearchParams({ enablejsapi: '1', origin: location.origin, playsinline: '1', controls: '1', rel: '0' });
        viewport.appendChild(frame); createdFrame = true;
      }
    }
    if (!frame) return null;
    ownFrame(frame, item); player = await trackYouTube(frame);
    if (disposed) { player.pauseVideo(); throw new DOMException('Cancelled', 'AbortError'); }
    return player;
  }
  async function loadAudio(signal) {
    if (!audio.getAttribute('src') || audioFailure || expiresAt <= Date.now() + 60000) {
      const generation = ++revision;
      const result = await globalThis.LightCityMembers.getLiveAudio(videoId);
      if (disposed || signal?.aborted || generation !== revision) throw new DOMException('Cancelled', 'AbortError');
      const url = checkedLiveLink(result, videoId, recording.session);
      if (result.offsetSeconds !== recording.offsetSeconds) throw Error('Broadcast timing changed. Refresh the page to continue.');
      const Hls = await hlsAPI().catch(error => { if (audio.canPlayType('application/vnd.apple.mpegurl')) return null; throw error; });
      if (disposed || signal?.aborted || generation !== revision) throw new DOMException('Cancelled', 'AbortError');
      hls?.destroy(); hls = null; details = null; audioFailure = null; expiresAt = result.expiresAt;
      audio.removeAttribute('src'); audio.load();
      const transport = chooseTransport({ hlsSupported: Hls?.isSupported() === true, nativeSupport: !!audio.canPlayType('application/vnd.apple.mpegurl') });
      if (transport === 'hls') {
        hls = new Hls({ enableWorker: true, maxBufferLength: 30, backBufferLength: 60, liveSyncDurationCount: 3, liveMaxLatencyDurationCount: Infinity, maxLiveSyncPlaybackRate: 1 });
        let continuity;
        hls.on(Hls.Events.LEVEL_UPDATED, (_event, data) => {
          details = data.details;
          const next = data.details.fragments?.at(-1)?.cc;
          if (continuity !== undefined && next !== undefined && next !== continuity) core.invalidate('The live stream restarted. Please choose Watch or Listen again.');
          continuity = next;
        });
        hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) { audioFailure = 'Live audio could not load. Press Listen to retry.'; status(audioFailure); } });
        hls.loadSource(url); hls.attachMedia(audio);
      } else if (transport === 'native') { audio.src = url; audio.load(); }
      else throw Error('Live audio is not supported in this browser. Please use Watch.');
      clearTimeout(renewalTimer);
      const renew = () => {
        expiresAt = 0;
        if (disposed) return;
        if (requested) { renewalTimer = setTimeout(renew, 10000); return; }
        if (core.mode === 'audio') void item.switchTo('audio');
      };
      renewalTimer = setTimeout(renew, Math.max(30000, expiresAt - Date.now() - 120000));
    }
    await waitUntil(() => { if (audioFailure) throw Error(audioFailure); return audio.readyState >= 1 && availableAudioRanges(audio, details).length > 0; }, signal, 30000);
  }
  const item = { viewport, videoId, title, audio, liveSession: recording.session, liveOffset: recording.offsetSeconds,
    onAutoplayBlocked() { blocked = true; },
    get mode() { return requested === 'video' ? 'video' : core.mode; },
    async switchTo(mode) {
      if (disposed) return;
      const ticket = Symbol(); item.request = ticket; requested = mode;
      try { await core.switchTo(mode); } finally { if (item.request === ticket) { requested = null; onState(core.mode, message.textContent); } }
    },
    dispose() {
      if (disposed) return;
      disposed = true; revision++; core.dispose(); clearTimeout(renewalTimer); pending.forEach(cancel => cancel()); listeners.forEach(remove => remove());
      hls?.destroy(); audio.removeAttribute('src'); audio.load(); panel.remove();
      surfaces.forEach(surface => { surface.hidden = false; }); viewport.classList.remove('lc-media-viewport', 'lc-audio-mode');
      if (frame) { releaseFrame(frame, createdFrame ? player : null); if (createdFrame) { player?.destroy(); frame.remove(); } else frame.hidden = false; }
      clearSession(item); onDispose(item); onState('video', '');
    }
  };
  const core = createLiveSwitch({
    readVideo: async signal => {
      const current = await video(false);
      if (!current || [-1, 5].includes(current.getPlayerState())) {
        await loadAudio(signal);
        const latest = availableAudioRanges(audio, details).at(-1);
        const liveAt = Number.isFinite(hls?.liveSyncPosition) ? hls.liveSyncPosition : Math.max(latest[0], latest[1] - 12);
        return { time: Math.max(0, liveAt - recording.offsetSeconds), playing: true, rate: 1 };
      }
      return { time: current.getCurrentTime(), playing: [1, 3].includes(current.getPlayerState()), rate: current.getPlaybackRate() };
    },
    readAudio: () => ({ time: audio.currentTime, playing: !audio.paused && !audio.ended, rate: audio.playbackRate }),
    pauseBoth: () => { audio.pause(); player?.pauseVideo(); }, show, status,
    ranges: mode => mode === 'video' ? null : availableAudioRanges(audio, details).map(([start, end]) => [start, Math.max(start, end - 0.1)]),
    ready: async (mode, signal) => { if (mode === 'audio') await loadAudio(signal); else await video(true); },
    seek: async (mode, time, rate, signal) => {
      if (mode === 'audio') {
        audio.playbackRate = rate; hls?.stopLoad(); hls?.startLoad(time); audio.currentTime = time;
        await waitUntil(settledPosition(() => ({ time: audio.currentTime, ready: !audio.seeking && audio.readyState >= 3 && availableAudioRanges({ readyState: audio.readyState, seekable: audio.buffered, buffered: audio.buffered }).some(([start, end]) => time >= start && time < end) }), time, { tolerance: 0.25 }), signal, 20000);
      } else {
        show('video'); const muted = player.isMuted(); let prepared = false; player.mute();
        try {
          await refreshYouTubeTimeline(player, time, { waitUntil, signal, blocked: () => blocked });
          await resumeYouTube(player, { waitUntil, signal, blocked: () => blocked });
          await seekYouTubePosition(player, time, { videoId, waitUntil, signal });
          if (player.getAvailablePlaybackRates().includes(rate)) player.setPlaybackRate(rate);
          prepared = true;
        } finally { if (!prepared) player.pauseVideo(); if (!muted) player.unMute(); }
      }
    },
    play: async (mode, signal) => {
      if (mode === 'audio') { pauseOthers(audio); await audio.play(); activate(item); }
      else { pauseOthers(null, player); blocked = false; await resumeYouTube(player, { waitUntil, signal, blocked: () => blocked }); }
    },
    verify: async (mode, target, playing, rate, signal) => {
      const started = performance.now();
      await waitUntil(() => {
        const elapsed = (performance.now() - started) / 1000, current = mode === 'audio' ? audio.currentTime : player.getCurrentTime();
        if (Math.abs(current - target - (playing ? elapsed * rate : 0)) > (mode === 'audio' ? 0.75 : 1.5)) throw Error('Playback did not stay at the matching moment. Please retry the switch.');
        return elapsed >= 1.2;
      }, signal, 4000);
    }
  }, { session: recording.session, videoId });
  if (recording.offsetSeconds) core.setOffset(recording.offsetSeconds);
  on(audio, 'play', () => { if (core.mode !== 'audio') audio.pause(); else { pauseOthers(audio); activate(item); } });
  on(audio, 'pause', () => { if (navigator.mediaSession && core.mode === 'audio') navigator.mediaSession.playbackState = 'paused'; });
  on(audio, 'timeupdate', () => position(item));
  on(audio, 'error', () => { if (!disposed && core.mode === 'audio') { audioFailure = 'Live audio could not load. Press Listen to retry.'; status(audioFailure); } });
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  return item;
}
