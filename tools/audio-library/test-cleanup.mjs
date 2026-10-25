import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ROOT, digest, json, save } from './import.mjs';
import { cleanup, markPlaybackVerified } from './cleanup.mjs';

const parent = join(ROOT, 'tools/audio-library/work');
const work = join(parent, 'cleanup-test-' + Date.now());
const id = 'abcdefghijk';
await mkdir(join(work, 'audio'), { recursive: true });
await mkdir(join(work, 'input'));
const output = join(work, 'audio', id + '.m4a'), source = join(work, 'input', id + '.mp4');
const catalogPath = join(work, 'catalog.json');
const statePath = join(work, 'state.json');
try {
  await writeFile(output, 'prepared audio');
  await writeFile(source, 'original recording');
  const r = { videoId: id, output, source, sha256: await digest(output), sourceHash: await digest(source),
    bytes: (await stat(output)).size, sourceBytes: (await stat(source)).size, durationSeconds: 42, timelineConfirmed: true };
  r.uploaded = { sha256: r.sha256, bytes: r.bytes };
  await save(statePath, { [id]: r });
  await save(join(work, 'plan.json'), { input: join(work, 'input'), records: [{ id, source }] });
  await save(catalogPath, []);
  await assert.rejects(markPlaybackVerified(work, { id, catalogPath }), /registered first/);
  await save(catalogPath, [{ videoId: id, objectKey: `audio/${id}.m4a`, bytes: r.bytes, durationSeconds: 42 }]);
  assert.equal((await cleanup(work, { catalogPath })).files.length, 0, 'must first confirm published playback');
  await markPlaybackVerified(work, { id, catalogPath });
  assert.equal((await cleanup(work, { catalogPath })).files.length, 1, 'default selects generated audio only');
  assert.equal((await cleanup(work, { catalogPath, deleteSources: true })).files.length, 2);
  assert.equal(await readFile(output, 'utf8'), 'prepared audio', 'preview never deletes');
  class HeadObjectCommand { constructor(input) { this.input = input; } }
  let remotePresent = false, reads = 0;
  const connection = { sdk: { HeadObjectCommand }, s3: { async send(command) {
    assert.ok(command instanceof HeadObjectCommand, 'cleanup must never upload/delete remote audio'); reads++;
    if (!remotePresent) { const e = Error('missing'); e.$metadata = { httpStatusCode: 404 }; throw e; }
    return { ContentLength: r.bytes, Metadata: { sha256: r.sha256 } };
  } } };
  await assert.rejects(cleanup(work, { catalogPath, connection, apply: true, deleteSources: true }), /remote audio missing/);
  assert.ok(await stat(source)); assert.ok(await stat(output));
  remotePresent = true;
  await writeFile(source, 'new replacement source');
  assert.equal((await cleanup(work, { catalogPath, deleteSources: true })).files.length, 0, 'changed source keeps entire recording');
  await writeFile(source, 'original recording');
  await cleanup(work, { catalogPath, connection, apply: true });
  assert.equal(await stat(output).catch(() => null), null);
  assert.ok(await stat(source), 'source kept by default');
  assert.ok((await json(statePath))[id].cleaned.output);
  assert.equal((await cleanup(work, { catalogPath })).files.length, 0, 'repeated cleanup is safe');
  await cleanup(work, { catalogPath, connection, apply: true, deleteSources: true });
  assert.equal(await stat(source).catch(() => null), null);
  assert.ok((await json(statePath))[id].sourceHash, 'small audit/progress records remain');
  assert.ok(reads >= 3, 'each applied recording checks remote again');
  // Tampered paths cannot select arbitrary files, even if their hashes match.
  r.output = join(work, 'unrelated.m4a');
  await writeFile(r.output, 'prepared audio');
  r.playbackVerified = { sha256: r.sha256 };
  await save(statePath, { [id]: r });
  assert.equal((await cleanup(work, { catalogPath, apply: true, connection })).files.length, 0);
  assert.ok(await stat(r.output));
  console.log('PASS: cleanup preview, publication confirmation gates, fresh remote checks, changed-file protection, source opt-in, repeat cleanup, path restrictions, and retained audit records.');
} finally {
  const target = resolve(work);
  if (!target.startsWith(resolve(parent) + '\\') && !target.startsWith(resolve(parent) + '/')) throw Error('Unsafe test cleanup path');
  await rm(target, { recursive: true, force: true });
}
