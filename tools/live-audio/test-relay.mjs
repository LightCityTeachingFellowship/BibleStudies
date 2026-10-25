import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, stat, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ROOT, argumentsFor } from './pilot.mjs';
import { youtubeDestination, relayArguments, startRelay, LOCAL_VIDEO_TEST_OUTPUT } from './relay.mjs';

const wait = ms => new Promise(accept => setTimeout(accept, ms));
assert.throws(() => youtubeDestination('key|[f=flv]https://example.com'), /stream key/);
assert.throws(() => relayArguments({ destination: 'rtmp://example.com/live/key', localTest: true }), /Unsupported/);
assert.throws(() => argumentsFor({ input: 'tcp://0.0.0.0:19352', output: '.', localRelay: true }), /loopback/);
assert.ok(relayArguments({ destination: LOCAL_VIDEO_TEST_OUTPUT, localTest: true }).at(-1).includes('select=a:f=mpegts:onfail=ignore'));

const parent = resolve(ROOT, 'tools/live-audio/work'), work = join(parent, 'relay-test-' + Date.now());
await mkdir(work, { recursive: true });
const ffmpeg = join(ROOT, 'tools/audio-pilot/runtime/ffmpeg.exe'), ffprobe = join(ROOT, 'tools/audio-pilot/runtime/ffprobe.exe');
const children = [];
function run(args) {
  const child = spawn(ffmpeg, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let error = ''; child.stderr.on('data', chunk => { error = (error + chunk).slice(-3000); });
  children.push(child);
  const done = new Promise(accept => { child.on('error', () => accept({ code: -1, error })); child.on('close', code => accept({ code, error })); });
  return { child, done };
}
let relay;
try {
  const fixture = join(work, 'fixture.mp4');
  const generated = spawnSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=10', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '12', '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '20', '-c:a', 'aac', '-b:a', '160k', fixture], { windowsHide: true });
  assert.equal(generated.status, 0, String(generated.stderr));
  const probe = path => { const r = spawnSync(ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path], { windowsHide: true, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };

  async function scenario(name, stopAudioEarly) {
    const capture = join(work, name + '.flv');
    const sink = run(['-v', 'error', '-listen', '1', '-timeout', '30', '-i', LOCAL_VIDEO_TEST_OUTPUT, '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', capture]);
    relay = await startRelay({ destination: LOCAL_VIDEO_TEST_OUTPUT, localTest: true, output: join(work, name + '-audio') });
    let audioDiagnostic = ''; relay.audio.child.stderr.on('data', chunk => { audioDiagnostic = (audioDiagnostic + chunk).slice(-2500); });
    let relayDiagnostic = ''; relay.child.stderr.on('data', chunk => { relayDiagnostic = (relayDiagnostic + chunk).slice(-3500); });
    children.push(relay.child, relay.audio.child);
    await wait(1000);
    const sender = run(['-v', 'error', '-re', '-i', fixture, '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', '-f', 'flv', 'rtmp://127.0.0.1:19350/live/audio-test']);
    if (stopAudioEarly) { await wait(5000); relay.audio.child.kill(); }
    const sent = await sender.done;
    assert.equal(sent.code, 0, sent.error);
    const result = await relay.completed;
    const received = await sink.done;
    assert.ok((await stat(capture)).size > 1000, received.error);
    const info = probe(capture);
    assert.equal(info.streams.find(s => s.codec_type === 'video').codec_name, 'h264');
    assert.equal(info.streams.find(s => s.codec_type === 'audio').codec_name, 'aac');
    assert.ok(Number(info.format.duration) >= 11.5, 'video forwarding must receive the entire input, including after audio fails');
    // Compare encoded video packets: the relay must not re-encode the video.
    const packets = path => spawnSync(ffmpeg, ['-v', 'error', '-i', path, '-map', '0:v:0', '-c:v', 'copy', '-bsf:v', 'h264_mp4toannexb', '-f', 'hash', '-hash', 'sha256', '-'], { windowsHide: true, encoding: 'utf8' }).stdout.trim();
    assert.ok(packets(fixture).startsWith('SHA256='));
    assert.equal(packets(capture), packets(fixture));
    if (!stopAudioEarly) {
      if (!result.audioReport) console.log('Synthetic local test audio diagnostic:', audioDiagnostic, 'Synthetic local relay diagnostic:', relayDiagnostic);
      assert.ok(result.audioReport?.ended, 'audio playlist must close cleanly');
      assert.ok(result.audioReport.durationSeconds >= 11, 'audio must cover the input timeline');
      const audio = probe(join(work, name + '-audio', 'audio.m3u8'));
      assert.ok(audio.streams.every(s => s.codec_type === 'audio'));
      assert.equal(audio.streams[0].codec_name, 'aac');
      console.log('PASS: one real-time RTMP input forwards unchanged H.264/AAC video and produces a completed AAC HLS audio session.');
    } else console.log('PASS: killing the audio packager does not interrupt the forwarded video stream.');
    relay = null;
    await wait(500);
  }
  await scenario('simultaneous', false);
  await scenario('audio-failure', true);
} finally {
  for (const child of children) if (child.exitCode === null) child.kill();
  if (relay) await relay.completed.catch(() => {});
  await wait(200);
  const target = resolve(work); if (!target.startsWith(parent + '\\') && !target.startsWith(parent + '/')) throw Error('Unsafe test cleanup path');
  await rm(target, { recursive: true, force: true });
}
