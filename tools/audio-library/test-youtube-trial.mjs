import assert from 'node:assert/strict';
import { mkdir, readFile, copyFile, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, json } from './import.mjs';
import { candidates, validateMetadata, failureReason, trial, CHANNELS } from './youtube-trial.mjs';
const id = 'abcdefghijk', second = 'ABCDEFGHIJK';
const entry = { id, visibility: 'members' };
const info = { id, title: 'Final edited upload', channel_id: [...CHANNELS][0], live_status: 'not_live', duration: 2,
  formats: [{ vcodec: 'none', acodec: 'mp4a.40.2' }] };
assert.equal(candidates([entry], []).length, 1);
assert.equal(candidates([entry], [{ videoId: id }]).length, 0);
assert.throws(() => candidates([entry], [], { id: second }), /not in/);
assert.throws(() => candidates([entry], [], { limit: 4 }), /limited/);
assert.equal(validateMetadata(info, entry).visibility, 'members');
assert.equal(validateMetadata({ ...info, formats: undefined, vcodec: 'none', acodec: 'mp4a.40.2' }, entry).videoId, id);
assert.equal(validateMetadata(info, { ...entry, visibility: 'public' }).visibility, 'public');
for (const bad of [{ channel_id: 'another channel' }, { id: second }, { live_status: 'is_live' }, { live_status: 'post_live' }, { live_status: 'is_upcoming' }, { formats: [] }, { duration: 0 }]) {
  assert.throws(() => validateMetadata({ ...info, ...bad }, entry));
}
assert.match(failureReason('Sign in to confirm you are not a bot'), /No browser login/);
const parent = join(ROOT, 'tools/audio-library/work'), work = join(parent, 'youtube-test-' + Date.now());
await mkdir(work, { recursive: true });
try {
  const fixture = join(work, 'fixture.m4a');
  const ffmpeg = join(ROOT, 'tools/audio-pilot/runtime/ffmpeg.exe');
  const made = spawnSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:a', 'aac', '-b:a', '128k', fixture], { windowsHide: true });
  assert.equal(made.status, 0, String(made.stderr));
  let downloads = 0;
  const tool = { testMode: true, version: 'fixture', async call(args) {
    assert.ok(args.at(-1) === `https://www.youtube.com/watch?v=${id}`);
    if (args.includes('--skip-download')) return JSON.stringify({ ...info, url: 'https://signed.invalid?secret=never-save-me' });
    downloads++;
    assert.ok(args.includes('--extract-audio'));
    assert.match(args[args.indexOf('--format') + 1], /^bestaudio/);
    assert.match(args[args.indexOf('--match-filter') + 1], /!is_live/);
    await copyFile(fixture, args[args.indexOf('--output') + 1].replace('%(ext)s', 'm4a'));
    return '';
  } };
  const options = { work, tool, library: [entry], catalog: [], limit: 1 };
  let result = await trial(options);
  assert.equal(result[0].status, 'metadata verified'); assert.equal(downloads, 0);
  result = await trial({ ...options, download: true });
  assert.equal(result[0].status, 'local audio verified');
  assert.equal(result[0].visibility, 'members');
  assert.equal(downloads, 1); assert.ok(await stat(result[0].file));
  await trial({ ...options, download: true });
  assert.equal(downloads, 1, 'unchanged verified output is reused');
  const raw = await readFile(join(work, 'report.json'), 'utf8');
  assert.ok(!raw.includes('never-save-me'));
  const blocked = { ...tool, async call() { throw Error('Sign in to confirm you are not a bot https://secret.invalid'); } };
  result = await trial({ ...options, tool: blocked, download: true });
  assert.equal(result[0].status, 'needs retry');
  assert.ok(Date.parse(result[0].retryAfter) > Date.now());
  assert.ok(!(await readFile(join(work, 'report.json'), 'utf8')).includes('secret.invalid'));
  assert.equal((await json(join(work, id, 'verified.json'))).status, 'local audio verified');
  const processing = { ...tool, async call() { return JSON.stringify({ ...info, live_status: 'post_live' }); } };
  result = await trial({ ...options, tool: processing, download: true });
  assert.equal(result[0].status, 'waiting for replay');
  assert.equal(downloads, 1, 'processing replay must not be downloaded');
  console.log('PASS: bounded trial, existing-catalogue skip, channel/ID checks, no live downloads, private audience, real audio validation, repeat-run reuse, safe retry reporting, and no signed URL persistence.');
} finally {
  if (!resolve(work).startsWith(resolve(parent) + '\\') && !resolve(work).startsWith(resolve(parent) + '/')) throw Error('Unsafe cleanup');
  await rm(work, { recursive: true, force: true });
}
