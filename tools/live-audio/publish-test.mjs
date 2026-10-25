import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, issueToken, validSession, validSecret, parsePlaylist, workerOrigin } from './cloud/auth.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = ms => new Promise(accept => setTimeout(accept, ms));
export async function publishSnapshot({ folder, origin, uploadKey, receipts = {}, send = fetch }) {
  const session = basename(folder);
  if (!validSession(session) || !validSecret(uploadKey)) throw Error('Invalid session or upload setup');
  const manifest = await readFile(join(folder, 'audio.m3u8'));
  const parsed = parsePlaylist(manifest.toString('utf8'));
  async function put(file, bytes) {
    const hash = await sha256(bytes);
    if (receipts[file] === hash) return;
    const response = await send(`${origin}/upload/${session}/${file}`, { method: 'PUT', redirect: 'error', headers: { Authorization: 'Bearer ' + uploadKey, 'Content-Length': String(bytes.length), 'X-Content-SHA256': hash }, body: bytes, signal: AbortSignal.timeout(30000) });
    if (!response.ok) { await response.body?.cancel(); throw Error(`Upload failed (HTTP ${response.status})`); }
    const result = await response.json();
    if (result.sha256 !== hash || result.bytes !== bytes.length) throw Error('Remote upload verification failed');
    receipts[file] = hash;
  }
  // The playlist snapshot never references an uncompleted or unuploaded segment.
  for (const file of parsed.segments) {
    if (!receipts[file]) await put(file, await readFile(join(folder, file)));
  }
  await put('audio.m3u8', manifest);
  return { ended: parsed.ended, segments: parsed.segments.length, receipts };
}
async function main() {
  const args = process.argv.slice(2), option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
  if (!option('worker')) throw Error('Use --worker https://lightcity-live-audio-test.YOUR-SUBDOMAIN.workers.dev/ and --latest or --session PATH');
  const origin = workerOrigin(option('worker'));
  const work = join(HERE, 'work');
  let folder = option('session') ? resolve(option('session')) : null;
  if (!folder && args.includes('--latest')) {
    const names = (await readdir(work)).filter(validSession).sort((a, b) => Number(b.slice(8)) - Number(a.slice(8)));
    if (names.length) folder = join(work, names[0]);
  }
  if (!folder || !validSession(basename(folder)) || !(await stat(folder)).isDirectory()) throw Error('Choose an existing OBS test session with --latest or --session PATH');
  // Never print or send either key to a third-party host: only a validated workers.dev origin is accepted.
  const secrets = JSON.parse(await readFile(join(work, 'cloud-secrets.json'), 'utf8'));
  if (!validSecret(secrets.LIVE_UPLOAD_KEY) || !validSecret(secrets.LIVE_PLAYBACK_KEY)) throw Error('Run deploy-test.ps1 to prepare the private test gateway');
  const receiptsPath = join(folder, 'cloud-upload.json');
  let saved;
  try { saved = JSON.parse(await readFile(receiptsPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const receipts = saved?.origin === origin && saved.receipts && typeof saved.receipts === 'object' && !Array.isArray(saved.receipts) ? saved.receipts : {};
  const persist = async () => { const temp = receiptsPath + '.tmp'; await writeFile(temp, JSON.stringify({ origin, receipts }, null, 2)); const { rename } = await import('node:fs/promises'); await rename(temp, receiptsPath); };
  let shared = false, retrying = false;
  for (;;) {
    try {
      const result = await publishSnapshot({ folder, origin, uploadKey: secrets.LIVE_UPLOAD_KEY, receipts });
      await persist();
      if (!shared) {
        const token = await issueToken(basename(folder), secrets.LIVE_PLAYBACK_KEY, Math.floor(Date.now() / 1000) + 3600);
        console.log('Private phone test link (valid for one hour; do not paste it into chat):');
        console.log(`${origin}/#session=${basename(folder)}&token=${token}`);
        shared = true;
      }
      if (retrying) { console.log('Connection restored; audio upload resumed.'); retrying = false; }
      if (result.ended) { console.log(`Upload complete: ${result.segments} verified audio segments. Open the private link on your phone.`); return; }
      await sleep(1500);
    } catch (error) {
      await persist();
      if (!retrying) { console.log(error.code === 'ENOENT' ? 'Waiting for the first completed audio segment…' : /^Upload failed \(HTTP \d{3}\)$/.test(error.message) ? error.message + '; retrying. Check the gateway deployment.' : 'Upload interrupted; retrying. Check the connection and gateway deployment.'); retrying = true; }
      await sleep(5000);
    }
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Could not start the publisher. Check the worker URL, local secrets setup, and session path.'); process.exitCode = 1; });
