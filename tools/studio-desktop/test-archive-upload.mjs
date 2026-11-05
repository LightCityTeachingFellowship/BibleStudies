import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {createArchiveUpload} from './archive-upload.mjs';

test('Studio reads archive progress and leaves the importer alone when busy or declined', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'lightcity-archive-'));
  t.after(() => rm(folder, {recursive: true, force: true}));
  const work = join(folder, 'tools/audio-library/work/message-archive');
  const importer = join(folder, 'tools/audio-archive');
  const config = join(work, '../automatic-recorded');
  await Promise.all([work, importer, config].map(path => mkdir(path, {recursive: true})));
  await writeFile(join(importer, 'run.ps1'), '');
  await writeFile(join(config, 'config.private.json'), '{}');
  let confirmations = 0;
  const controller = createArchiveUpload({
    preferencesFile: join(folder, 'preferences.json'),
    selectProject: () => folder,
    approveResume: () => { confirmations++; return false; },
  });
  assert.equal((await controller.status()).state, 'unconfigured');
  assert.equal((await controller.configure()).state, 'paused');
  const progress = join(work, 'status.json');
  const lock = join(work, 'import.lock');
  await writeFile(progress, JSON.stringify({completed: 3, total: 7, lastTitle: 'Last verified'}));
  await writeFile(lock, String(process.pid));
  await writeFile(join(work, 'activity.json'), JSON.stringify({pid: process.pid, title: 'Current recording'}));
  assert.equal((await controller.status()).currentTitle, 'Current recording');
  assert.equal((await controller.resume()).state, 'running');
  assert.equal(confirmations, 0);
  await rm(lock);
  await writeFile(join(work, 'activity.json'), JSON.stringify({state: 'failed', title: 'Interrupted recording'}));
  assert.equal((await controller.resume()).failedTitle, 'Interrupted recording');
  assert.equal(confirmations, 1);
  assert.equal(JSON.parse(await readFile(progress, 'utf8')).completed, 3);
  await writeFile(progress, JSON.stringify({completed: 7, total: 7}));
  assert.equal((await controller.status()).state, 'complete');
});
