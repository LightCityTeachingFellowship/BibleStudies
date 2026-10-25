import { readdir, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { json, save } from './import.mjs';
export function selectCatchup(entries, throughId, catalog = [], jobs = {}) {
  const start = entries.findIndex(v => v.id === throughId);
  if (start < 0) throw Error('Day 28 ID is no longer in the website list.');
  const found = [], days = new Set();
  for (const v of entries.slice(start)) {
    const match = String(v.title || '').match(/^Day\s+(\d{1,2})\b/i);
    if (!match) continue;
    const day = Number(match[1]);
    if (day < 1 || day > 28 || days.has(day)) throw Error('Recent series is ambiguous; review before queuing.');
    days.add(day); found.push({ ...v, day });
    if (day === 1) break;
  }
  if (days.size !== 28) throw Error('Could not identify the full Day 1–28 series; no batch was queued.');
  const done = new Set(catalog.map(r => r.videoId));
  return found.filter(v => !done.has(v.id) && jobs[v.id]?.phase !== 'published');
}
export async function requestCatchup(work, entries, throughId, catalog, jobs) {
  const selected = selectCatchup(entries, throughId, catalog, jobs);
  if (!selected.length) { console.log('The Day 1–28 series already has audio.'); return []; }
  const folder = join(work, 'requests'); await mkdir(folder, { recursive: true });
  const request = { version: 1, label: 'Day 1–28 missing prayer recordings', createdAt: new Date().toISOString(), ids: selected.map(v => v.id) };
  await save(join(folder, 'catchup-' + randomUUID() + '.json'), request);
  for (const v of selected) console.log(`Day ${v.day}: ${v.id}`);
  console.log(`${selected.length} recording requests saved safely. The updated worker will queue them without replacing existing progress.`);
  return selected;
}
export async function applyRequests(work, state, library, catalog, now = Date.now()) {
  const folder = join(work, 'requests');
  const names = await readdir(folder).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  const known = new Set(library.map(v => v.id)), done = new Set(catalog.map(r => r.videoId));
  for (const name of names.filter(n => /^catchup-[a-f\d-]{36}\.json$/.test(n))) {
    const path = join(folder, name), request = await json(path);
    if (request.version !== 1 || !Array.isArray(request.ids) || request.ids.length > 28 || request.ids.some(id => !/^[\w-]{11}$/.test(id)) || new Set(request.ids).size !== request.ids.length) throw Error('Invalid manual catch-up request.');
    for (const id of request.ids) if (known.has(id) && !done.has(id)) {
      state.jobs[id] ||= { videoId: id, phase: 'pending', attempts: 0, nextAttempt: now, requestedBy: 'manual catch-up' };
      if (state.jobs[id].phase === 'removed') { state.jobs[id].phase = 'pending'; state.jobs[id].nextAttempt = now; }
    }
    // Commit queue progress before acknowledging. A crash between these operations safely replays the request.
    await save(join(work, 'queue.json'), state);
    await rename(path, path + '.applied');
  }
  return state;
}
