export function chooseTransport({ hlsSupported, nativeSupport }) {
  // Chromium can advertise native HLS while exposing no seekable timeline.
  return hlsSupported ? 'hls' : nativeSupport ? 'native' : null;
}
function intervals(ranges) {
  const result = [];
  for (let i = 0; i < (ranges?.length || 0); i++) {
    const start = ranges.start(i), end = ranges.end(i);
    if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start) result.push([start, end]);
  }
  return result;
}
export function availableAudioRanges(media, details = null) {
  if (media.readyState < 1) return [];
  const seekable = intervals(media.seekable);
  if (seekable.length) return seekable;
  // A retained hls.js EVENT playlist describes fetchable history before the
  // media element exposes seekable. Never infer an infinite available range.
  const start = details?.fragments?.[0]?.start, end = details?.edge;
  if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start) return [[start, end]];
  return intervals(media.buffered);
}
export function audioTimeFor(videoTime, offset) {
  if (!Number.isFinite(videoTime) || !Number.isFinite(offset)) throw Error('Invalid playback time');
  return videoTime + offset;
}
export function videoTimeFor(audioTime, offset) { return audioTimeFor(audioTime, -offset); }
export function settledPosition(read, target, { tolerance = 0.75, holdMs = 700, now = () => performance.now() } = {}) {
  let since = null;
  return () => {
    const sample = read();
    if (!sample.ready || Math.abs(sample.time - target) > tolerance) { since = null; return false; }
    if (since === null) since = now();
    return now() - since >= holdMs;
  };
}
export async function seekYouTubePosition(player, time, { videoId, waitUntil, signal, now }) {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const settled = () => settledPosition(() => ({ time: player.getCurrentTime(), ready: player.getPlayerState() === 2 }), time, { now });
  player.pauseVideo();
  await waitUntil(() => player.getPlayerState() === 2, signal, 8000);
  player.seekTo(time, true);
  try { await waitUntil(settled(), signal, 3000); }
  catch (error) {
    if (signal?.aborted) throw error;
    player.loadVideoById({ videoId, startSeconds: time });
    await waitUntil(() => player.getPlayerState() === 1 && Math.abs(player.getCurrentTime() - time) < 3, signal, 12000);
    player.pauseVideo();
    await waitUntil(() => player.getPlayerState() === 2, signal, 8000);
    // Seek again after the requested media is decoded, then verify while paused.
    player.seekTo(time, true);
    await waitUntil(settled(), signal, 8000);
  }
}
export async function refreshYouTubeTimeline(player, time, { waitUntil, signal, blocked = () => false }) {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (Number(player.getDuration()) >= time + 0.5) return;
  const muted = player.isMuted();
  player.mute(); player.playVideo();
  try {
    await waitUntil(() => {
      if (blocked()) throw Error('Press Play on the video, then try switching again.');
      return Number(player.getDuration()) >= time + 0.5;
    }, signal, 12000);
  } finally {
    player.pauseVideo();
    if (!muted) player.unMute();
  }
}
// YouTube commands are asynchronous and playVideo() returns no playback promise.
// Wait for acknowledgement, including a late pause from the preceding DVR seek.
export async function resumeYouTube(player, { waitUntil, signal, blocked = () => false, now = () => performance.now() }) {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const started = now();
  let retried = false;
  player.playVideo();
  await waitUntil(() => {
    if (blocked()) throw new DOMException('Press Play', 'NotAllowedError');
    const state = player.getPlayerState();
    if (state === 1) return true;
    if (state === 2 && !retried && now() - started >= 300) {
      retried = true;
      player.playVideo();
    }
    return false;
  }, signal, 8000);
}
export function inRanges(time, ranges) {
  return Number.isFinite(time) && time >= 0 && ranges.some(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && time >= start && time <= end);
}
export function createLiveSwitch(adapter, identity) {
  if (!/^session-\d{13}$/.test(identity.session) || !/^[\w-]{11}$/.test(identity.videoId)) throw Error('Choose a test session and video');
  let mode = 'video', offset = 0, verified = false, disposed = false, revision = 0, controller = null, pending = null;
  const checkedDirections = new Set();
  const identityKey = identity.session + ':' + identity.videoId;
  async function switchTo(next) {
    if (disposed || !['audio', 'video'].includes(next)) return;
    const ticket = ++revision;
    controller?.abort(); controller = new AbortController();
    const signal = controller.signal, stale = () => disposed || ticket !== revision;
    const outgoing = mode;
    try {
      const snapshot = pending || (outgoing === 'video' ? await adapter.readVideo(signal) : adapter.readAudio());
      if (stale()) return;
      const canonical = pending ? snapshot.time : outgoing === 'video' ? snapshot.time : videoTimeFor(snapshot.time, offset);
      if (!Number.isFinite(canonical) || canonical < 0) throw Error('Wait for playback to start before switching.');
      pending = { time: canonical, playing: snapshot.playing === true, rate: snapshot.rate || 1 };
      const carried = pending;
      adapter.pauseBoth();
      adapter.status('Preparing ' + (next === 'audio' ? 'audio' : 'video') + ' at the same point…');
      await adapter.ready(next, signal);
      if (stale()) return;
      const target = next === 'audio' ? audioTimeFor(canonical, offset) : canonical;
      const targetRanges = adapter.ranges(next);
      // YouTube does not publish exact DVR ranges through the iframe API.
      // An unknown video range requires adapter.seek to verify the actual result.
      if (!(next === 'video' && targetRanges === null) && !inRanges(target, targetRanges)) throw Error(next === 'audio' ? 'That moment is not available in the audio stream yet. Try Listen again shortly.' : 'That moment is outside the available YouTube DVR range.');
      await adapter.seek(next, target, carried.rate, signal);
      if (stale()) return;
      mode = next; adapter.show(mode);
      if (carried.playing) {
        try { await adapter.play(mode, signal); }
        catch (error) { if (!stale() && error.name === 'NotAllowedError') { pending = null; adapter.status('Press Play to continue from the same point.'); return; } throw error; }
      }
      if (adapter.verify && !stale()) await adapter.verify(next, target, carried.playing, carried.rate, signal);
      if (!stale() && outgoing !== next) checkedDirections.add(outgoing + ':' + next);
      if (!stale()) pending = null;
      if (!stale()) adapter.status(carried.playing ? (verified ? 'Playing with the timing you confirmed for this test.' : 'Playing with provisional timing. Check that the same words continue across the switch.') : 'Paused at the corresponding point. Press Play to continue.');
    } catch (error) {
      if (stale() || signal.aborted) return;
      const carried = pending; pending = null;
      adapter.pauseBoth(); mode = outgoing; adapter.show(mode);
      if (carried?.playing) { try { await adapter.play(mode, signal); } catch {} }
      adapter.status(error.message || 'Switching could not be completed. Try again.');
    }
  }
  return {
    get mode() { return mode; },
    get offset() { return offset; },
    get verified() { return verified; },
    switchTo,
    setOffset(value) {
      if (!Number.isFinite(value) || Math.abs(value) > 600) throw Error('Timing adjustment must be within ten minutes.');
      if (disposed) return;
      ++revision; controller?.abort(); pending = null; adapter.pauseBoth();
      offset = value; verified = false; checkedDirections.clear();
      adapter.status('Timing adjustment changed. Test Watch and Listen again.');
    },
    confirm() { if (!disposed) { if (!checkedDirections.has('video:audio') || !checkedDirections.has('audio:video')) throw Error('Test Watch → Listen and Listen → Watch before confirming the timing.'); verified = true; return { ...identity, identityKey, offsetSeconds: offset, confirmedAt: new Date().toISOString() }; } },
    invalidate(reason) { if (!disposed) { verified = false; checkedDirections.clear(); ++revision; controller?.abort(); pending = null; adapter.pauseBoth(); adapter.status(reason || 'Timing changed. Check synchronization again.'); } },
    dispose() { if (disposed) return; disposed = true; ++revision; controller?.abort(); pending = null; adapter.pauseBoth(); }
  };
}
