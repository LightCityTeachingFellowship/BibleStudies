import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, matchRecording, validateAudio, mergeCatalog, remoteMatches, ensureRemote, digest, prepare, confirm, json, plan } from './audio-library/import.mjs';

const publicId = 'R42uVd9spDw', memberId = '0xma1jqVwsg';
const library = [{ id: publicId, title: 'Mark 10-11 Reading and Commentary.', visibility: 'public' }, { id: memberId, title: 'Day 26 || Prayer Meeting', visibility: 'members' }];
assert.equal(matchRecording(publicId + '.mp4', library).id, publicId);
assert.equal(matchRecording('Anything [' + memberId + '].mp4', library).id, memberId);
assert.equal(matchRecording('Mark 10-11 Reading and Commentary.mp4', library).id, publicId);
assert.equal(matchRecording('renamed.mp4', library, { url: 'https://youtube.com/watch?v=' + memberId }).id, memberId);
assert.equal(matchRecording('renamed.mp4', library, {}, publicId).method, 'reviewed mapping');
assert.ok(matchRecording(publicId + '.mp4', library, { videoId: memberId }).reason);
assert.ok(matchRecording('Mark 10-11 Reading and Commentary.mp4', library, { videoId: 'abcdefghijk' }).reason);
assert.ok(matchRecording('Mark 10-11 Reading and Commentary.mp4', [...library, { id: 'abcdefghijk', title: 'Mark 10 11 Reading and Commentary' }]).reason);
assert.ok(matchRecording('unknown.mp4', library).reason);
assert.throws(() => validateAudio({ format: { duration: '2' }, streams: [{ codec_type: 'video' }] }, 2));
assert.throws(() => validateAudio({ format: { duration: '8' }, streams: [{ codec_type: 'audio', codec_name: 'aac' }] }, 2));
const receipt = { videoId: publicId, sha256: 'hash', bytes: 42, durationSeconds: 2, timelineConfirmed: true, uploaded: { sha256: 'hash', bytes: 42 } };
assert.equal(mergeCatalog([], { a: receipt }, library).length, 1);
assert.equal(mergeCatalog([], { a: { ...receipt, timelineConfirmed: false } }, library).length, 0);
assert.equal(mergeCatalog([], { a: { ...receipt, uploaded: { sha256: 'wrong', bytes: 42 } } }, library).length, 0);
assert.equal(mergeCatalog([], { a: { ...receipt, uploaded: null } }, library).length, 0);
assert.equal(mergeCatalog([{ videoId: publicId, visibility: 'public' }], {}, [{ ...library[0], visibility: 'members' }])[0].visibility, 'members');
assert.equal(mergeCatalog([{ videoId: 'abcdefghijk', visibility: 'public' }], {}, library).length, 0);
assert.ok(remoteMatches({ ContentLength: 42, Metadata: { sha256: 'hash' } }, receipt));
assert.ok(!remoteMatches({ ContentLength: 43, Metadata: { sha256: 'hash' } }, receipt));

