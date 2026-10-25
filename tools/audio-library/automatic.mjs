import { mkdir, open, readFile, unlink, lstat, realpath, statfs } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, json, save, digest, client, ensureRemote } from './import.mjs';
import { trial } from './youtube-trial.mjs';
import { loadVideoLibrary } from '../video-library.mjs';
import { workerOrigin, validSecret } from '../live-audio/cloud/auth.mjs';
export const WORK = join(ROOT, 'tools/audio-library/work/automatic-recorded');
const MEDIA = join(ROOT, 'tools/audio-library/work/youtube-trial');
export function updateQueue(state, library, catalog, now = Date.now()) {
  const known = new Set(state.seenIds), registered = new Set(catalog.map(r => r.videoId));
  const ids = new Set(library.map(r => r.id));
  for (const entry of library) {
    if (!known.has(entry.id) && !registered.has(entry.id)) state.jobs[entry.id] ||= { videoId: entry.id, phase: 'pending', attempts: 0, nextAttempt: now };
    if (state.jobs[entry.id]?.phase === 'removed') { state.jobs[entry.id].phase = 'pending'; state.jobs[entry.id].nextAttempt = now; }
    known.add(entry.id);
  }
  for (const job of Object.values(state.jobs)) if (!ids.has(job.videoId) && job.phase !== 'published') job.phase = 'removed';
  state.seenIds = [...known];
  return state;
}
export async function initialize({ work = WORK, seedId, library, catalog } = {}) {
  library ||= await loadVideoLibrary(ROOT);
  catalog ||= await json(join(ROOT, 'tools/members/functions/audio-catalog.json'));
  const path = join(work, 'queue.json');
  const state = await json(path, { version: 1, initializedAt: new Date().toISOString(), seenIds: library.map(r => r.id), jobs: {} });
  if (seedId) {
    if (!/^[\w-]{11}$/.test(seedId) || !library.some(r => r.id === seedId)) throw Error('Seed video must be in the website ID lists.');
    if (!catalog.some(r => r.videoId === seedId)) state.jobs[seedId] ||= { videoId: seedId, phase: 'pending', attempts: 0, nextAttempt: Date.now() };
  }
  await save(path, state);
  console.log('Recorded-audio queue initialized. Existing library is left for Takeout; future new IDs will be queued.');
  return state;
}
export async function registerRecording(record, { origin, uploadKey, send = fetch }) {
  const body = JSON.stringify({ videoId: record.videoId, title: record.title, objectKey: `audio/${record.videoId}.m4a`, bytes: record.bytes, durationSeconds: record.audioDurationSeconds, sha256: record.sha256 });
  const response = await send(workerOrigin(origin) + `/upload/recordings/${record.videoId}.json`, { method: 'PUT', headers: { Authorization: 'Bearer ' + uploadKey, 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) }, body, redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok) { await response.body?.cancel(); throw Error('Registration not accepted (HTTP ' + response.status + ').'); }
  const receipt = await response.json();
  if (!receipt.registered || receipt.videoId !== record.videoId || receipt.sha256 !== record.sha256) throw Error('Registration receipt did not match.');
  return receipt;
}
export async function uploadDownloaded(record, connection) {
  const expected = resolve(MEDIA, record.videoId, 'audio.m4a');
  if (!/^[\w-]{11}$/.test(record.videoId) || resolve(record.file) !== expected) throw Error('Unexpected generated upload path.');
  const item = { ...record, output: expected };
  const bounded = { sdk: connection.sdk, s3: { send: command => connection.s3.send(command, { abortSignal: AbortSignal.timeout(15 * 60000) }) } };
  if (await ensureRemote(item, bounded, false)) return;
  const info = await lstat(expected);
  if (!info.isFile() || info.isSymbolicLink() || info.size !== record.bytes || await digest(expected) !== record.sha256) throw Error('Generated audio changed before upload; keeping it for review.');
  await ensureRemote(item, bounded);
}
export async function cleanDownloaded(record, media = MEDIA) {
  const expected = resolve(media, record.videoId, 'audio.m4a');
  if (!/^[\w-]{11}$/.test(record.videoId) || resolve(record.file) !== expected) throw Error('Unexpected generated file.');
  const info = await lstat(expected).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
  if (!info) return;
  if (!info.isFile() || info.isSymbolicLink() || await realpath(expected) !== expected || info.size !== record.bytes || await digest(expected) !== record.sha256) throw Error('Generated file changed; keeping it for review.');
  await unlink(expected);
}
export async function tick({ state, library, catalog, download, remote, register, cleanup = cleanDownloaded, persist = async () => {}, progress = () => {}, now = Date.now }) {
  const current = await library();
  updateQueue(state, current, catalog, now()); await persist(state);
  // Keep at most one unpublished downloaded recording: network failures cannot fill the disk.
  if (Object.values(state.jobs).some(j => j.record && j.phase === 'attention')) return null;
  const jobs = Object.values(state.jobs).filter(j => !['published', 'removed', 'attention'].includes(j.phase));
  const job = jobs.find(j => j.record) || jobs.find(j => j.nextAttempt <= now());
  if (!job || job.nextAttempt > now()) return null;
  try {
    if (!job.record) {
      const [r] = await download(job.videoId);
      if (!r || !['local audio verified', 'existing local trial audio verified'].includes(r.status)) {
        if (r?.status === 'waiting for replay') { job.phase = 'waiting'; job.message = r.reason; job.nextAttempt = now() + 10 * 60000; await persist(state); return job; }
        throw Error(r?.reason || 'Download did not complete.');
      }
      job.record = r; job.phase = 'downloaded'; await persist(state);
    }
    if (!(await library()).some(v => v.id === job.videoId)) { job.phase = 'removed'; await persist(state); return job; }
    progress(`${job.videoId}: checking R2 and uploading ${(job.record.bytes / 1024 ** 2).toFixed(1)} MB if needed. Keep this window open; upload speed depends on your connection.`);
    await remote(job.record); job.phase = 'uploaded'; await persist(state);
    progress(`${job.videoId}: upload verified; registering Listen…`);
    if (!(await library()).some(v => v.id === job.videoId)) { job.phase = 'removed'; await persist(state); return job; }
    await register(job.record);
    // The remote object and registration were just acknowledged. Only generated audio is deleted.
    progress(`${job.videoId}: registration verified; cleaning generated local audio…`);
    await cleanup(job.record);
    job.phase = 'published'; job.completedAt = new Date(now()).toISOString(); job.message = 'Listen registered; generated local audio removed.';
    delete job.messageError; await persist(state);
  } catch (error) {
    job.attempts++; job.phase = job.attempts >= 6 ? 'attention' : 'retry';
    job.nextAttempt = now() + [60000, 300000, 900000, 3600000, 10800000][Math.min(job.attempts - 1, 4)];
    job.message = error.$metadata ? `Storage request failed (HTTP ${error.$metadata.httpStatusCode || 0}).` : String(error.message).replace(/https?:\/\/\S+/g, '[address omitted]').slice(0, 250);
    await persist(state);
  }
  return job;
}
async function main() {
  const [action, ...args] = process.argv.slice(2), i = args.indexOf('--id'), id = i < 0 ? undefined : args[i + 1];
  if (action === 'init') { await initialize({ seedId: id }); return; }
  if (action === 'status') { const state = await json(join(WORK, 'queue.json')); for (const j of Object.values(state.jobs)) console.log(`${j.videoId}: ${j.phase}${j.message ? ' — ' + j.message : ''}`); return; }
  if (action === 'retry') {
    const state = await json(join(WORK, 'queue.json')), job = state.jobs[id];
    if (!job || !/^[\w-]{11}$/.test(id) || job.phase === 'published') throw Error('Select an unfinished queued ID.');
    job.phase = 'pending'; job.attempts = 0; job.nextAttempt = 0; await save(join(WORK, 'queue.json'), state); return;
  }
  if (action !== 'run') throw Error('Use init, run, status, or retry --id VIDEO_ID.');
  await mkdir(WORK, { recursive: true });
  const lockPath = join(WORK, 'worker.lock');
  async function lock() {
    try { const file = await open(lockPath, 'wx'); await file.writeFile(String(process.pid)); await file.close(); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const pid = Number(await readFile(lockPath, 'utf8'));
      if (!Number.isSafeInteger(pid) || pid < 1) throw Error('Worker lock needs review.');
      try { process.kill(pid, 0); throw Error('Recorded-audio worker is already running.'); }
      catch (e) { if (e.code !== 'ESRCH') throw e; }
      await unlink(lockPath); await lock();
    }
  }
  await lock();
  let connection;
  try {
    const config = await json(join(WORK, 'config.private.json'));
    const gateway = await json(join(ROOT, 'tools/live-audio/work/cloud-secrets.json'));
    if (!validSecret(gateway.LIVE_UPLOAD_KEY)) throw Error('Existing gateway upload setup is missing.');
    const origin = workerOrigin(config.origin);
    connection = await client();
    let stopped = false; process.once('SIGTERM', () => { stopped = true; }); process.once('SIGINT', () => { stopped = true; });
    do {
      const state = await json(join(WORK, 'queue.json'));
      const result = await tick({ state, library: () => loadVideoLibrary(ROOT), catalog: await json(join(ROOT, 'tools/members/functions/audio-catalog.json')),
        download: async videoId => {
          const space = await statfs(WORK); if (Number(space.bavail) * Number(space.bsize) < 2 * 1024 ** 3) throw Error('Less than 2 GB free; audio download paused.');
          return trial({ id: videoId, limit: 1, download: true, embedded: true });
        },
        remote: r => uploadDownloaded(r, connection),
        register: r => registerRecording(r, { origin, uploadKey: gateway.LIVE_UPLOAD_KEY }),
        persist: value => save(join(WORK, 'queue.json'), value), progress: message => console.log(message)
      });
      if (result) console.log(`${result.videoId}: ${result.phase}`);
      if (args.includes('--once') || stopped) break;
      await new Promise(ok => { const wake = () => { clearTimeout(timer); process.removeListener('SIGTERM', wake); process.removeListener('SIGINT', wake); ok(); }; const timer = setTimeout(wake, 60000); process.once('SIGTERM', wake); process.once('SIGINT', wake); });
    } while (!stopped);
  } finally { connection?.s3.destroy(); await unlink(lockPath).catch(() => {}); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Automatic recorded audio could not continue. Check setup and status; no stream settings were changed.'); process.exitCode = 1; });
