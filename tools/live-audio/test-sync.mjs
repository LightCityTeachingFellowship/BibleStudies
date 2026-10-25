import assert from 'node:assert/strict';
import { audioTimeFor, videoTimeFor, inRanges, createLiveSwitch } from './live-sync.mjs';
const identity = { session: 'session-1792874042803', videoId: 'BaqEiXEDE5A' };
assert.equal(audioTimeFor(101.25, -7.5), 93.75);
assert.equal(videoTimeFor(93.75, -7.5), 101.25);
assert.ok(inRanges(10, [[0, 12]])); assert.ok(!inRanges(13, [[0, 12]]));
assert.ok(!inRanges(5, [[0, 4], [6, 12]])); assert.ok(!inRanges(-1, [[-2, 12]]));
assert.throws(() => audioTimeFor(Infinity, 0));
function fixture() {
  const state = { video: { time: 120.75, playing: true, rate: 1.25 }, audio: { time: 0, playing: false, rate: 1 }, mode: 'video', messages: [], events: [], audioRanges: [[0, 1000]], videoRanges: [[0, 1000]], readyGate: null, playError: null, seekError: null };
  const adapter = {
    readVideo: async () => ({ ...state.video }), readAudio: () => ({ ...state.audio }),
    pauseBoth() { state.events.push('pauseBoth'); state.audio.playing = state.video.playing = false; },
    status(text) { state.messages.push(text); }, show(mode) { state.mode = mode; state.events.push('show:' + mode); },
    async ready(mode, signal) { state.events.push('ready:' + mode); if (state.readyGate) await state.readyGate(mode, signal); },
    ranges(mode) { return state[mode + 'Ranges']; },
    async seek(mode, time, rate, signal) { if (state.seekError) throw state.seekError; if (signal.aborted) throw new DOMException('Cancelled', 'AbortError'); state.events.push('seek:' + mode); state[mode].time = time; state[mode].rate = rate; },
    async play(mode) { if (state.playError) throw state.playError; state.events.push('play:' + mode); state[mode].playing = true; }
  };
  return { state, adapter, sync: createLiveSwitch(adapter, identity) };
}
{
  const { state, sync } = fixture(); sync.setOffset(-9.25); state.video.playing = true;
  await sync.switchTo('audio'); assert.equal(state.audio.time, 111.5); assert.equal(state.audio.rate, 1.25); assert.ok(state.audio.playing); assert.ok(!state.video.playing);
  state.audio.time = 205.5; await sync.switchTo('video'); assert.equal(state.video.time, 214.75); assert.ok(state.video.playing); assert.ok(!state.audio.playing);
  const report = sync.confirm(); assert.equal(report.videoId, identity.videoId); assert.equal(report.offsetSeconds, -9.25); assert.ok(sync.verified);
  sync.setOffset(3); assert.ok(!sync.verified); assert.throws(() => sync.confirm(), /Test Watch/);
  assert.throws(() => sync.setOffset(57601)); assert.throws(() => sync.setOffset(NaN));
}
{
  const { state, sync } = fixture(); state.video.playing = false; await sync.switchTo('audio'); assert.equal(state.audio.time, 120.75); assert.ok(!state.audio.playing);
  state.audio.time = 333.33; await sync.switchTo('video'); assert.equal(state.video.time, 333.33); assert.ok(!state.video.playing);
}
{
  const { state, sync } = fixture(); state.audioRanges = [[0, 50]];
  await sync.switchTo('audio'); assert.equal(sync.mode, 'video'); assert.equal(state.mode, 'video'); assert.ok(state.video.playing); assert.ok(!state.audio.playing); assert.match(state.messages.at(-1), /not available/);
  assert.ok(!state.events.includes('seek:audio'), 'must not clamp or jump to the audio live edge');
}
{
  const { state, sync } = fixture(); await sync.switchTo('audio'); state.audio.time = 150; state.videoRanges = [[200, 1000]];
  await sync.switchTo('video'); assert.equal(sync.mode, 'audio'); assert.ok(state.audio.playing); assert.match(state.messages.at(-1), /DVR range/);
}
{
  const { state, sync } = fixture(); state.seekError = Error('Seek refused'); await sync.switchTo('audio'); assert.equal(sync.mode, 'video'); assert.ok(state.video.playing); assert.match(state.messages.at(-1), /Seek refused/);
}
{
  const { state, sync } = fixture(); await sync.switchTo('audio');
  state.audio.time = 174.33; state.videoRanges = null;
  await sync.switchTo('video');
  assert.equal(sync.mode, 'video'); assert.equal(state.video.time, 174.33);
  assert.ok(state.video.playing && !state.audio.playing, 'unknown DVR range must be verified by seeking, not rejected from a stale duration');
}
{
  const { state, sync } = fixture(); await sync.switchTo('audio');
  state.videoRanges = null; state.seekError = Error('Video could not reach this moment yet');
  await sync.switchTo('video');
  assert.equal(sync.mode, 'audio'); assert.ok(state.audio.playing && !state.video.playing);
  assert.match(state.messages.at(-1), /could not reach/, 'failed actual seek restores audio without jumping to the video edge');
}
{
  const { state, sync } = fixture(); state.playError = new DOMException('Press Play', 'NotAllowedError'); await sync.switchTo('audio'); assert.equal(sync.mode, 'audio'); assert.ok(!state.audio.playing); assert.match(state.messages.at(-1), /Press Play/);
}
{
  const { state, sync } = fixture();
  let release; const gate = new Promise(accept => { release = accept; }); state.readyGate = async mode => { if (mode === 'audio') await gate; };
  const first = sync.switchTo('audio'); await new Promise(accept => setTimeout(accept, 0));
  const latest = sync.switchTo('video'); await latest; release(); await first;
  assert.equal(sync.mode, 'video'); assert.ok(state.video.playing); assert.equal(state.video.time, 120.75); assert.ok(!state.audio.playing);
}
{
  const { state, sync } = fixture(); let release; const gate = new Promise(accept => { release = accept; }); state.readyGate = () => gate;
  const pending = sync.switchTo('audio'); await new Promise(accept => setTimeout(accept, 0)); sync.dispose(); release(); await pending;
  assert.ok(!state.audio.playing && !state.video.playing); assert.ok(!state.events.includes('seek:audio'));
}
{
  const { state, sync } = fixture(); await sync.switchTo('audio'); await sync.switchTo('video'); sync.confirm(); sync.invalidate('Source restarted');
  assert.ok(!sync.verified); assert.ok(!state.video.playing); assert.throws(() => sync.confirm(), /Test Watch/);
  const fresh = createLiveSwitch(fixture().adapter, { ...identity, session: 'session-1792874042804' }); assert.equal(fresh.offset, 0); assert.ok(!fresh.verified);
}
{
  const { state, sync } = fixture();
  sync.setOffset(2.5); state.video.playing = true;
  for (let cycle = 0; cycle < 3; cycle++) {
    state.video.time += 11;
    const fromVideo = state.video.time;
    await sync.switchTo('audio'); assert.equal(state.audio.time, fromVideo + 2.5);
    state.audio.time += 17;
    await sync.switchTo('video'); assert.equal(state.video.time, fromVideo + 17);
    assert.ok(state.video.playing && !state.audio.playing);
  }
}
{
  const { state, adapter, sync } = fixture(); await sync.switchTo('audio');
  state.audio.time = 200;
  adapter.verify = async mode => { if (mode === 'video') { state.video.time = 120.75; throw Error('Position reverted after Play'); } };
  await sync.switchTo('video');
  assert.equal(sync.mode, 'audio'); assert.ok(state.audio.playing && !state.video.playing);
  assert.match(state.messages.at(-1), /reverted/); assert.throws(() => sync.confirm(), /Test Watch/);
}
console.log('PASS: repeated handoff positions, post-play reversion rollback, live offset mapping, pause/rate preservation, unavailable positions, cancellation, and session-bound verification.');
