import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ROOT, json } from './import.mjs';
import { selectCatchup, requestCatchup, applyRequests } from './catchup.mjs';
const entries = Array.from({ length: 28 }, (_, i) => ({ id: String(28 - i).padStart(11, '0'), title: `Day ${28 - i} - Prayer Meeting`, visibility: 'members' }));
entries.splice(10, 0, { id: 'unrelated01', title: 'Separate Sunday teaching', visibility: 'members' });
const catalog = [22,23,24,25,26].map(day => ({ videoId: String(day).padStart(11, '0') }));
const doneId = String(27).padStart(11, '0'), through = String(28).padStart(11, '0');
const jobs = { [doneId]: { videoId: doneId, phase: 'published', record: { untouched: true } } };
const selected = selectCatchup(entries, through, catalog, jobs);
assert.equal(selected.length, 22); assert.equal(selected[0].day, 28); assert.equal(selected[1].day, 21);
assert.ok(!selected.some(v => v.id === 'unrelated01'));
assert.throws(() => selectCatchup(entries.slice(0, -1), through), /full Day/);
const parent = join(ROOT, 'tools/audio-library/work'), work = join(parent, 'catchup-test-' + Date.now());
await mkdir(work, { recursive: true });
try {
  await requestCatchup(work, entries, through, catalog, jobs);
  const state = { version: 1, seenIds: entries.map(v => v.id), jobs: structuredClone(jobs) };
  await applyRequests(work, state, entries, catalog, 1000);
  assert.equal(Object.keys(state.jobs).length, 23);
  assert.equal(state.jobs[doneId].phase, 'published'); assert.deepEqual(state.jobs[doneId].record, { untouched: true });
  assert.equal(state.jobs[through].nextAttempt, 1000);
  assert.equal(state.jobs['unrelated01'], undefined);
  await applyRequests(work, state, entries, catalog, 2000);
  assert.equal(Object.keys(state.jobs).length, 23);
  assert.equal((await json(join(work, 'queue.json'))).jobs[through].phase, 'pending');
  console.log('PASS: exact Day 1–28 selection, 22 missing recordings, existing audio skipped, unrelated videos excluded, durable requests and repeat-run safety.');
} finally {
  if (!resolve(work).startsWith(resolve(parent) + '\\') && !resolve(work).startsWith(resolve(parent) + '/')) throw Error('Unsafe fixture cleanup');
  await rm(work, { recursive: true, force: true });
}
