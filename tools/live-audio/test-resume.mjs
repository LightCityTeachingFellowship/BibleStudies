import assert from 'node:assert/strict';
import { resumeYouTube, refreshYouTubeTimeline, seekYouTubePosition, settledPosition } from './live-sync.mjs';

// Model delayed iframe acknowledgements rather than a synchronous play method.
async function scenario({ latePause = false, blocked = false, cancel = false } = {}) {
  let time = 0, calls = 0, state = 2, ticks = 0;
  const controller = new AbortController();
  const player = {
    playVideo() { calls++; },
    getPlayerState() { return state; }
  };
  const waitUntil = async (check, signal) => {
    for (let i = 0; i < 30; i++) {
      time += 100; ticks++;
      if (cancel && i === 1) controller.abort();
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (!blocked && ((!latePause && i >= 2) || (latePause && calls === 2))) state = 1;
      if (check()) return;
    }
    throw Error('Playback did not start');
  };
  await resumeYouTube(player, { waitUntil, signal: controller.signal, blocked: () => blocked, now: () => time });
  return { calls, ticks, state };
}
assert.deepEqual(await scenario(), { calls: 1, ticks: 3, state: 1 });
assert.deepEqual(await scenario({ latePause: true }), { calls: 2, ticks: 4, state: 1 });
await assert.rejects(scenario({ blocked: true }), { name: 'NotAllowedError' });
await assert.rejects(scenario({ cancel: true, latePause: true }), { name: 'AbortError' });
for (const originallyMuted of [false, true]) {
  let duration = 57, muted = originallyMuted, playing = false, wakes = 0;
  const player = { getDuration: () => duration, isMuted: () => muted, mute: () => { muted = true; }, unMute: () => { muted = false; }, playVideo: () => { playing = true; wakes++; }, pauseVideo: () => { playing = false; } };
  await refreshYouTubeTimeline(player, 74, { waitUntil: async check => {
    assert.ok(playing && muted, 'timeline refresh must be silent');
    assert.equal(check(), false); duration = 100; assert.equal(check(), true);
  } });
  assert.equal(wakes, 1); assert.equal(playing, false); assert.equal(muted, originallyMuted);
  await refreshYouTubeTimeline(player, 74, { waitUntil: () => { throw Error('No wake needed'); } });
  assert.equal(wakes, 1, 'an up-to-date timeline needs no warmup');
  duration = 57;
  await assert.rejects(refreshYouTubeTimeline(player, 74, { waitUntil: async () => { throw Error('Unavailable'); } }), /Unavailable/);
  assert.equal(playing, false); assert.equal(muted, originallyMuted, 'failed refresh restores mute state');
}
console.log('PASS: asynchronous YouTube playback acknowledgement, bounded late-pause retry, autoplay rejection, and cancellation.');
{
  let clock = 0, position = 57, state = 1, loads = 0, decoded = false, transient = 0;
  const player = {
    getCurrentTime: () => position, getPlayerState: () => state,
    pauseVideo: () => { state = 2; },
    seekTo: target => { assert.equal(target, 74); position = 74; if (!decoded) transient = 2; },
    loadVideoById: options => { assert.deepEqual(options, { videoId: 'k6Spw8uaHMI', startSeconds: 74 }); loads++; decoded = true; position = 74; state = 1; }
  };
  const waitUntil = async (check, signal, timeout) => {
    for (let elapsed = 0; elapsed < timeout; elapsed += 100) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      clock += 100;
      if (transient > 0 && --transient === 0) position = 57;
      if (check()) return;
    }
    throw Error('Position did not settle');
  };
  const options = { videoId: 'k6Spw8uaHMI', waitUntil, now: () => clock };
  await seekYouTubePosition(player, 74, options);
  assert.equal(loads, 1, 'optimistic seek response that reverts must trigger a fresh load');
  assert.equal(position, 74); assert.equal(state, 2);
  await seekYouTubePosition(player, 74, options);
  assert.equal(loads, 1, 'settled normal seeks need no reload');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(seekYouTubePosition(player, 74, { ...options, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(loads, 1);
}
{
  let clock = 0, time = 74, ready = true;
  const check = settledPosition(() => ({ time, ready }), 74, { now: () => clock });
  assert.equal(check(), false); clock = 300; time = 57; assert.equal(check(), false);
  clock = 1000; time = 74; assert.equal(check(), false, 'transient acceptance must not count');
  clock = 1800; ready = false; assert.equal(check(), false);
  clock = 2000; ready = true; assert.equal(check(), false);
  clock = 2800; assert.equal(check(), true);
}
