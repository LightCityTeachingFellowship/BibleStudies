import { lstat, realpath, unlink } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, json, save, digest, client, ensureRemote } from './import.mjs';

const DEFAULT_WORK = join(ROOT, 'tools/audio-library/work');
const CATALOG = join(ROOT, 'tools/members/functions/audio-catalog.json');
const validId = id => /^[\w-]{11}$/.test(id || '');
const inside = (root, path) => {
  const part = relative(root, path);
  return Boolean(part) && !part.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')) && part !== '..' && !isAbsolute(part);
};
export function registeredRecording(r, catalog) {
  return validId(r.videoId) && r.timelineConfirmed && r.uploaded?.sha256 === r.sha256
    && r.uploaded?.bytes === r.bytes && /^[a-f\d]{64}$/.test(r.sha256 || '')
    && catalog.some(c => c.videoId === r.videoId && c.objectKey === `audio/${r.videoId}.m4a`
      && c.bytes === r.bytes && c.durationSeconds === r.durationSeconds);
}
export async function markPlaybackVerified(work = DEFAULT_WORK, { id, all = false, catalogPath = CATALOG } = {}) {
  const statePath = join(work, 'state.json'), state = await json(statePath);
  const catalog = await json(catalogPath);
  const selected = Object.values(state).filter(r => all || r.videoId === id);
  if (!selected.length) throw Error('Select a prepared recording with --id ID, or --all after testing every recording.');
  if (selected.some(r => !registeredRecording(r, catalog))) throw Error('Every selected recording must be confirmed, uploaded, and registered first.');
  for (const r of selected) r.playbackVerified = { sha256: r.sha256, verifiedAt: new Date().toISOString() };
  await save(statePath, state);
  console.log(`${selected.length} published playback confirmations saved. This records your listening check; it does not deploy anything.`);
}
// Only individual, unchanged files can be removed. Resolve both parent and target to reject
// directory junctions and symlinks escaping the allowed directory. Never recurse over folders.
async function checkedFile(path, root, hash, bytes) {
  if (!path || !inside(resolve(root), resolve(path))) throw Error('File is outside its allowed directory');
  const info = await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (!info) return null;
  if (!info.isFile() || info.isSymbolicLink()) throw Error('Only regular files can be cleaned');
  const [actualRoot, actualFile] = await Promise.all([realpath(root), realpath(path)]);
  if (!inside(actualRoot, actualFile)) throw Error('File resolves outside its allowed directory');
  if (info.size !== bytes || await digest(path) !== hash) throw Error('Local file changed; keeping it');
  return { path: resolve(path), bytes: info.size, mtimeMs: info.mtimeMs };
}
export async function cleanup(work = DEFAULT_WORK, { id, apply = false, deleteSources = false, catalogPath = CATALOG, connection } = {}) {
  work = resolve(work);
  const statePath = join(work, 'state.json'), state = await json(statePath);
  const catalog = await json(catalogPath);
  const plan = await json(join(work, 'plan.json'), {});
  const report = { createdAt: new Date().toISOString(), apply, deleteSources, files: [], skipped: [] };
  const selected = Object.values(state).filter(r => !id || r.videoId === id);
  if (!selected.length) throw Error('No imported recordings selected.');
  // Validate the entire selection before deleting anything.
  for (const r of selected) {
    if (!registeredRecording(r, catalog) || r.playbackVerified?.sha256 !== r.sha256) {
      report.skipped.push({ videoId: r.videoId, reason: 'Needs registered upload and published playback confirmation' });
      continue;
    }
    try {
      const expectedOutput = join(work, 'audio', r.videoId + '.m4a');
      if (resolve(r.output || '') !== expectedOutput) throw Error('Unexpected output path; keeping files');
      const files = [];
      const output = await checkedFile(r.output, work, r.sha256, r.bytes);
      if (output) files.push({ ...output, kind: 'generated audio', videoId: r.videoId });
      if (deleteSources) {
        if (!plan.input || !plan.records?.some(p => p.id === r.videoId && resolve(p.source) === resolve(r.source))) throw Error('Source is not in the current import plan');
        const source = await checkedFile(r.source, plan.input, r.sourceHash, r.sourceBytes);
        if (source && source.path !== output?.path) files.push({ ...source, kind: 'source recording', videoId: r.videoId });
      }
      report.files.push(...files);
    } catch (error) { report.skipped.push({ videoId: r.videoId, reason: error.message }); }
  }
  await save(join(work, 'cleanup-preview.json'), report);
  const bytes = report.files.reduce((sum, f) => sum + f.bytes, 0);
  console.log(`${apply ? 'Cleanup' : 'Preview'}: ${report.files.length} files, ${(bytes / 1024 ** 2).toFixed(1)} MB. ${report.skipped.length} recordings kept pending review.`);
  for (const f of report.files) console.log(`${f.kind}: ${f.path}`);
  for (const r of report.skipped) console.log(`${r.videoId}: kept — ${r.reason}`);
  if (!apply || !report.files.length) return report;
  const remote = connection || await client();
  try {
    for (const videoId of new Set(report.files.map(f => f.videoId))) {
      const r = state[videoId];
      // A saved upload receipt is insufficient: check the private R2 object now.
      if (!await ensureRemote(r, remote, false)) throw Error(`${videoId}: remote audio missing; no files for this recording were deleted`);
      const files = report.files.filter(f => f.videoId === videoId);
      for (const f of files) {
        // Journal before each removal makes interrupted cleanup safe to resume.
        r.cleanupPending = { path: f.path, kind: f.kind, startedAt: new Date().toISOString() };
        await save(statePath, state);
        const checked = await checkedFile(f.path, f.kind === 'source recording' ? plan.input : work,
          f.kind === 'source recording' ? r.sourceHash : r.sha256, f.bytes);
        if (checked) await unlink(checked.path);
        r.cleaned = { ...r.cleaned, [f.kind === 'source recording' ? 'source' : 'output']: new Date().toISOString() };
        delete r.cleanupPending;
        await save(statePath, state);
      }
    }
  } finally { if (!connection) remote.s3.destroy(); }
  console.log('Cleanup complete. Progress records and remote audio are retained.');
  return report;
}
async function main() {
  const [action, ...args] = process.argv.slice(2);
  const option = name => { const i = args.indexOf('--' + name); return i < 0 ? undefined : args[i + 1]; };
  const work = resolve(option('work') || DEFAULT_WORK), id = option('id');
  if (id && !validId(id)) throw Error('Use a valid video ID');
  if (action === 'confirm-playback') {
    if (!args.includes('--playback-tested')) throw Error('First test Listen and seeking on the published site, then add --playback-tested.');
    await markPlaybackVerified(work, { id, all: args.includes('--all') });
  } else if (action === 'cleanup') {
    await cleanup(work, { id, apply: args.includes('--apply'), deleteSources: args.includes('--delete-sources') });
  } else console.log('Commands: confirm-playback --id ID --playback-tested; cleanup [--id ID] [--apply] [--delete-sources]. All accept --work PATH. Cleanup defaults to preview; source recordings are kept.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.$metadata ? `${error.name} (HTTP ${error.$metadata.httpStatusCode || 0})` : error.message); process.exitCode = 1; });
