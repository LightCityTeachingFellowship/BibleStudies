import { previewServer } from './preview.mjs';
const index = process.argv.indexOf('--video'), video = index >= 0 ? process.argv[index + 1] : '';
if (!/^[\w-]{11}$/.test(video)) { console.error('Use --video followed by the current test video ID'); process.exitCode = 1; }
else {
  const server = previewServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'The timing server is already running on port 4021. Open its page or stop the old timing-server terminal before restarting.' : 'Could not start the timing server.'); process.exitCode = 1; });
  server.listen(4021, '127.0.0.1', () => console.log(`Live timing test: http://127.0.0.1:4021/timing?video=${video}\nKeep this terminal open alongside the relay. Use headphones.`));
}
