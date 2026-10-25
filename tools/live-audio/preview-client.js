(() => {
  const audio = document.querySelector('#audio'), select = document.querySelector('#session');
  const follow = document.querySelector('#follow'), status = document.querySelector('#status');
  let hls = null, selected = '', list = [], version = 0;
  function load(id) {
    const playing = !audio.paused;
    const ticket = ++version;
    hls?.destroy(); hls = null; audio.pause(); audio.removeAttribute('src'); audio.load();
    selected = id;
    if (!id) return;
    const source = '/streams/' + id + '/audio.m3u8';
    const ready = () => {
      if (ticket !== version) return;
      const recording = list.find(item => item.id === id);
      status.textContent = recording?.ended ? 'Recording ready. Press Play to listen.' : 'Live test feed ready. Press Play to listen.';
      if (playing) void audio.play().catch(() => { status.textContent = 'Press Play to continue with the new test feed.'; });
    };
    status.textContent = 'Loading audio…';
    if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = source; audio.addEventListener('loadedmetadata', ready, { once: true });
    } else if (window.Hls?.isSupported()) {
      hls = new window.Hls({ enableWorker: true, liveSyncDurationCount: 3, maxBufferLength: 30 });
      hls.on(window.Hls.Events.MANIFEST_PARSED, ready);
      hls.on(window.Hls.Events.ERROR, (_event, data) => {
        if (ticket === version && data.fatal) status.textContent = 'Audio was interrupted. Confirm the receiver is running, then choose Reload audio.';
      });
      hls.loadSource(source); hls.attachMedia(audio);
    } else status.textContent = 'The live audio player could not load. Check your internet connection for its playback library, or try another browser.';
  }
  async function refresh() {
    try {
      const response = await fetch('/sessions', { cache: 'no-store' });
      if (!response.ok) throw Error('Unavailable');
      list = await response.json();
      select.replaceChildren();
      if (!list.length) { const option = document.createElement('option'); option.textContent = 'Waiting for an audio segment…'; option.value = ''; select.append(option); if (!selected) status.textContent = 'Start the OBS receiver and test stream. The first segment takes a few seconds.'; return; }
      for (const item of list) { const option = document.createElement('option'); option.value = item.id; option.textContent = new Date(item.startedAt).toLocaleString() + (item.ended ? ' · recording' : ' · live test'); select.append(option); }
      const next = !selected || follow.checked ? list[0].id : selected;
      select.value = next;
      if (next !== selected) load(next);
      else if (audio.ended && list.find(item => item.id === next)?.ended) status.textContent = 'Test recording finished.';
    } catch { status.textContent = 'Cannot reach the local player. Keep its PowerShell terminal open.'; }
  }
  select.addEventListener('change', () => { follow.checked = false; load(select.value); });
  document.querySelector('#retry').addEventListener('click', () => load(selected));
  audio.addEventListener('playing', () => { status.textContent = list.find(item => item.id === selected)?.ended ? 'Playing the captured test audio.' : 'Playing the live OBS test feed.'; });
  audio.addEventListener('error', () => { if (selected) status.textContent = 'The browser could not play this test feed. Choose Reload audio to retry.'; });
  const timer = setInterval(() => void refresh(), 3000);
  addEventListener('pagehide', () => { clearInterval(timer); hls?.destroy(); audio.pause(); }, { once: true });
  void refresh();
})();
