import {spawn} from 'node:child_process';
import {access, mkdir, open, readFile, unlink, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const readJson = async path => {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch { return null; }
};

function running(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}

export function createArchiveUpload({preferencesFile, selectProject, approveResume}) {
  let child = null;
  let starting = false;
  let launchFailed = false;

  async function project() {
    const settings = await readJson(preferencesFile);
    return typeof settings?.folder === 'string' ? settings.folder : null;
  }

  async function status(folder = null) {
    folder ||= await project();
    if (!folder) return {state: 'unconfigured'};
    const work = join(folder, 'tools/audio-library/work/message-archive');
    const [progress, activity, lock] = await Promise.all([
      readJson(join(work, 'status.json')),
      readJson(join(work, 'activity.json')),
      readFile(join(work, 'import.lock'), 'utf8').catch(() => null),
    ]);
    const active = running(Number(lock));
    const current = activity?.pid === Number(lock) && active;
    const total = progress?.total || 0;
    const completed = progress?.completed || 0;
    const state = starting || child || active ? 'running'
      : total && completed >= total ? 'complete'
      : lock !== null && !Number(lock) ? 'checking'
      : lock !== null ? 'stale-lock'
      : launchFailed || activity?.state === 'failed' ? 'failed'
      : 'paused';
    return {
      state, completed, total,
      currentTitle: current ? activity.title : null,
      lastTitle: progress?.lastTitle || null,
      failedTitle: state === 'failed' ? activity?.title : null,
      failure: state === 'failed' ? activity?.message : null,
    };
  }

  async function configure() {
    if (starting || child) return status();
    const folder = await selectProject();
    if (!folder) return status();
    await access(join(folder, 'tools/audio-archive/run.ps1'));
    await access(join(folder, 'tools/audio-library/work/automatic-recorded/config.private.json'));
    await writeFile(preferencesFile, JSON.stringify({folder}));
    launchFailed = false;
    return status(folder);
  }

  async function resume() {
    if (starting || child) return status();
    const folder = await project();
    if (!folder) return status();
    const current = await status(folder);
    if (starting || child || !['paused', 'failed', 'stale-lock'].includes(current.state)) return current;
    starting = true;
    let log;
    try {
      if (!await approveResume()) return current;
      const work = join(folder, 'tools/audio-library/work/message-archive');
      await mkdir(work, {recursive: true});
      if (current.state === 'stale-lock') {
        const lockPath = join(work, 'import.lock');
        const pid = Number(await readFile(lockPath, 'utf8'));
        if (!Number.isSafeInteger(pid) || pid <= 0 || running(pid)) return status(folder);
        await unlink(lockPath);
      }
      log = await open(join(work, 'studio-upload.log'), 'a');
      const powershell = join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
      const processHandle = spawn(powershell, [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', join(folder, 'tools/audio-archive/run.ps1'),
      ], {cwd: folder, windowsHide: true, detached: true, stdio: ['ignore', log.fd, log.fd]});
      child = processHandle;
      launchFailed = false;
      processHandle.once('error', () => { child = null; launchFailed = true; });
      processHandle.once('exit', code => { child = null; launchFailed = code !== 0; });
      processHandle.unref();
      return status(folder);
    } finally {
      starting = false;
      await log?.close();
    }
  }

  return {status, configure, resume};
}
