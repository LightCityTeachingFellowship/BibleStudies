(() => {
  async function start() {
    const settings = document.querySelector('script[data-lightcity-audio-links]');
    const grid = document.getElementById('videotab-container');
    const hero = document.querySelector('.home-featured[data-video-id]');
    const watch = document.getElementById('watch-audio-choice');
    const home = document.getElementById('home-audio-choice');
    if (!grid && !hero && !watch) return;
    let available = new Map(), version = 0, scheduled = false, audience = null, liveCheckedAt = 0;
    const mounted = new Map();
    let openAudio = new URLSearchParams(location.search).get('mode') === 'audio';
    function feedback(holder, message) {
      let node = holder.querySelector('.lc-mode-feedback');
      if (!node && message) { node = document.createElement('p'); node.className = 'lc-mode-feedback'; node.setAttribute('role', 'status'); holder.appendChild(node); }
      if (node) { node.textContent = message; node.hidden = !message; }
    }
    function reset() {
      for (const controller of mounted.values()) controller.dispose(); mounted.clear();
      available = new Map(); liveCheckedAt = 0; render();
    }
    function add(parent, text, mode) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'lc-mode-button'; button.textContent = text; button.dataset.mediaMode = mode; button.setAttribute('aria-pressed', String(mode === 'video')); parent.appendChild(button);
    }
    function actions(holder, id) {
      const valid = /^[\w-]{11}$/.test(id || '') && available.has(id);
      const signature = (holder === home ? 'home-links:' + id + ':' : '') + (valid ? id + ':' + (available.get(id).session || 'recorded') : '') + ':inline-1';
      if (holder.dataset.audioSignature === signature) return;
      holder.dataset.audioSignature = signature; holder.dataset.videoId = id || ''; holder.replaceChildren();
      holder.setAttribute('role', 'group'); holder.setAttribute('aria-label', 'Playback mode');
      if (holder === home && /^[\w-]{11}$/.test(id || '')) {
        const url = new URL(hero.dataset.watchUrl || (settings?.dataset.base || '/') + 'Watch/', location.href);
        url.searchParams.set('v', id); url.searchParams.delete('mode');
        const link = document.createElement('a'); link.className = 'lc-mode-button'; link.textContent = 'Watch'; link.href = url.href; holder.appendChild(link);
        if (valid) { const listen = document.createElement('a'); listen.className = 'lc-mode-button'; listen.textContent = 'Listen'; url.searchParams.set('mode', 'audio'); listen.href = url.href; holder.appendChild(listen); }
        holder.setAttribute('aria-label', 'Open teaching');
      } else if (valid) {
        add(holder, 'Watch', 'video'); add(holder, 'Listen', 'audio');
      }
      holder.hidden = holder === home ? !/^[\w-]{11}$/.test(id || '') : !valid;
    }
    function viewportFor(holder) {
      if (holder === home) return hero.querySelector('.home-video-art');
      if (holder === watch) return document.getElementById('watch-player');
      return holder.closest('.video-box')?.querySelector('.iframe-container');
    }
    function delegate(root) {
      if (!root) return;
      root.addEventListener('click', event => {
        const button = event.target.closest?.('button[data-media-mode]');
        if (!button || !root.contains(button)) return;
        event.preventDefault(); event.stopPropagation();
        const holder = button.closest('.lc-video-actions'), id = holder?.dataset.videoId;
        const recording = available.get(id), viewport = holder && viewportFor(holder);
        if (!recording || !viewport) return;
        if (!globalThis.LightCityMedia) { feedback(holder, 'Playback controls are still loading. Please try again.'); return; }
        let controller = mounted.get(viewport);
        if (!controller) {
          controller = globalThis.LightCityMedia.mount({ viewport, videoId: id, recording, title: recording.title || 'LightCity teaching', onState: (mode, message) => {
            holder.querySelectorAll('button[data-media-mode]').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.mediaMode === mode)));
            feedback(holder, message);
            if (holder === watch) {
              const help = document.getElementById('watch-help');
              if (help) help.textContent = mode === 'audio' ? 'Audio mode. You can switch apps or lock your screen while listening.' : 'If playback doesn’t start automatically, tap Play on the video.';
            }
          } });
          mounted.set(viewport, controller);
        }
        const startPlayback = button.dataset.startPlayback === 'true';
        void controller.switchTo(button.dataset.mediaMode).then(async () => {
          if (startPlayback && controller.mode === 'audio' && mounted.get(viewport) === controller) {
            try { await controller.audio.play(); } catch { feedback(holder, 'Tap Play on the audio player to begin listening.'); }
          }
        }).catch(() => feedback(holder, 'Playback could not start. Please try again.'));
      });
    }
    delegate(grid); delegate(watch);
    function liveBadge(viewport, id) {
      if (!viewport) return;
      const recording = available.get(id);
      const live = recording?.kind === 'live' && recording.expiresAt > Date.now() && Date.now() - liveCheckedAt < 90000;
      let badge = viewport.querySelector('.lc-live-badge');
      if (!badge && live) {
        badge = document.createElement('span'); badge.className = 'lc-live-badge';
        badge.textContent = '\u25c9 LIVE'; badge.setAttribute('aria-label', 'Live now');
        viewport.appendChild(badge);
      }
      if (badge) badge.hidden = !live;
    }
    function render() {
      for (const [viewport, controller] of mounted) {
        const recording = available.get(controller.videoId);
        const changedLive = (recording?.kind === 'live' && !controller.liveSession) || (controller.liveSession && (controller.liveSession !== recording?.session || controller.liveOffset !== recording?.offsetSeconds));
        const changedFeatured = home && viewport === hero?.querySelector('.home-video-art') && controller.videoId !== hero.dataset.videoId;
        if (viewport.isConnected === false || !recording || changedLive || changedFeatured) { controller.dispose(); mounted.delete(viewport); }
      }
      if (grid) for (const card of grid.querySelectorAll('.video-box[data-video-id]')) {
        liveBadge(card.querySelector('.iframe-container'), card.dataset.videoId);
        let holder = card.querySelector('.lc-video-actions');
        if (!holder && !available.has(card.dataset.videoId)) continue;
        if (!holder) { holder = document.createElement('div'); holder.className = 'lc-video-actions'; card.appendChild(holder); }
        actions(holder, card.dataset.videoId);
        // Video titles arrive asynchronously; keep the choices below the title.
        if (card.lastElementChild !== holder) card.appendChild(holder);
      }
      if (hero) liveBadge(hero.querySelector('.home-video-art'), hero.hidden ? '' : hero.dataset.videoId);
      if (home && hero) actions(home, hero.hidden ? '' : hero.dataset.videoId);
      if (watch) {
        actions(watch, new URLSearchParams(location.search).get('v'));
        if (openAudio && !watch.hidden) {
          openAudio = false;
          watch.querySelectorAll('button[data-media-mode]').forEach(button => { if (button.dataset.mediaMode === 'audio') { button.dataset.startPlayback = 'true'; button.click(); delete button.dataset.startPlayback; } });
        }
      }
    }
    function schedule() { if (!scheduled) { scheduled = true; queueMicrotask(() => { scheduled = false; render(); }); } }
    if (grid) new MutationObserver(schedule).observe(grid, { childList: true, subtree: true });
    if (hero) new MutationObserver(schedule).observe(hero, { attributes: true, attributeFilter: ['data-video-id', 'hidden'] });
    async function refresh() {
      const current = ++version;
      const member = globalThis.LightCityMembers;
      const nextAudience = member?.loading ? 'loading' : Array.isArray(member?.library) ? 'member:' + (member.user?.uid || '') + ':' + member.library.map(item => item.id).join(',') : 'public';
      if (audience !== nextAudience || nextAudience === 'loading') reset();
      audience = nextAudience;
      try {
        await globalThis.LightCityMembers?.ready;
        if (current !== version) return;
        let receivedLive = false;
        const [result, live] = await Promise.all([
          globalThis.LightCityMembers.getAudio(),
          globalThis.LightCityMembers.getLiveAudio?.().then(result => { receivedLive = true; return result; }).catch(error => ({ recordings: /permission-denied|unauthenticated|failed-precondition/.test(error?.code || '') ? [] : [...available.values()].filter(item => item.kind === 'live' && item.expiresAt > Date.now()) })) || Promise.resolve({ recordings: [] })
        ]);
        if (current !== version) return;
        if (!Array.isArray(result.recordings)) throw Error('Audio catalogue unavailable');
        if (receivedLive) liveCheckedAt = Date.now();
        available = new Map(result.recordings.filter(item => /^[\w-]{11}$/.test(item.videoId)).map(item => [item.videoId, item]));
        for (const item of live.recordings || []) if (item.kind === 'live' && /^[\w-]{11}$/.test(item.videoId) && /^session-\d{13}$/.test(item.session) && Number.isFinite(item.offsetSeconds)) available.set(item.videoId, item);
        render();
      } catch { if (current === version) reset(); }
    }
    window.addEventListener('lightcity-members-changed', () => void refresh());
    window.addEventListener('pagehide', () => { for (const controller of mounted.values()) controller.dispose(); mounted.clear(); });
    await refresh();
    const liveRefresh = setInterval(() => { if (document.visibilityState !== 'hidden') void refresh(); }, 45000);
    liveRefresh.unref?.();
    window.addEventListener('pagehide', () => clearInterval(liveRefresh), { once: true });
  }
  // Deferred scripts can run at "interactive" before the mode module's imports finish.
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', () => void start(), { once: true }); else void start();
})();
