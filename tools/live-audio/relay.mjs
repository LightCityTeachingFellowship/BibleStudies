import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, RELAY_AUDIO_INPUT, startPilot } from './pilot.mjs';

export const OBS_TEST_INPUT = 'rtmp://127.0.0.1:19350/live/audio-test';
export const LOCAL_VIDEO_TEST_OUTPUT = 'rtmp://127.0.0.1:19351/live/relay-check';
const AUDIO_OUTPUT = 'tcp://127.0.0.1:19352';
export function youtubeDestination(key) {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(key)) throw Error('Enter the stream key for the separate unlisted YouTube test');
  return 'rtmps://a.rtmps.youtube.com:443/live2/' + key;
}
export function relayArguments({ destination, localTest = false }) {
  if (localTest ? destination !== LOCAL_VIDEO_TEST_OUTPUT : !/^rtmps:\/\/a\.rtmps\.youtube\.com:443\/live2\/[A-Za-z0-9_-]{10,200}$/.test(destination || '')) throw Error('Unsupported relay destination');
  return ['-hide_banner', '-loglevel', 'warning', '-nostdin', '-listen', '1', '-timeout', '60', '-i', OBS_TEST_INPUT,
    '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', '-f', 'tee', '-use_fifo', '1', '-fifo_options', 'queue_size=512:drop_pkts_on_overflow=1:attempt_recovery=0',
    // A separate FIFO thread keeps the audio side from back-pressuring video.
    // On overload it drops audio packets, and an audio-side failure is ignored.
    // TCP supplies a real EOF so the packager can finalize its HLS playlist.
    `[f=flv:onfail=abort:use_fifo=0]${destination}|[select=a:f=mpegts:onfail=ignore]${AUDIO_OUTPUT}`];
}
export async function startRelay({ destination, output, localTest = false, ffmpeg = process.env.FFMPEG || join(ROOT, 'tools/audio-pilot/runtime/ffmpeg.exe'), onAudioFailure = () => {} }) {
  const args = relayArguments({ destination, localTest });
  const audio = await startPilot({ input: RELAY_AUDIO_INPUT, output, localRelay: true, ffmpeg });
  let audioError = null, stopping = false;
  audio.completed.catch(error => { audioError = error; if (!stopping) onAudioFailure(); });
  const child = spawn(ffmpeg, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  // Do not forward FFmpeg output: it can include the private YouTube stream key.
  child.stderr.resume();
  const videoCompleted = new Promise(accept => {
    child.on('error', () => accept(-1));
    child.on('close', code => accept(code));
  });
  async function stopAudio() {
    stopping = true;
    const finished = await Promise.race([audio.completed.then(() => true, () => true), new Promise(accept => setTimeout(() => accept(false), 2000))]);
    if (finished) return audio.completed.catch(() => null);
    if (audio.child.exitCode === null) audio.child.stdin?.write('q\n');
    const timer = setTimeout(() => { if (audio.child.exitCode === null) audio.child.kill(); }, 8000);
    try { return await audio.completed; } catch { return null; } finally { clearTimeout(timer); }
  }
  const completed = (async () => {
    const videoCode = await videoCompleted;
    const audioReport = await stopAudio();
    // EOF from an OBS RTMP publisher may be reported as a read error after a
    // normal Stop Streaming. Do not label it successful without checking outputs.
    return { videoCode, audioReport, audioFailed: !!audioError && !audioReport };
  })();
  return { child, audio, completed, stopAudio };
}
async function main() {
  const localTest = process.argv.includes('--local-test');
  if (!localTest && !process.argv.includes('--youtube-test')) throw Error('Use --youtube-test through youtube-test.ps1 after creating an unlisted test broadcast');
  const destination = localTest ? LOCAL_VIDEO_TEST_OUTPUT : youtubeDestination(process.env.LC_YOUTUBE_TEST_KEY?.trim());
  const output = join(ROOT, 'tools/live-audio/work', 'session-' + Date.now());
  const relay = await startRelay({ destination, output, localTest, onAudioFailure: () => console.log('Audio packaging stopped. Video forwarding remains independent. Stop the test and report this message.') });
  console.log('Test relay waiting for OBS. Keep the LightCity Audio Test profile on its local stream destination.');
  console.log('Audio session: ' + output);
  console.log('Start Streaming in the OBS test profile, then check the separate unlisted YouTube test preview.');
  let interrupted = false;
  process.once('SIGINT', () => { interrupted = true; relay.child.kill(); void relay.stopAudio(); });
  const result = await relay.completed;
  console.log(result.audioReport ? `Audio session ended: ${result.audioReport.durationSeconds.toFixed(1)} seconds. YouTube forwarding process has stopped.` : 'The relay stopped without a completed audio playlist. Check the test stream key, OBS input, and YouTube preview.');
  if (result.videoCode !== 0 && !interrupted) { console.log('Video forwarding ended with a connection/read error. Check YouTube Stream Health before treating the test as passed.'); process.exitCode = 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Could not start the relay. Use the unlisted-test helper and check the local ports; do not paste stream keys into chat.'); process.exitCode = 1; });
