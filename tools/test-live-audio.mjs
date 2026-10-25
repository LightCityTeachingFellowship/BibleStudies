import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, stat, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ROOT, argumentsFor, inspectManifest, startPilot } from './live-audio/pilot.mjs';

assert.throws(() => argumentsFor({ input: 'rtmp://0.0.0.0:19350/live/audio-test', output: '.', receive: true }), /loopback/);
assert.throws(() => inspectManifest('#EXTM3U\n#EXTINF:4,\n../private.ts\n'), /segment path/);
assert.throws(() => inspectManifest('#EXTM3U\n#EXTINF:4,\nsegment-000000.ts\n'), /clock timestamps/);
const parent = resolve(ROOT, 'tools/live-audio/work');
const work = join(parent, 'test-' + Date.now());
await mkdir(work, { recursive: true });
let running;
try {
  const source = join(work, 'fixture.m4a');
  const ffmpeg = join(ROOT, 'tools/audio-pilot/runtime/ffmpeg.exe');
  const generated = spawnSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=10', '-c:a', 'aac', '-b:a', '128k', source], { windowsHide: true });
  assert.equal(generated.status, 0, String(generated.stderr));
  const output = join(work, 'session');
  running = await startPilot({ input: source, output });
  let done = false;
  running.completed.finally(() => { done = true; }).catch(() => {});
  let growing = false;
  while (!done) {
    try {
      const text = await readFile(join(output, 'audio.m3u8'), 'utf8');
      const info = inspectManifest(text);
      if (info.segments.length && !info.ended) {
        for (const segment of info.segments) assert.ok((await stat(join(output, segment))).size > 0);
        growing = true;
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await new Promise(accept => setTimeout(accept, 300));
  }
  const report = await running.completed;
  assert.ok(growing, 'a complete audio segment must be available before the stream ends');
  assert.ok(report.ended);
  assert.ok(report.segments.length >= 3);
  assert.ok(Math.abs(report.durationSeconds - 10) < 0.2);
  for (let i = 1; i < report.timestamps.length; i++) assert.ok(Math.abs(report.timestamps[i] - report.timestamps[i - 1] - report.durations[i - 1] * 1000) < 10);
  const decoded = spawnSync(ffmpeg, ['-v', 'error', '-i', join(output, 'audio.m3u8'), '-map', '0:a:0', '-f', 'null', '-'], { windowsHide: true });
  assert.equal(decoded.status, 0, String(decoded.stderr));
  console.log('PASS: real-time growing HLS, completed audio segments, continuous clock timestamps, final playlist, playable audio, and loopback-only receiver arguments.');
} finally {
  if (running && running.child.exitCode === null) { running.child.kill(); await running.completed.catch(() => {}); }
  const target = resolve(work);
  if (!target.startsWith(parent + '\\') && !target.startsWith(parent + '/')) throw Error('Unsafe test cleanup path');
  await rm(target, { recursive: true, force: true });
}
