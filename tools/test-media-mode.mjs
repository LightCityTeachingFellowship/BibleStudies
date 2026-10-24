import assert from 'node:assert/strict';
import { createModeSwitch } from '../script/media-mode-core.mjs';
const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function setup() {
  const calls = [], state = { videoTime: 125.75, audioTime: 0, videoPlaying: true, audioPlaying: false, rate: 1.25, holdAudio: null, holdVideo: null };
  const controller = createModeSwitch({
    readVideo: async () => ({ time: state.videoTime, playing: state.videoPlaying, rate: state.rate }),
    readAudio: () => ({ time: state.audioTime, playing: state.audioPlaying, rate: state.rate }),
    pauseVideo: () => { calls.push('pauseVideo'); state.videoPlaying = false; },
    pauseAudio: () => { calls.push('pauseAudio'); state.audioPlaying = false; },
    show: mode => calls.push('show:' + mode), onState: (mode, text) => calls.push('status:' + mode + ':' + text),
    loadAudio: async () => { if (state.holdAudio) await state.holdAudio; },
    seekAudio: (time, rate) => { calls.push('seekAudio'); state.audioTime = time; state.rate = rate; },
    playAudio: async () => { calls.push('playAudio'); state.audioPlaying = true; },
    loadVideo: async () => { if (state.holdVideo) await state.holdVideo; },
    seekVideo: (time, rate) => { calls.push('seekVideo'); state.videoTime = time; state.rate = rate; },
    playVideo: async () => { calls.push('playVideo'); state.videoPlaying = true; },
    dispose: () => calls.push('dispose')
  });
  return { controller, calls, state };
}
let app = setup();
await app.controller.switchTo('audio');
assert.equal(app.state.audioTime, 125.75); assert.equal(app.state.audioPlaying, true); assert.equal(app.state.videoPlaying, false);
assert.ok(app.calls.indexOf('pauseVideo') < app.calls.indexOf('playAudio'));
app.state.audioTime = 237.5;
await app.controller.switchTo('video');
assert.equal(app.state.videoTime, 237.5); assert.equal(app.state.videoPlaying, true); assert.equal(app.state.audioPlaying, false); assert.equal(app.state.rate, 1.25);
app.state.videoPlaying = false; app.state.videoTime = 444.33;
await app.controller.switchTo('audio');
assert.equal(app.state.audioTime, 444.33); assert.equal(app.state.audioPlaying, false, 'Switching a paused video preserves pause');
await app.controller.switchTo('video'); assert.equal(app.state.videoPlaying, false);

app = setup(); let release;
app.state.holdAudio = new Promise(resolve => { release = resolve; });
const oldAudio = app.controller.switchTo('audio'); await tick();
await app.controller.switchTo('video');
release(); await oldAudio;
assert.equal(app.controller.mode, 'video'); assert.equal(app.state.videoTime, 125.75); assert.equal(app.state.audioPlaying, false);
assert.equal(app.calls.includes('playAudio'), false, 'Late audio link/metadata cannot play after switching back');

app = setup(); await app.controller.switchTo('audio'); app.state.audioTime = 300.125;
app.state.holdVideo = new Promise(resolve => { release = resolve; });
const oldVideo = app.controller.switchTo('video'); await tick();
await app.controller.switchTo('audio'); release(); await oldVideo;
assert.equal(app.state.audioTime, 300.125); assert.equal(app.state.audioPlaying, true); assert.equal(app.state.videoPlaying, false);

app = setup(); app.state.holdAudio = new Promise(resolve => { release = resolve; });
const pending = app.controller.switchTo('audio'); await tick(); app.controller.dispose(); release(); await pending;
assert.equal(app.state.audioPlaying, false); assert.equal(app.calls.includes('seekAudio'), false);
console.log('PASS: exact timeline transfer in both directions, pause/rate preservation, mutually exclusive playback, rapid-switch races and disposal during loading.');
