import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const child = spawn(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'helper.mjs')], { windowsHide: true, detached: true, stdio: 'ignore' });
child.on('error', () => {});
child.unref();
