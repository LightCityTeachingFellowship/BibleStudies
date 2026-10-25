import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishSnapshot } from './publish-test.mjs';
import { broadcast } from './cloud/broadcasts.mjs';
import { workerOrigin, validSession, validSecret } from './cloud/auth.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
export function videoId(value) {
  if (/^[\w-]{11}$/.test(value || '')) return value;
  const url = new URL(value);
  if (!['youtube.com', 'www.youtube.com', 'youtu.be'].includes(url.hostname) || url.protocol !== 'https:') throw Error('Use a YouTube watch/share link');
  const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/live\/([\w-]{11})$/)?.[1];
  if (!/^[\w-]{11}$/.test(id || '')) throw Error('Invalid YouTube link');
  return id;
}
export async function registerBroadcast({ origin, uploadKey, entry, send = fetch }) {
  const host = workerOrigin(origin), data = broadcast(entry);
  if (!validSecret(uploadKey)) throw Error('Upload configuration unavailable');
  const body = JSON.stringify(data);
  const response = await send(`${host}/upload/broadcasts/${data.videoId}.json`, { method: 'PUT', redirect: 'error', headers: { Authorization: 'Bearer ' + uploadKey, 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) }, body, signal: AbortSignal.timeout(15000) });
  if (!response.ok) { await response.body?.cancel(); throw Error('Broadcast registration failed (HTTP ' + response.status + ')'); }
}
async function main() {
  const args = process.argv.slice(2), option = name => { const i = args.indexOf('--' + name); return i < 0 ? undefined : args[i + 1]; };
  const origin = workerOrigin(option('worker') || 'https://lightcity-live-audio-test.lightcityteachingfellowship.workers.dev');
  const work = join(HERE, 'work');
  let folder = option('session') ? resolve(option('session')) : null;
  if (!folder && args.includes('--latest')) {
    const names = (await readdir(work)).filter(validSession).sort((a, b) => Number(b.slice(8)) - Number(a.slice(8)));
    if (names.length) folder = join(work, names[0]);
  }
  if (!folder || !validSession(basename(folder))) throw Error('Choose the current relay session with --latest or --session');
  const entry = broadcast({ videoId: videoId(option('video')), session: basename(folder), title: option('title'), visibility: option('visibility') || 'members', offsetSeconds: Number(option('offset') || 0), active: true, expiresAt: Date.now() + 12 * 3600000 });
  const secrets = JSON.parse(await readFile(join(work, 'cloud-secrets.json'), 'utf8'));
  if (!validSecret(secrets.LIVE_UPLOAD_KEY)) throw Error('Gateway upload setup unavailable');
  let registered = false, warned = false;
  const receipts = {};
  console.log(`Preparing ${entry.visibility === 'public' ? 'PUBLIC' : 'MEMBER'} live Listen: ${entry.title}`);
  console.log('This publishes only the selected session. Keep this window open while broadcasting.');
  for (;;) {
    if (Date.now() >= entry.expiresAt) { console.error('The twelve-hour registration window ended. Restart this publisher with the intended current session to continue.'); process.exitCode = 1; return; }
    try {
      const snapshot = await publishSnapshot({ folder, origin, uploadKey: secrets.LIVE_UPLOAD_KEY, receipts });
      if (!registered && snapshot.ended) { console.error('The selected audio session has ended. Start the relay and OBS first, then run this helper again.'); process.exitCode = 1; return; }
      if (!registered) { await registerBroadcast({ origin, uploadKey: secrets.LIVE_UPLOAD_KEY, entry }); registered = true; console.log('Live Listen registered. The site will discover it shortly once the integration is deployed.'); }
      if (snapshot.ended) { await registerBroadcast({ origin, uploadKey: secrets.LIVE_UPLOAD_KEY, entry: { ...entry, active: false } }); console.log('Broadcast ended; live Listen registration closed.'); return; }
      if (warned) console.log('Live audio upload resumed.'); warned = false;
    } catch {
      if (!warned) console.log('Waiting for audio or the gateway. Check the connection and deployment; retrying.'); warned = true;
    }
    await new Promise(resolve => setTimeout(resolve, warned ? 5000 : 1500));
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Could not start site publishing. Check the selected session, video link, title, audience, and local gateway setup.'); process.exitCode = 1; });
