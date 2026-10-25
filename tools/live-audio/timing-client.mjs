import { createLiveSwitch, chooseTransport, availableAudioRanges, resumeYouTube, refreshYouTubeTimeline, seekYouTubePosition, settledPosition } from './live-sync.mjs';
const $ = id => document.getElementById(id);
const audio = $('audio'), select = $('session'), status = $('status');
const videoId = new URL(location.href).searchParams.get('video');
let yt = null, hls = null, sync = null, selected = '', generation = 0, list = [], requestedMode = null, audioDetails = null;
let videoAutoplayBlocked = false;
const aborted = () => new DOMException('Cancelled', 'AbortError');
function pauseBoth() { audio.pause(); yt?.pauseVideo?.(); }
function waitUntil(check, signal, timeout = 15000) {
  return new Promise((accept, reject) => {
    const started = performance.now(); let timer;
    const cancel = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); reject(aborted()); };
    function tick() {
      if (signal?.aborted) { cancel(); return; }
      try { if (check()) { signal?.removeEventListener('abort', cancel); accept(); return; } } catch (error) { signal?.removeEventListener('abort', cancel); reject(error); return; }
      if (performance.now() - started > timeout) { signal?.removeEventListener('abort', cancel); reject(Error('The player did not become ready. Check the test feed and try again.')); return; }
      timer = setTimeout(tick, 100);
    }
    signal?.addEventListener('abort', cancel, { once: true }); tick();
  });
}
async function youtube() {
  await new Promise((accept, reject) => {
    if (window.YT?.Player) { accept(); return; }
    const timer = setTimeout(() => reject(Error('YouTube player code could not load. Check your connection.')), 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); accept(); };
    const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; document.head.append(script);
  });
  return new Promise((accept, reject) => {
    const timer = setTimeout(() => reject(Error('YouTube did not initialize. Check that this test allows embedding.')), 15000);
    yt = new window.YT.Player('youtube', { width: '100%', height: '100%', videoId, playerVars: { playsinline: 1, origin: location.origin, enablejsapi: 1, rel: 0 }, events: {
      onReady: () => { clearTimeout(timer); accept(yt); },
      onAutoplayBlocked: () => { videoAutoplayBlocked = true; },
      onError: () => { clearTimeout(timer); status.textContent = 'YouTube cannot play this test here. Check the broadcast URL, availability, and embedding settings.'; reject(Error(status.textContent)); },
      onStateChange: event => { if (event.data === 1) { if (sync?.mode === 'audio' && requestedMode !== 'video') yt.pauseVideo(); else audio.pause(); } }
    } });
  });
}
function ranges(mode) {
  // The iframe API exposes duration, not DVR seekable ranges. In particular,
  // duration can lag while this paused iframe is hidden behind audio mode.
  // null means unknown: validate the requested position with the actual seek.
  if (mode === 'video') return null;
  return availableAudioRanges(audio, audioDetails).map(([start, end]) => [start, Math.max(start, end - 0.1)]);
}
function show(mode) {
  $('video-view').hidden = mode !== 'video'; $('audio-view').hidden = mode !== 'audio';
  $('watch').setAttribute('aria-pressed', String(mode === 'video')); $('listen').setAttribute('aria-pressed', String(mode === 'audio'));
}
async function bind(id) {
  const ticket = ++generation;
  sync?.dispose(); sync = null; hls?.destroy(); hls = null; pauseBoth();
  audio.removeAttribute('src'); audio.load(); selected = id; audioDetails = null;
  $('offset').value = '0'; $('report').textContent = ''; show('video');
  $('watch').disabled = $('listen').disabled = true;
  if (!id) return;
  let audioFailure = null;
  try {
  const failAudio = message => { if (ticket !== generation) return; audioFailure = message; if (sync) sync.invalidate(message); else status.textContent = message; };
  audio.onerror = () => failAudio('The audio stream could not load (media error ' + (audio.error?.code || 0) + '). Check the current test feed.');
  const src = '/streams/' + id + '/audio.m3u8';
  const transport = chooseTransport({ hlsSupported: window.Hls?.isSupported() === true, nativeSupport: !!audio.canPlayType('application/vnd.apple.mpegurl') });
  if (transport === 'hls') {
    hls = new window.Hls({ enableWorker: true, liveDurationInfinity: false, maxBufferLength: 30, backBufferLength: 60, liveSyncDurationCount: 3, liveMaxLatencyDurationCount: Infinity, maxLiveSyncPlaybackRate: 1 });
    let continuity = null;
    hls.on(window.Hls.Events.LEVEL_UPDATED, (_event, data) => {
      if (ticket !== generation) return;
      audioDetails = data.details;
      const cc = data.details.fragments?.at(-1)?.cc;
      if (continuity !== null && cc !== undefined && cc !== continuity) { sync?.invalidate('The audio stream restarted. Check timing again.'); $('report').textContent = ''; }
      continuity = cc ?? continuity;
    });
    hls.on(window.Hls.Events.ERROR, (_event, data) => { if (data.fatal) failAudio('Audio could not load (' + data.details + '). Check the receiver and reload this timing page.'); });
    hls.loadSource(src); hls.attachMedia(audio);
  } else if (transport === 'native') { audio.src = src; audio.load(); }
  else { status.textContent = 'This browser could not load the HLS audio player.'; return; }
    const audioReady = () => { if (audioFailure) throw Error(audioFailure); return audio.readyState >= 1 && availableAudioRanges(audio, audioDetails).length > 0; };
    await waitUntil(() => yt?.getPlayerState && audioReady(), undefined, 60000);
    if (ticket !== generation) return;
    sync = createLiveSwitch({
      readVideo: async signal => { await waitUntil(() => Number(yt?.getDuration?.()) > 0, signal); return { time: yt.getCurrentTime(), playing: [1, 3].includes(yt.getPlayerState()), rate: yt.getPlaybackRate() }; },
      readAudio: () => ({ time: audio.currentTime, playing: !audio.paused && !audio.ended, rate: audio.playbackRate }),
      pauseBoth, show, ranges,
      status: text => { status.textContent = text; },
      ready: async (mode, signal) => { await waitUntil(() => mode === 'audio' ? audioReady() : Number(yt.getDuration()) > 0, signal); },
      seek: async (mode, time, rate, signal) => {
        if (mode === 'audio') {
          audio.playbackRate = rate;
          hls?.stopLoad(); hls?.startLoad(time); audio.currentTime = time;
          await waitUntil(settledPosition(() => ({ time: audio.currentTime, ready: !audio.seeking && audio.readyState >= 3 && availableAudioRanges({ readyState: audio.readyState, seekable: audio.buffered, buffered: audio.buffered }).some(([start, end]) => time >= start && time < end) }), time, { tolerance: 0.25 }), signal, 15000);
        } else {
          if (yt.getAvailablePlaybackRates().includes(rate)) yt.setPlaybackRate(rate);
          // Restore the embedded surface before seeking: hidden live iframes can
          // defer DVR seek updates. The coordinator restores audio on failure.
          show('video');
          // Wake a stale live edge silently before seeking beyond it.
          videoAutoplayBlocked = false;
          const muted = yt.isMuted();
          let prepared = false;
          yt.mute();
          try {
            await refreshYouTubeTimeline(yt, time, { waitUntil, signal, blocked: () => videoAutoplayBlocked });
            // Live DVR seeks need an active decoder to acknowledge the new
            // position reliably. Keep it silent until that position is verified.
            await resumeYouTube(yt, { waitUntil, signal, blocked: () => videoAutoplayBlocked });
            await seekYouTubePosition(yt, time, { videoId, waitUntil, signal });
            // A fresh load resets YouTube's playback rate.
            if (yt.getAvailablePlaybackRates().includes(rate)) yt.setPlaybackRate(rate);
            prepared = true;
          } catch (error) {
            if (signal.aborted) throw error;
            throw Error('Video could not reach this moment yet. Staying with audio; try Watch again shortly.');
          } finally {
            if (!prepared) yt.pauseVideo();
            if (!muted) yt.unMute();
          }
        }
      },
      play: async (mode, signal) => {
        if (mode === 'audio') return audio.play();
        videoAutoplayBlocked = false;
        await resumeYouTube(yt, { waitUntil, signal, blocked: () => videoAutoplayBlocked });
      },
      verify: async (mode, target, playing, rate, signal) => {
        const started = performance.now();
        await waitUntil(() => {
          const elapsed = (performance.now() - started) / 1000;
          const current = mode === 'audio' ? audio.currentTime : yt.getCurrentTime();
          const expected = target + (playing ? elapsed * rate : 0);
          if (Math.abs(current - expected) > (mode === 'audio' ? 0.75 : 1.5)) throw Error('The player returned to its previous position. Staying with the outgoing player; please retry.');
          return elapsed >= 1.2;
        }, signal, 4000);
      }
    }, { session: id, videoId });
    $('watch').disabled = $('listen').disabled = false;
    status.textContent = 'Players ready. Play the YouTube video first, then test Listen during a clear sentence. Timing is provisional until checked.';
  } catch (error) { if (ticket === generation) status.textContent = error.message; }
}
async function refresh() {
  try {
    const response = await fetch('/sessions', { cache: 'no-store' }); if (!response.ok) throw Error();
    list = await response.json(); select.replaceChildren();
    if (!list.length) { const option = document.createElement('option'); option.value = ''; option.textContent = 'Waiting for a test feed…'; select.append(option); return; }
    for (const item of list) { const option = document.createElement('option'); option.value = item.id; option.textContent = new Date(item.startedAt).toLocaleString() + (item.ended ? ' · recording' : ' · live test'); select.append(option); }
    select.value = selected || list[0].id;
    // Never silently attach a running calibration to a different capture.
    if (!selected) void bind(list[0].id);
  } catch { status.textContent = 'Cannot reach the local timing server. Keep its terminal open.'; }
}
async function switchTo(mode) { if (!sync) return; requestedMode = mode; try { await sync.switchTo(mode); } finally { requestedMode = null; } }
$('watch').addEventListener('click', () => void switchTo('video'));
$('listen').addEventListener('click', () => void switchTo('audio'));
audio.addEventListener('play', () => yt?.pauseVideo?.());
select.addEventListener('change', () => void bind(select.value));
function adjust(value) { try { sync?.setOffset(value); $('offset').value = String(value); $('report').textContent = ''; } catch (error) { status.textContent = error.message; } }
$('offset').addEventListener('change', () => adjust(Number($('offset').value)));
$('earlier').addEventListener('click', () => adjust(Number($('offset').value) - 0.5));
$('later').addEventListener('click', () => adjust(Number($('offset').value) + 0.5));
$('confirm').addEventListener('click', () => { if (!sync) return; try { const report = sync.confirm(); $('report').textContent = JSON.stringify(report, null, 2); status.textContent = 'Your timing confirmation is recorded for this session in this page. Recheck after a restart or source change.'; } catch (error) { status.textContent = error.message; } });
let refreshTimer, readoutTimer;
if (!/^[\w-]{11}$/.test(videoId || '')) status.textContent = 'Open this page using the current YouTube test video ID.';
else {
  $('watch-link').href = 'https://www.youtube.com/watch?v=' + videoId;
  try { await youtube(); await refresh(); refreshTimer = setInterval(() => void refresh(), 3000); readoutTimer = setInterval(() => { $('readout').textContent = 'Video: ' + Number(yt?.getCurrentTime?.() || 0).toFixed(2) + 's · Audio: ' + audio.currentTime.toFixed(2) + 's · Adjustment: ' + Number(sync?.offset || 0).toFixed(2) + 's · ' + (sync?.verified ? 'operator confirmed' : 'not yet verified'); }, 500); }
  catch (error) { status.textContent = error.message; }
}
addEventListener('pagehide', () => { clearInterval(refreshTimer); clearInterval(readoutTimer); sync?.dispose(); hls?.destroy(); pauseBoth(); }, { once: true });
