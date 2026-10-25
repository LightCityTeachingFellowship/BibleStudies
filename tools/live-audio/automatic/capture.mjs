import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { inspectManifest } from '../pilot.mjs';
export function captureArguments(folder) {
  return ['-hide_banner', '-loglevel', 'error', '-nostdin', '-fflags', '+genpts', '-f', 'aac', '-i', 'pipe:0', '-map', '0:a:0', '-vn', '-c:a', 'copy', '-f', 'hls', '-hls_time', '4', '-hls_list_size', '0', '-hls_playlist_type', 'event', '-hls_flags', 'program_date_time+temp_file', '-hls_segment_filename', join(folder, 'segment-%06d.ts'), join(folder, 'audio.m3u8')];
}
export async function startCapture({ socket, folder, ffmpeg, streamStartedAt, captureStartedAt }) {
  await mkdir(dirname(folder), { recursive: true }); await mkdir(folder);
  await writeFile(join(folder, 'session.json'), JSON.stringify({ source: 'normal-obs-audio-side-output', audioKbps: 128, streamStartedAt, captureStartedAt, timing: 'approximate', startedAt: new Date(captureStartedAt).toISOString() }));
  const child = spawn(ffmpeg, captureArguments(folder), { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  child.stderr.resume(); child.stdin.on('error', () => socket.destroy()); socket.on('error', () => child.stdin.end()); socket.pipe(child.stdin);
  const completed = new Promise((resolve, reject) => {
    child.once('error', () => { socket.destroy(); reject(Error('The local audio packager could not start')); });
    child.once('close', async code => {
      socket.destroy();
      try {
        if (code !== 0) throw Error();
        const report = inspectManifest(await readFile(join(folder, 'audio.m3u8'), 'utf8'));
        if (!report.ended || !report.segments.length) throw Error();
        await writeFile(join(folder, 'report.json'), JSON.stringify(report)); resolve(report);
      } catch { reject(Error('Audio capture did not finalize cleanly')); }
    });
  });
  return { child, completed, stop: () => { socket.destroy(); child.stdin.end(); } };
}
