import { createServer } from 'node:net';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { declaredLibrary, youtubeVideos } from './discovery.mjs';
import { AutomaticPublisher } from './engine.mjs';
import { startCapture } from './capture.mjs';
import { validSecret, workerOrigin } from '../cloud/auth.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..'), WORK = resolve(HERE, '../work/automatic');
export const AUDIO_PORT = 19354;
export function validControl(value, profile, now = Date.now()) {
  return value && value.version === 1 && value.profile === profile && typeof value.streaming === 'boolean' && Number.isFinite(value.updatedAt) && Math.abs(now - value.updatedAt) < 15000 && (!value.streaming || (/^stream-\d{13}$/.test(value.streamSession || '') && Number.isFinite(value.streamStartedAt) && value.streamStartedAt <= now + 1000 && value.streamStartedAt >= now - 57600000));
}
async function readJson(path) { try { return JSON.parse(await readFile(path, 'utf8')); } catch { throw Error('Automatic audio configuration or status is unavailable'); } }
function apiKey() {
  return new Promise((resolveKey, reject) => execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', join(HERE, 'key-reader.ps1')], { windowsHide: true, timeout: 15000, maxBuffer: 4096 }, (error, stdout) => {
    if (error || stdout.trim().length < 20 || stdout.trim().length > 200) reject(Error('The encrypted YouTube lookup key could not be opened')); else resolveKey(stdout.trim());
  }));
}
export async function main() {
  await mkdir(WORK, { recursive: true });
  const config = await readJson(join(WORK, 'config.private.json'));
  if (config.version !== 1 || typeof config.profileName !== 'string' || !config.profileName || !/^UC[\w-]{22}$/.test(config.channelId || '')) throw Error('Complete the one-time automatic setup first');
  const origin = workerOrigin(config.workerOrigin), secret = await readJson(resolve(HERE, '../work/cloud-secrets.json'));
  if (!validSecret(secret.LIVE_UPLOAD_KEY)) throw Error('The existing gateway upload setup is unavailable');
  const key = await apiKey();
  let current = null, stopped = false, lastControl = null, lastSeen = Date.now(), writes = Promise.resolve(), nextSession = Date.now();
  let state = { phase: 'ready', message: 'Automatic audio is ready. Start Streaming in your normal OBS profile.' };
  const status = (phase, message, detail = {}) => { state = { phase, message, ...detail }; };
  const saveState = () => {
    const snapshot = { app: 'lightcity-automatic-audio', pid: process.pid, updatedAt: Date.now(), ...state };
    writes = writes.then(async () => { const temp = join(WORK, 'state.' + process.pid + '.tmp'); await writeFile(temp, JSON.stringify(snapshot)); await rename(temp, join(WORK, 'state.json')); }).catch(() => {});
  };
  const server = createServer(socket => {
    socket.pause(); socket.on('error', () => {});
    void (async () => {
      const control = await readJson(join(WORK, 'control.json'));
      if (current || !validControl(control, config.profileName) || !control.streaming) { socket.destroy(); return; }
      lastControl = control; lastSeen = Date.now();
      const captureStartedAt = Date.now(), session = 'session-' + Math.max(captureStartedAt, ++nextSession);
      const context = { session, folder: resolve(HERE, '../work', session), streamSession: control.streamSession, streamStartedAt: control.streamStartedAt, captureStartedAt, ended: false };
      const job = { context, socket, capture: null, engine: null, settling: false, failed: false, abort: new AbortController() };
      current = job;
      status('capturing', 'OBS started. Matching the live video against your ID files.');
      try {
        job.capture = await startCapture({ socket, folder: context.folder, ffmpeg: join(ROOT, 'tools/audio-pilot/runtime/ffmpeg.exe'), streamStartedAt: context.streamStartedAt, captureStartedAt });
        job.engine = new AutomaticPublisher({ context, origin, uploadKey: secret.LIVE_UPLOAD_KEY, library: () => declaredLibrary(ROOT), lookup: ids => youtubeVideos(ids, { apiKey: key, channelId: config.channelId }), status });
        job.capture.completed.then(() => { context.ended = true; }, () => { context.ended = true; job.failed = true; status('warning', 'Audio capture stopped. Your normal YouTube stream is unaffected.'); });
        socket.resume();
      } catch { job.failed = true; context.ended = true; socket.destroy(); status('warning', 'Audio capture could not start. Your normal YouTube stream is unaffected.'); }
    })().catch(() => socket.destroy());
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(AUDIO_PORT, '127.0.0.1', ok); });
  const stop = () => { stopped = true; current?.capture?.stop(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  const monitor = setInterval(() => {
    void readJson(join(WORK, 'control.json')).then(control => {
      if (validControl(control, config.profileName)) { lastControl = control; lastSeen = Date.now(); }
      if (current && (Date.now() - current.context.captureStartedAt > 12 * 3600000 || !validControl(control, config.profileName) || !control.streaming || control.streamSession !== current.context.streamSession)) current.capture?.stop();
    }).catch(() => { if (Date.now() - lastSeen > 15000) current?.capture?.stop(); });
    if (Date.now() - lastSeen > 60000) stop();
    saveState();
  }, 2000);
  try {
    while (!stopped) {
      const job = current;
      if (job?.engine) {
        try { await job.engine.tick(job.abort.signal); }
        catch { status('waiting', 'Audio connection is being retried. Your YouTube stream continues normally.'); }
        if (job.context.ended || job.engine.retired) {
          job.capture?.stop();
          try {
            try { await job.capture?.completed; } catch { job.failed = true; }
            job.context.ended = true;
            await job.engine.close({ keepReplay: !job.failed });
            status(job.failed ? 'warning' : 'idle', job.failed ? 'Capture did not finish cleanly. Your YouTube stream is unaffected.' : 'Live audio is finished; Listen remains available as a replay.');
            current = null;
          } catch { status('finishing', 'Finishing replay upload; the connection is being retried.'); }
        }
      } else if (job?.failed) current = null;
      await new Promise(done => setTimeout(done, 1500));
    }
  } finally {
    clearInterval(monitor); server.close();
    if (current) {
      current.abort.abort(); current.capture?.stop();
      try { await current.capture?.completed; } catch {}
      try { await current.engine?.close({ keepReplay: !current.failed }); } catch {}
    }
    status('stopped', 'Automatic audio stopped.'); saveState(); await writes;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { process.exitCode = 1; });
