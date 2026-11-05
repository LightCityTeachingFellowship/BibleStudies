const panel = document.getElementById('admin-archive-upload');
const desktop = window.LightCityDesktop;

if (panel && desktop?.getArchiveUpload) {
  const status = panel.querySelector('[data-archive-status]');
  const progress = panel.querySelector('[data-archive-progress]');
  const detail = panel.querySelector('[data-archive-detail]');
  const configure = panel.querySelector('[data-archive-configure]');
  const resume = panel.querySelector('[data-archive-resume]');
  const library = panel.closest('[data-studio-view]');
  const content = document.getElementById('admin-content');
  const labels = {
    unconfigured: 'Choose the LightCity website project folder on this computer to connect the existing archive importer.',
    paused: 'Ready to resume. Studio checks existing uploads before continuing.',
    running: 'Checking and uploading older messages.',
    complete: 'Archive upload complete.',
    failed: 'The archive upload paused after an error.',
    'stale-lock': 'The previous upload stopped unexpectedly. You can retry it here.',
    checking: 'Checking whether an archive upload is starting.',
  };
  let busy = false;

  function render(result) {
    const count = result.total ? result.completed + ' of ' + result.total + ' recordings uploaded. ' : '';
    const message = count + labels[result.state];
    if (status.textContent !== message) status.textContent = message;
    progress.hidden = !result.total;
    if (result.total) {
      progress.max = result.total;
      progress.value = result.completed;
    }
    const context = result.currentTitle ? 'Processing ' + result.currentTitle + '.'
      : result.failedTitle ? 'Interrupted at ' + result.failedTitle + '.'
      : result.lastTitle ? 'Last verified recording: ' + result.lastTitle + '.' : '';
    detail.textContent = [context, result.failure].filter(Boolean).join(' ');
    detail.hidden = !detail.textContent;
    configure.hidden = result.state !== 'unconfigured';
    resume.hidden = !['paused', 'failed', 'stale-lock'].includes(result.state);
    resume.textContent = result.state === 'paused' ? 'Resume upload' : 'Retry upload';
  }

  async function update(method, error) {
    if (busy) return;
    busy = configure.disabled = resume.disabled = true;
    try { render(await desktop[method]()); }
    catch { status.textContent = error; }
    finally { busy = configure.disabled = resume.disabled = false; }
  }

  configure.addEventListener('click', () => update('configureArchiveUpload',
    'Choose the website project folder containing the configured archive importer.'));
  resume.addEventListener('click', () => update('resumeArchiveUpload',
    'Studio could not start the importer. Check that the project folder is available.'));
  const refresh = () => {
    if (!library.hidden && !content.hidden) {
      update('getArchiveUpload', 'Studio could not read the archive upload status.');
    }
  };
  new MutationObserver(refresh).observe(library, {attributeFilter: ['hidden']});
  new MutationObserver(refresh).observe(content, {attributeFilter: ['hidden']});
  setInterval(refresh, 4000);
  refresh();
}
