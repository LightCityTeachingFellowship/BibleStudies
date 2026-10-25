import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, json, save, digest, probe } from './import.mjs';
import { loadVideoLibrary } from '../video-library.mjs';

const WORK = join(ROOT, 'tools/audio-library/work/youtube-trial');
const RUNTIME = join(ROOT, 'tools/audio-library/work/downloader');
const CATALOG = join(ROOT, 'tools/members/functions/audio-catalog.json');
const VALID_ID = /^[\w-]{11}$/;
// These are the two LightCity channels already represented in the working pilot.
export const CHANNELS = new Set(['UCyyEJA1Q2c_xpSiUykXunNQ', 'UCSyzYdX_Tl9v8we0h4ynXYg']);
export function candidates(library, catalog, { id, limit = 3 } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 3) throw Error('This trial is limited to 1–3 recordings.');
  if (id && !VALID_ID.test(id)) throw Error('Invalid video ID.');
  if (id && !library.some(v => v.id === id)) throw Error('Video ID is not in the current website lists.');
  const existing = new Set(catalog.map(v => v.videoId));
  return library.filter(v => (!id || v.id === id) && !existing.has(v.id)).slice(0, limit);
}
export function validateMetadata(info, entry) {
  if (info.id !== entry.id || !CHANNELS.has(info.channel_id)) throw Error('CHANNEL_MISMATCH');
  if (!['not_live', 'was_live'].includes(info.live_status) || info.is_live || info.is_upcoming) throw Error('WAIT_FOR_REPLAY');
  if (!Number.isFinite(info.duration) || info.duration <= 0 || info.duration > 16 * 3600) throw Error('DURATION_UNAVAILABLE');
  const formats = (info.formats || [info]).filter(f => f.vcodec === 'none' && f.acodec && f.acodec !== 'none' && !f.has_drm);
  if (!formats.length) throw Error('AUDIO_UNAVAILABLE');
  return { videoId: info.id, title: String(info.title || entry.title || entry.id).slice(0, 300), channelId: info.channel_id,
    durationSeconds: info.duration, visibility: entry.visibility === 'public' ? 'public' : 'members', liveStatus: info.live_status };
}
export function failureReason(message = '') {
  if (/timed out|timeout/i.test(message)) return 'The YouTube request timed out; retry later.';
  if (/ENOENT/.test(message)) return 'The requested audio file or local processing tool was not found.';
  if (/JSON|Unexpected token|Unexpected end/.test(message)) return 'The metadata response was incomplete; retry later.';
  if (/sign in|not a bot|confirm you/i.test(message)) return 'YouTube requested a sign-in/bot check. No browser login or cookies were accessed.';
  if (/private video|unavailable|removed|copyright/i.test(message)) return 'This video is unavailable to the unauthenticated downloader.';
  if (/429|too many requests/i.test(message)) return 'YouTube limited requests; retry later.';
  if (/403|forbidden/i.test(message)) return 'YouTube refused the audio download; the downloader may need maintenance.';
  if (/WAIT_FOR_REPLAY/.test(message)) return 'Live, upcoming, or replay still processing; wait for the finished upload.';
  if (/CHANNEL_MISMATCH/.test(message)) return 'The returned video/channel does not match the approved LightCity channels.';
  if (/DURATION_UNAVAILABLE|AUDIO_UNAVAILABLE/.test(message)) return 'A complete audio track and duration are not available yet.';
  return 'The download/check did not complete. The working site has not been changed.';
}
function run(executable, args, { timeout = 120000, maxBytes = 24 * 1024 * 1024 } = {}) {
  return new Promise((accept, reject) => {
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };
    for (const key of Object.keys(env)) if (/^(R2_|LIVE_|FIREBASE_|GOOGLE_APPLICATION_CREDENTIALS)/i.test(key)) delete env[key];
    const child = spawn(executable, args, { cwd: ROOT, windowsHide: true, env });
    let out = '', err = '', stopped = false;
    const timer = setTimeout(() => { stopped = true; child.kill(); }, timeout);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdin.end();
    child.stdout.on('data', c => { out += c; if (Buffer.byteLength(out) > maxBytes) { stopped = true; child.kill(); } });
    child.stderr.on('data', c => { err = (err + c.toString('utf8')).slice(-16000); });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => { clearTimeout(timer); code === 0 && !stopped ? accept(out) : reject(Error(err || 'Request timed out')); });
  });
}
export async function downloader() {
  const binary = join(RUNTIME, 'yt-dlp'), release = await json(join(RUNTIME, 'release.json'));
  if (!/^[a-f\d]{64}$/.test(release.sha256 || '') || await digest(binary) !== release.sha256) throw Error('Downloader integrity check failed; run setup-downloader.ps1 again.');
  const python = process.env.LIGHTCITY_PYTHON || 'python';
  return { version: release.version, async call(args, options) {
    return run(python, [binary, '--ignore-config', '--no-cache-dir', '--no-plugin-dirs', '--no-playlist',
      '--js-runtimes', `node:${process.execPath}`, '--socket-timeout', '20', '--retries', '1',
      '--fragment-retries', '1', '--no-progress', '--no-warnings', ...args], options);
  } };
}
export async function trial({ id, limit = 3, download = false, work = WORK, tool, library, catalog, embedded = false } = {}) {
  work = resolve(work);
  library ||= await loadVideoLibrary(ROOT);
  catalog ||= await json(CATALOG);
  const selected = candidates(library, catalog, { id, limit });
  if (!selected.length) { console.log('No unregistered recordings selected. Existing pilot audio is left alone.'); return []; }
  tool ||= await downloader();
  await mkdir(work, { recursive: true });
  const report = { createdAt: new Date().toISOString(), downloaderVersion: tool.version, download, recordings: [] };
  for (const entry of selected) {
    const record = { videoId: entry.id, visibility: entry.visibility };
    report.recordings.push(record);
    try {
      console.log(`${entry.id}: checking the final uploaded video…`);
      const url = `https://www.youtube.com/watch?v=${entry.id}`;
      const info = JSON.parse(await tool.call(['--skip-download', '--format', 'bestaudio[acodec^=mp4a]/bestaudio',
        '--print', '%(.{id,title,channel_id,duration,live_status,is_live,is_upcoming,acodec,vcodec,has_drm})j', url]));
      Object.assign(record, validateMetadata(info, entry), { status: 'metadata verified' });
      if (download) {
        const folder = join(work, entry.id);
        await mkdir(folder, { recursive: true });
        const output = join(folder, 'audio.m4a');
        const previous = await json(join(folder, 'verified.json'), null);
        const existingStat = await stat(output).catch(() => null);
        if (previous?.videoId === entry.id && previous.channelId === record.channelId
          && Math.abs(previous.durationSeconds - record.durationSeconds) <= 1
          && existingStat?.size === previous.bytes && await digest(output) === previous.sha256) {
          Object.assign(record, previous, { status: 'existing local trial audio verified' });
        } else {
          if (existingStat) throw Error('Existing trial output differs; keep it for review rather than overwrite.');
          // The fresh extraction is filtered again: never download an active stream or a different channel.
          const filter = `channel_id = '${record.channelId}' & !is_live & !is_upcoming`;
          await tool.call(['--match-filter', filter, '--format', 'bestaudio[acodec^=mp4a]/bestaudio',
            '--max-filesize', '500M', '--no-overwrites', '--extract-audio', '--audio-format', 'm4a',
            '--audio-quality', '128K', '--ffmpeg-location', join(ROOT, 'tools/audio-pilot/runtime'),
            '--output', join(folder, 'audio.%(ext)s'), url], { timeout: 20 * 60 * 1000 });
          const check = await probe(output), streams = check.streams || [];
          const duration = Number(check.format?.duration), bytes = (await stat(output)).size;
          if (streams.length !== 1 || streams[0].codec_type !== 'audio' || streams[0].codec_name !== 'aac'
            || !Number.isFinite(duration) || Math.abs(duration - record.durationSeconds) > 1 || !bytes) throw Error('Audio validation failed.');
          Object.assign(record, { status: 'local audio verified', file: output, bytes, sha256: await digest(output),
            audioDurationSeconds: duration, codec: 'aac', bitrateKbps: Math.round(Number(streams[0].bit_rate) / 1000) || null });
          await save(join(folder, 'verified.json'), record);
        }
        // Re-read the site lists so a removal or audience change during download cannot be published later.
        const current = tool.testMode ? library : await loadVideoLibrary(ROOT);
        const now = current.find(v => v.id === entry.id);
        if (!now) throw Error('Video was removed from the website while downloading.');
        record.visibility = now.visibility === 'public' ? 'public' : 'members';
      }
      console.log(`${entry.id}: ${record.status}; ${record.title}; ${record.durationSeconds}s`);
    } catch (error) {
      record.status = error.message === 'WAIT_FOR_REPLAY' ? 'waiting for replay' : 'needs retry'; record.reason = failureReason(error.message);
      record.retryAfter = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      console.log(`${entry.id}: ${record.reason}`);
    }
    // Deliberately omit signed media URLs, browser data, and downloader raw responses.
    await save(join(work, 'report.json'), report);
  }
  if (!embedded) console.log('Trial finished. No R2 upload, catalogue edit, deployment, or automatic background task was performed.');
  return report.recordings;
}
async function main() {
  const args = process.argv.slice(2), option = name => { const i = args.indexOf('--' + name); return i < 0 ? undefined : args[i + 1]; };
  const records = await trial({ id: option('id'), limit: Number(option('limit') || 3), download: args.includes('--download') });
  if (records.some(r => r.status === 'needs retry')) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Trial could not start. Check the local downloader setup and website ID lists.'); process.exitCode = 1; });
