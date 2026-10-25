// Local proof of the audio packaging stage. No YouTube forwarding, cloud upload,
// public listener, production configuration changes, or website activation.
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const RELAY_AUDIO_INPUT = 'tcp://127.0.0.1:19352?listen=1&listen_timeout=60000';
export function argumentsFor({ input, output, receive = false, localRelay = false }) {
  if (receive && input !== 'rtmp://127.0.0.1:19350/live/audio-test') throw Error('The pilot receiver must bind only to its fixed loopback address');
  if (localRelay && input !== RELAY_AUDIO_INPUT) throw Error('Relay audio must come from the fixed loopback feed');
  return ['-hide_banner', '-loglevel', 'warning', ...(localRelay ? [] : ['-nostdin']),
    ...(receive ? ['-listen', '1', '-timeout', '60'] : localRelay ? ['-thread_queue_size', '512', '-f', 'mpegts', '-probesize', '32768', '-analyzeduration', '500000'] : ['-re']), '-i', input,
    '-map', '0:a:0', '-vn', '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '48000',
    '-f', 'hls', '-hls_time', '4', '-hls_list_size', '0', '-hls_playlist_type', 'event',
    '-hls_flags', 'program_date_time+temp_file', '-hls_segment_filename', join(output, 'segment-%06d.ts'), join(output, 'audio.m3u8')];
}
export function inspectManifest(text) {
  if (!text.startsWith('#EXTM3U')) throw Error('Invalid HLS manifest');
  const lines = text.split(/\r?\n/);
  const segments = lines.filter(line => line && !line.startsWith('#'));
  if (segments.some(line => !/^segment-\d{6,}\.ts$/.test(line))) throw Error('Unexpected HLS segment path');
  const durations = lines.filter(line => line.startsWith('#EXTINF:')).map(line => Number(line.slice(8).split(',')[0]));
  const timestamps = lines.filter(line => line.startsWith('#EXT-X-PROGRAM-DATE-TIME:')).map(line => Date.parse(line.slice(25)));
  if (durations.length !== segments.length || durations.some(value => !Number.isFinite(value) || value <= 0)) throw Error('Invalid segment durations');
  if (timestamps.length !== segments.length || timestamps.some(value => !Number.isFinite(value))) throw Error('Missing segment clock timestamps');
  return { segments, durations, timestamps, durationSeconds: durations.reduce((a, b) => a + b, 0), ended: lines.includes('#EXT-X-ENDLIST') };
}
export async function startPilot({ input, output, receive = false, localRelay = false, ffmpeg = process.env.FFMPEG || join(ROOT, 'tools/audio-pilot/runtime/ffmpeg.exe') }) {
  if (!receive && !localRelay) { if (!(await stat(input)).isFile()) throw Error('Input must be a local recording'); }
  // mkdir without recursive on this leaf prevents reusing or mixing a session.
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output);
  await writeFile(join(output, 'session.json'), JSON.stringify({ stage: 'local packaging test only', startedAt: new Date().toISOString(), audioKbps: 128, segmentSeconds: 4, youtubeOffsetVerified: false }, null, 2));
  const child = spawn(ffmpeg, argumentsFor({ input, output, receive, localRelay }), { windowsHide: true, stdio: [localRelay ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
  child.stdin?.on('error', () => {});
  // Do not print FFmpeg's input diagnostics: production stream inputs could contain keys.
  child.stderr.resume();
  const completed = new Promise((accept, reject) => {
    child.on('error', () => reject(Error('Could not start FFmpeg; check the local executable')));
    child.on('close', async code => {
      try {
        if (code !== 0) throw Error(`Local audio packager stopped (${code}); check that the test input has audio and the receiver port is available`);
        const report = inspectManifest(await readFile(join(output, 'audio.m3u8'), 'utf8'));
        for (const segment of report.segments) if ((await stat(join(output, segment))).size <= 0) throw Error('Empty HLS segment');
        await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
        accept(report);
      } catch (error) { reject(error); }
    });
  });
  return { child, completed };
}
async function main() {
  const args = process.argv.slice(2), index = args.indexOf('--input');
  const receive = args.includes('--receive-test');
  if (!receive && index < 0) { console.log('Local file test: node tools/live-audio/pilot.mjs --input PATH\nSeparate OBS profile test: node tools/live-audio/pilot.mjs --receive-test\nSee tools/live-audio/README.md before changing any OBS settings.'); return; }
  const input = receive ? 'rtmp://127.0.0.1:19350/live/audio-test' : resolve(args[index + 1]);
  const output = join(ROOT, 'tools/live-audio/work', 'session-' + Date.now());
  const { completed } = await startPilot({ input, output, receive });
  console.log(receive ? 'Waiting for the separate OBS test profile on this computer. Stop Streaming in that test profile to finish.' : 'Preparing audio segments at normal playback speed…');
  const report = await completed;
  console.log(`Local test complete: ${report.segments.length} segments, ${report.durationSeconds.toFixed(1)} seconds. Files: ${output}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
