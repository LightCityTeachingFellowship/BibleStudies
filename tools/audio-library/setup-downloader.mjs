import { mkdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, save } from './import.mjs';

const folder = join(ROOT, 'tools/audio-library/work/downloader');
async function get(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'LightCity-audio-trial' }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Error('Official downloader download was not available.');
  return response;
}
try {
  const release = await (await get('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest')).json();
  const asset = release.assets?.find(a => a.name === 'yt-dlp');
  const sums = release.assets?.find(a => a.name === 'SHA2-256SUMS');
  const approved = url => typeof url === 'string' && url.startsWith('https://github.com/yt-dlp/yt-dlp/releases/download/');
  if (!approved(asset?.browser_download_url) || !approved(sums?.browser_download_url)) throw Error('Unexpected downloader release.');
  const text = await (await get(sums.browser_download_url)).text();
  const checksum = text.split(/\r?\n/).map(line => line.trim().split(/\s+/)).find(parts => parts[1]?.replace(/^\*/, '') === 'yt-dlp')?.[0];
  if (!/^[a-f\d]{64}$/i.test(checksum || '') || asset.size > 16 * 1024 * 1024) throw Error('Unexpected downloader checksum/size.');
  const bytes = Buffer.from(await (await get(asset.browser_download_url)).arrayBuffer());
  if (bytes.length !== asset.size || createHash('sha256').update(bytes).digest('hex') !== checksum) throw Error('Downloader checksum mismatch.');
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, 'yt-dlp.partial'), bytes);
  await rename(join(folder, 'yt-dlp.partial'), join(folder, 'yt-dlp'));
  await save(join(folder, 'release.json'), { version: release.tag_name, sha256: checksum, asset: 'yt-dlp', source: asset.browser_download_url });
  console.log(`Official downloader ${release.tag_name} installed in the ignored local work folder; SHA-256 verified. No global packages or startup tasks installed.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
