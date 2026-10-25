import { readFile, writeFile, mkdir, readdir, stat, rename } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVideoLibrary } from '../video-library.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_WORK = join(ROOT, 'tools/audio-library/work');
const CATALOG = join(ROOT, 'tools/members/functions/audio-catalog.json');
const MEDIA = new Set(['.mp4', '.mkv', '.mov', '.webm', '.m4v', '.m4a', '.mp3', '.wav']);
const validId = id => /^[\w-]{11}$/.test(id || '');
export const normalize = text => String(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
export async function json(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
export async function save(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = path + '.tmp';
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n');
  await rename(temp, path);
}
async function* walk(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile() && MEDIA.has(extname(path).toLowerCase())) yield path;
  }
}
export function matchRecording(path, library, metadata = {}, override) {
  const known = new Map(library.map(v => [v.id, v]));
  if (override) return known.has(override) ? { id: override, method: 'reviewed mapping' } : { reason: 'Mapped ID is not in the website lists' };
  const stem = basename(path, extname(path));
  const ids = [metadata.videoId, metadata.id];
  for (const value of [metadata.url, metadata.videoUrl]) {
    if (typeof value !== 'string') continue;
    try { const u = new URL(value); ids.push(u.searchParams.get('v'), u.pathname.split('/').pop()); } catch {}
  }
  if (validId(stem)) ids.push(stem);
  const suffix = stem.match(/(?:\[|\()([\w-]{11})(?:\]|\))$/);
  if (suffix) ids.push(suffix[1]);
  const explicit = [...new Set(ids.filter(id => validId(id) && known.has(id)))];
  if (ids.some(id => validId(id) && !known.has(id))) return { reason: 'Filename or metadata identifies a video outside the website lists; review before matching' };
  if (explicit.length > 1) return { reason: 'Conflicting video IDs in filename or metadata' };
  if (explicit.length === 1) return { id: explicit[0], method: 'video ID' };
  const titles = new Set([stem, metadata.title].filter(Boolean).map(normalize));
  const matches = library.filter(v => v.title && titles.has(normalize(v.title)));
  return matches.length === 1 ? { id: matches[0].id, method: 'unique normalized title' }
    : { reason: matches.length ? 'Title matches more than one video; map explicitly' : 'No exact ID or unique title match; map explicitly' };
}
export async function plan(input, work = DEFAULT_WORK) {
  const library = await loadVideoLibrary(ROOT);
  const existing = new Set((await json(CATALOG)).map(v => v.videoId));
  const mapping = await json(join(work, 'mapping.json'), {});
  const records = [];
  for await (const path of walk(resolve(input))) {
    let metadata = await json(path + '.json', null);
    if (!metadata) metadata = await json(join(dirname(path), basename(path, extname(path)) + '.json'), {});
    const match = matchRecording(path, library, metadata, mapping[path]);
    const v = library.find(v => v.id === match.id);
    records.push({ source: path, ...match, title: v?.title || metadata.title || basename(path), visibility: v?.visibility, status: existing.has(match.id) ? 'already registered' : match.id ? 'ready' : 'review' });
  }
  const groups = new Map();
  for (const r of records.filter(r => r.status === 'ready')) groups.set(r.id, [...(groups.get(r.id) || []), r]);
  for (const group of groups.values()) if (group.length > 1) for (const r of group) { r.status = 'review'; r.reason = 'Multiple local files match this ID; select one with --id and remove the duplicate from this batch'; }
  await save(join(work, 'plan.json'), { input: resolve(input), createdAt: new Date().toISOString(), records });
  await save(join(work, 'review.json'), records.filter(r => r.status === 'review'));
  await save(join(work, 'missing.json'), library.filter(v => !existing.has(v.id) && !records.some(r => r.id === v.id && r.status === 'ready')));
  console.log(`Scanned ${records.length} files: ${records.filter(r => r.status === 'ready').length} ready, ${records.filter(r => r.status === 'already registered').length} already registered, ${records.filter(r => r.status === 'review').length} need review.`);
  return records;
}
function command(program, args) {
  return new Promise((accept, reject) => {
    const child = spawn(program, args, { windowsHide: true });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-2000); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? accept(stdout) : reject(new Error(`Media processing failed (${code}): ${stderr}`)));
  });
}
const executable = name => process.env[name.toUpperCase()] || join(ROOT, 'tools/audio-pilot/runtime', name + (process.platform === 'win32' ? '.exe' : ''));
export async function probe(path) {
  return JSON.parse(await command(executable('ffprobe'), ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path]));
}
export async function digest(path, algorithm = 'sha256', encoding = 'hex') {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest(encoding);
}
export function validateAudio(info, expectedDuration) {
  const streams = info.streams || [];
  const duration = Number(info.format?.duration);
  if (streams.length !== 1 || streams[0].codec_type !== 'audio' || streams[0].codec_name !== 'aac') throw Error('Expected one AAC audio stream and no video');
  if (!Number.isFinite(duration) || duration <= 0 || Math.abs(duration - expectedDuration) > 1) throw Error('Audio duration does not match its source');
  return duration;
}
export async function prepare(work = DEFAULT_WORK, { limit = 10, id } = {}) {
  const { records } = await json(join(work, 'plan.json'));
  const statePath = join(work, 'state.json');
  const state = await json(statePath, {});
  const selected = records.filter(r => r.status === 'ready' && (!id || r.id === id));
  let processed = 0;
  for (const r of selected) {
    if (processed >= limit) break;
    try {
      const previous = state[r.id];
      if (previous?.cleaned && previous.source === r.source) { console.log(`${r.id}: completed import; local files already cleaned`); continue; }
      const sourceStat = await stat(r.source);
      const outputStat = previous?.output ? await stat(previous.output).catch(() => null) : null;
      if (previous?.sourceBytes === sourceStat.size && previous.sourceMtime === sourceStat.mtimeMs && outputStat?.size === previous.bytes) { console.log(`${r.id}: already prepared`); continue; }
      if (previous?.uploaded) throw Error('Source changed after upload; use a separate work folder and review before replacing anything');
      const sourceHash = await digest(r.source);
      const sourceInfo = await probe(r.source);
      const sourceAudio = sourceInfo.streams.find(s => s.codec_type === 'audio');
      const duration = Number(sourceInfo.format?.duration);
      if (!sourceAudio || !Number.isFinite(duration) || duration <= 0) throw Error('Source has no usable audio/duration');
      const copy = sourceAudio.codec_name === 'aac';
      const output = join(work, 'audio', r.id + '.m4a');
      await mkdir(dirname(output), { recursive: true });
      const temporary = output + '.working.m4a';
      await command(executable('ffmpeg'), ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', r.source, '-map', '0:a:0', '-vn', ...(copy ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '128k']), '-map_metadata', '-1', '-movflags', '+faststart', temporary]);
      const info = await probe(temporary);
      const durationSeconds = validateAudio(info, duration);
      await rename(temporary, output);
      state[r.id] = { videoId: r.id, source: r.source, sourceBytes: sourceStat.size, sourceMtime: sourceStat.mtimeMs, sourceHash, output, sha256: await digest(output), bytes: (await stat(output)).size, durationSeconds, codec: 'aac', sourceBitrate: Number(sourceAudio.bit_rate) || null, method: copy ? 'stream copy; original AAC preserved' : 'AAC 128 kbps conversion', timelineConfirmed: false };
      await save(statePath, state);
      processed++;
      console.log(`${r.id}: prepared (${copy ? 'audio preserved' : 'converted to 128 kbps AAC'})`);
    } catch (error) { console.error(`${r.id}: ${error.message}`); process.exitCode = 1; }
  }
  console.log(`${processed} newly prepared. Completed files are skipped on the next run.`);
  return state;
}
export async function confirm(work, id, all = false) {
  const path = join(work, 'state.json'), state = await json(path);
  const records = Object.values(state).filter(r => all || r.videoId === id);
  if (!records.length) throw Error('No prepared recordings selected');
  for (const r of records) r.timelineConfirmed = true;
  await save(path, state);
  console.log(`${records.length} timeline confirmations recorded.`);
}
export function mergeCatalog(current, state, library) {
  const known = new Map(library.map(v => [v.id, v]));
  const merged = new Map(current.map(r => [r.videoId, { ...r }]));
  // Reconcile existing entries too: moving an ID to Members must not leave public audio behind.
  for (const [id, r] of merged) {
    const v = known.get(id);
    if (!v) { merged.delete(id); continue; }
    r.visibility = v.visibility === 'public' ? 'public' : 'members';
  }
  for (const r of Object.values(state)) {
    const v = known.get(r.videoId);
    if (!v || !r.uploaded || !r.timelineConfirmed || r.uploaded.sha256 !== r.sha256 || r.uploaded.bytes !== r.bytes) continue;
    if (merged.has(r.videoId)) continue;
    merged.set(r.videoId, { videoId: r.videoId, title: v.title || r.videoId, objectKey: `audio/${r.videoId}.m4a`, durationSeconds: r.durationSeconds, bytes: r.bytes, visibility: v.visibility === 'public' ? 'public' : 'members' });
  }
  return [...merged.values()];
}
export async function client() {
  const require = createRequire(join(ROOT, 'tools/members/functions/package.json'));
  const sdk = require('@aws-sdk/client-s3');
  const account = process.env.R2_AUDIO_ACCOUNT_ID;
  const accessKeyId = process.env.R2_UPLOAD_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_UPLOAD_SECRET_ACCESS_KEY;
  if (!/^[a-f\d]{32}$/i.test(account || '') || !/^[a-f\d]{32}$/i.test(accessKeyId || '') || !/^[a-f\d]{64}$/i.test(secretAccessKey || '')) throw Error('Supply the account ID and matching R2 upload credentials through the upload helper');
  return { sdk, s3: new sdk.S3Client({ region: 'auto', forcePathStyle: true, endpoint: `https://${account}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey }, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' }) };
}
export function remoteMatches(head, r) {
  return Number(head.ContentLength) === r.bytes && head.Metadata?.sha256 === r.sha256;
}
export async function ensureRemote(r, { sdk, s3 }, allowPut = true) {
  const Bucket = 'lightcity-audio', Key = `audio/${r.videoId}.m4a`;
  let head;
  try { head = await s3.send(new sdk.HeadObjectCommand({ Bucket, Key })); }
  catch (e) { if (e.$metadata?.httpStatusCode !== 404) throw e; }
  if (head && !remoteMatches(head, r)) throw Error('A different or unverified object already exists; refusing to overwrite it');
  if (!head) {
    if (!allowPut) return false;
    await s3.send(new sdk.PutObjectCommand({ Bucket, Key, Body: createReadStream(r.output), ContentLength: r.bytes, ContentType: 'audio/mp4', ContentMD5: await digest(r.output, 'md5', 'base64'), Metadata: { sha256: r.sha256 }, IfNoneMatch: '*' }));
    head = await s3.send(new sdk.HeadObjectCommand({ Bucket, Key }));
    if (!remoteMatches(head, r)) throw Error('Remote size/checksum metadata verification failed');
    return 'uploaded';
  }
  return 'existing';
}
export async function upload(work = DEFAULT_WORK, { limit = 10, id } = {}) {
  const { sdk, s3 } = await client();
  const path = join(work, 'state.json'), state = await json(path);
  let count = 0;
  for (const r of Object.values(state).filter(r => r.timelineConfirmed && (!id || r.videoId === id))) {
    if (count >= limit && !r.uploaded) continue;
    try {
      if (r.uploaded?.sha256 === r.sha256 && r.uploaded.bytes === r.bytes) {
        if (!await ensureRemote(r, { sdk, s3 }, false)) throw Error('Previously verified object is now missing from R2; restore it before registering');
        console.log(`${r.videoId}: completed upload still verified`);
        continue;
      }
      if (await digest(r.output) !== r.sha256 || (await stat(r.output)).size !== r.bytes) throw Error('Prepared file changed; prepare it again');
      if (r.bytes >= 5 * 1024 ** 3) throw Error('File exceeds single-upload limit; needs multipart upload');
      const result = await ensureRemote(r, { sdk, s3 }, count < limit);
      if (!result) continue;
      if (result === 'uploaded') count++;
      r.uploaded = { sha256: r.sha256, bytes: r.bytes, verifiedAt: new Date().toISOString() };
      await save(path, state);
      console.log(`${r.videoId}: upload verified (${result})`);
    } catch (error) {
      // SDK messages can include request details. Print only the error class and HTTP code.
      const safe = error.$metadata ? `${error.name} (HTTP ${error.$metadata.httpStatusCode || 0})` : error.message;
      console.error(`${r.videoId}: ${safe}`); process.exitCode = 1;
    }
  }
  s3.destroy();
  console.log(`${count} new uploads. Interrupted files restart; completed files are verified and skipped.`);
}
export async function register(work = DEFAULT_WORK) {
  const state = await json(join(work, 'state.json'));
  const library = await loadVideoLibrary(ROOT);
  const current = await json(CATALOG);
  const next = mergeCatalog(current, state, library);
  await save(join(work, 'catalogue-preview.json'), next);
  if (JSON.stringify(current) === JSON.stringify(next)) { console.log('Catalogue already current.'); return; }
  await save(join(work, 'catalogue-backup-' + Date.now() + '.json'), current);
  await save(CATALOG, next);
  console.log(`Local catalogue updated: ${current.length} → ${next.length} recordings. Review the changes, then deploy getChurchAudio to publish.`);
}
async function main() {
  const [action, ...args] = process.argv.slice(2);
  const opt = name => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
  const work = resolve(opt('work') || DEFAULT_WORK);
  const id = opt('id'), limit = Number(opt('limit') || 10);
  if (!Number.isInteger(limit) || limit < 1 || (id && !validId(id))) throw Error('Use a positive integer limit and a valid video ID');
  switch (action) {
    case 'plan': if (!opt('input')) throw Error('Use plan --input PATH_TO_EXTRACTED_RECORDINGS'); await plan(opt('input'), work); break;
    case 'prepare': await prepare(work, { limit, id }); break;
    case 'confirm': if (!id && !args.includes('--all')) throw Error('Use --id VIDEO_ID or --all after verifying the exported recordings match the current YouTube timelines'); await confirm(work, id, args.includes('--all')); break;
    case 'upload': await upload(work, { limit, id }); break;
    case 'register': await register(work); break;
    default: console.log('Commands: plan --input PATH, prepare [--limit 10], confirm --id ID, upload [--limit 10], register. All accept --work PATH. See README.md.');
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