const parent = resolve(ROOT, 'tools/audio-library/work');
const work = join(parent, 'test-' + Date.now());
await mkdir(work, { recursive: true });
try {
  const source = join(work, 'input.wav');
  const ffmpeg = join(ROOT, 'tools/audio-pilot/runtime/ffmpeg.exe');
  const generated = spawnSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', source], { windowsHide: true });
  assert.equal(generated.status, 0, String(generated.stderr));
  await writeFile(join(work, 'plan.json'), JSON.stringify({ records: [{ id: publicId, source, status: 'ready' }] }));
  const state = await prepare(work, { limit: 1 });
  const r = state[publicId];
  assert.equal(r.method, 'AAC 128 kbps conversion');
  assert.ok(Math.abs(r.durationSeconds - 2) < 0.1);
  assert.equal(r.timelineConfirmed, false);
  const before = (await stat(r.output)).mtimeMs;
  await prepare(work, { limit: 1 });
  assert.equal((await stat(r.output)).mtimeMs, before, 'resume should not reconvert');
  await confirm(work, publicId);
  assert.equal((await json(join(work, 'state.json')))[publicId].timelineConfirmed, true);

  // Reimport AAC into a separate batch: encoded packets must be identical.
  const copyWork = join(work, 'copy');
  await mkdir(copyWork);
  await mkdir(join(copyWork, 'audio'));
  await writeFile(join(copyWork, 'audio', memberId + '.m4a.working.m4a'), 'interrupted partial conversion');
  await writeFile(join(copyWork, 'plan.json'), JSON.stringify({ records: [{ id: memberId, source: r.output, status: 'ready' }] }));
  const copy = (await prepare(copyWork, { limit: 1 }))[memberId];
  assert.match(copy.method, /stream copy/);
  const packets = file => spawnSync(ffmpeg, ['-v', 'error', '-i', file, '-map', '0:a:0', '-c:a', 'copy', '-f', 'hash', '-hash', 'sha256', '-'], { windowsHide: true, encoding: 'utf8' }).stdout.trim();
  assert.ok(packets(r.output).startsWith('SHA256='));
  assert.equal(packets(copy.output), packets(r.output), 'AAC packets must be preserved');

  class HeadObjectCommand { constructor(input) { this.input = input; } }
  class PutObjectCommand { constructor(input) { this.input = input; } }
  const sdk = { HeadObjectCommand, PutObjectCommand };
  let remote = null, puts = 0;
  const s3 = { async send(cmd) {
    if (cmd instanceof HeadObjectCommand) { if (remote) return remote; const e = Error('missing'); e.$metadata = { httpStatusCode: 404 }; throw e; }
    puts++;
    assert.equal(cmd.input.IfNoneMatch, '*');
    assert.equal(cmd.input.ContentType, 'audio/mp4');
    const chunks = []; for await (const chunk of cmd.input.Body) chunks.push(chunk);
    assert.deepEqual(Buffer.concat(chunks), await readFile(r.output));
    assert.equal(cmd.input.ContentMD5, await digest(r.output, 'md5', 'base64'));
    remote = { ContentLength: r.bytes, Metadata: { sha256: r.sha256 } };
  } };
  assert.equal(await ensureRemote(r, { sdk, s3 }, false), false, 'limit must not upload');
  assert.equal(await ensureRemote(r, { sdk, s3 }), 'uploaded');
  assert.equal(await ensureRemote(r, { sdk, s3 }), 'existing');
  assert.equal(puts, 1, 'retry must skip matching remote object');
  remote = null;
  let failVerification = true;
  const interrupted = { async send(cmd) {
    if (cmd instanceof HeadObjectCommand && remote && failVerification) { failVerification = false; throw Error('network interrupted after upload'); }
    return s3.send(cmd);
  } };
  await assert.rejects(ensureRemote(r, { sdk, s3: interrupted }), /network interrupted/);
  assert.equal(puts, 2);
  assert.equal(await ensureRemote(r, { sdk, s3: interrupted }), 'existing');
  assert.equal(puts, 2, 'missing receipt after interruption must not duplicate the upload');
  remote.Metadata.sha256 = 'different';
  await assert.rejects(ensureRemote(r, { sdk, s3 }), /refusing to overwrite/);
  assert.equal(puts, 2);
  const denied = { async send() { const e = Error('denied'); e.$metadata = { httpStatusCode: 403 }; throw e; } };
  await assert.rejects(ensureRemote(r, { sdk, s3: denied }), /denied/);

  // Planning actual website IDs must skip the six already-registered pilot files.
  const input = join(work, 'export'); await mkdir(input);
  await writeFile(join(input, publicId + '.mp4'), 'placeholder; scanning never decodes');
  await writeFile(join(input, 'unknown-video.mp4'), 'placeholder');
  const planned = await plan(input, join(work, 'scan'));
  assert.equal(planned.find(r => r.id === publicId).status, 'already registered');
  assert.equal(planned.find(r => r.source.endsWith('unknown-video.mp4')).status, 'review');
  console.log('PASS: matching, privacy reconciliation, duration checks, real conversion, AAC packet preservation, resume, upload integrity, remote conflict rejection, and pilot skipping.');
} finally {
  const target = resolve(work);
  if (!target.startsWith(parent + '\\') && !target.startsWith(parent + '/')) throw Error('Unsafe test cleanup path');
  await rm(target, { recursive: true, force: true });
}
