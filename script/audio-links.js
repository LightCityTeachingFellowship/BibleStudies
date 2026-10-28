(() => {
  async function start() {
    if(document.getElementById('audio-library-page'))return;
    const settings = document.querySelector('script[data-lightcity-audio-links]');
    const grid = document.getElementById('videotab-container');
    const hero = document.querySelector('.home-featured[data-video-id]');
    const watch = document.getElementById('watch-audio-choice');
    const home = document.getElementById('home-audio-choice');
    if (!grid && !hero && !watch) return;
    let recordedAvailable = new Map(), liveAvailable = new Map();
    let available = new Map(), version = 0, scheduled = false, audience = null, liveCheckedAt = 0;
    const mounted = new Map();
    let openAudio = new URLSearchParams(location.search).get('mode') === 'audio';
    let resume = globalThis.LightCityMedia?.savedListening?.();
    function feedback(holder, message) {
      let node = holder.querySelector('.lc-mode-feedback');
      if (!node && message) { node = document.createElement('p'); node.className = 'lc-mode-feedback'; node.setAttribute('role', 'status'); holder.appendChild(node); }
      if (node) { node.textContent = message; node.hidden = !message; }
    }
    function reset() {
      for (const controller of mounted.values()) controller.dispose(); mounted.clear();
      recordedAvailable = new Map(); liveAvailable = new Map(); available = new Map(); liveCheckedAt = 0; render();
    }
    function add(parent, text, mode) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'lc-mode-button'; button.textContent = text; button.dataset.mediaMode = mode; button.setAttribute('aria-pressed', String(mode === 'video')); parent.appendChild(button);
    }
    function actions(holder, id) {
      const valid = /^[\w-]{11}$/.test(id || '') && available.has(id);
      const watchOnly = holder !== home && holder !== watch && /^[\w-]{11}$/.test(id || '');
      const signature = (watchOnly ? id + ':' : '') + (holder === home ? 'home-links:' + id + ':' : '') + (valid ? id + ':' + (available.get(id).session || 'recorded') : '') + ':inline-1';
      if (holder.dataset.audioSignature === signature) return;
      holder.dataset.audioSignature = signature; holder.dataset.videoId = id || ''; holder.replaceChildren();
      holder.setAttribute('role', 'group'); holder.setAttribute('aria-label', 'Playback mode');
      if (holder === home && /^[\w-]{11}$/.test(id || '')) {
        const url = new URL(hero.dataset.watchUrl || (settings?.dataset.base || '/') + 'Watch/', location.href);
        url.searchParams.set('v', id); url.searchParams.delete('mode');
        const link = document.createElement('a'); link.className = 'lc-mode-button'; link.textContent = 'Watch'; link.href = url.href; holder.appendChild(link);
        if (valid) { const listen = document.createElement('a'); listen.className = 'lc-mode-button'; listen.textContent = 'Listen'; url.searchParams.set('mode', 'audio'); listen.href = url.href; holder.appendChild(listen); }
        holder.setAttribute('aria-label', 'Open recording');
      } else if (valid || watchOnly) {
        add(holder, 'Watch', 'video'); if (valid) add(holder, 'Listen', 'audio');
      }
      holder.hidden = holder === home ? !/^[\w-]{11}$/.test(id || '') : !(valid || watchOnly);
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
        if (!viewport) return;
        if (button.dataset.mediaMode === 'video' && !mounted.has(viewport)) {
          const preview = viewport.querySelector('lite-youtube');
          if (preview) { void preview.addIframe({ autoplay: true }).catch(() => feedback(holder, 'Tap Play on the video to begin.')); return; }
        }
        if (!recording) return;
        if (!globalThis.LightCityMedia) { feedback(holder, 'Playback controls are still loading. Please try again.'); return; }
        let controller = mounted.get(viewport);
        if (!controller) {
          controller = globalThis.LightCityMedia.mount({ viewport, videoId: id, recording, title: document.getElementById('watch-title')?.textContent || holder.closest('.video-box')?.getAttribute('video-title') || recording.title || 'LightCity recording', onState: (mode, message) => {
            holder.querySelectorAll('button[data-media-mode]').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.mediaMode === mode)));
            feedback(holder, message);liveBadge(viewport,id);
            if (holder === watch) {
              const help = document.getElementById('watch-help');
              if (help) help.textContent = mode === 'audio' ? 'Audio mode. You can switch apps or lock your screen while listening.' : 'If playback doesn’t start automatically, tap Play on the video.';
            }
          } });
          mounted.set(viewport, controller);
        }
        const checkpoint = button.dataset.mediaMode === 'audio' && resume?.videoId === id ? resume : null;
        resume = null;
        const startPlayback = button.dataset.startPlayback === 'true';
        const switching = checkpoint && controller.restoreListening ? controller.restoreListening(checkpoint) : controller.switchTo(button.dataset.mediaMode);
        void switching.then(async () => {
          if (startPlayback && !checkpoint && controller.mode === 'audio' && mounted.get(viewport) === controller) {
            try { await controller.audio.play(); } catch { feedback(holder, 'Tap Play on the audio player to begin listening.'); }
          }
        }).catch(() => feedback(holder, 'Playback could not start. Please try again.'));
      });
    }
    delegate(grid); delegate(watch);
    function liveBadge(viewport, id) {
      if (!viewport) return;
      const recording = available.get(id);
      const live = recording?.kind === 'live' && recording.replay !== true && recording.expiresAt > Date.now() && Date.now() - liveCheckedAt < 90000;
      let badge = viewport.querySelector('.lc-live-badge');
      if (!badge && live) {
        badge = document.createElement('span'); badge.className = 'lc-live-badge';
        badge.textContent = '\u25c9 LIVE'; badge.setAttribute('aria-label', 'Live now');
        viewport.appendChild(badge);
      }
      const playing=viewport.classList?.contains('lc-audio-mode')||!!viewport.querySelector('iframe')||viewport.querySelector('lite-youtube')?.classList?.contains('lyt-activated');
      if (badge) badge.hidden = !live || !!playing;
      globalThis.LightCityDurations?.set(viewport,recordedAvailable.get(id)?.durationSeconds,{live});
    }
    function render() {
      for (const [viewport, controller] of mounted) {
        const recording = available.get(controller.videoId);
        controller.updateRecording?.(recording);
        const changedLive = (recording?.kind === 'live' && !controller.liveSession) || (controller.liveSession && (controller.liveSession !== recording?.session || controller.liveOffset !== recording?.offsetSeconds));
        const changedFeatured = home && viewport === hero?.querySelector('.home-video-art') && controller.videoId !== hero.dataset.videoId;
        if (viewport.isConnected === false || !recording || changedLive || changedFeatured) { controller.dispose(); mounted.delete(viewport); }
      }
      if (grid) for (const card of grid.querySelectorAll('.video-box[data-video-id]')) {
        liveBadge(card.querySelector('.iframe-container'), card.dataset.videoId);
        let holder = card.querySelector('.lc-video-actions');
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
      if (resume && available.has(resume.videoId)) {
        let holder = watch && watch.dataset.videoId === resume.videoId ? watch : null;
        if (!holder && grid) holder = [...grid.querySelectorAll('.video-box[data-video-id]')].find(card => card.dataset.videoId === resume.videoId)?.querySelector('.lc-video-actions');
        const button = holder && [...holder.querySelectorAll('button[data-media-mode]')].find(button => button.dataset.mediaMode === 'audio');
        if (button) { openAudio = false; button.click(); }
      }
    }

    function schedule() { if (!scheduled) { scheduled = true; const update = () => { scheduled = false; render(); }; if (globalThis.requestAnimationFrame) requestAnimationFrame(update); else queueMicrotask(update); } }
    if (grid) new MutationObserver(schedule).observe(grid, { childList: true, subtree: true });
    if (hero) new MutationObserver(schedule).observe(hero, { attributes: true, attributeFilter: ['data-video-id', 'hidden'] });
    async function refresh() {
      const current = ++version;
      const member = globalThis.LightCityMembers;
      const nextAudience = member?.loading ? 'loading' : Array.isArray(member?.library) ? 'member:' + (member.user?.uid || '') : 'public';
      if (audience !== nextAudience || nextAudience === 'loading') reset();
      audience = nextAudience;
      try {
        await globalThis.LightCityMembers?.ready;
        if (current !== version) return;
        const merge = () => {
          available = new Map(recordedAvailable);
          for (const [id, item] of liveAvailable) {
            const listening = [...mounted.values()].some(controller => controller.videoId === id && controller.liveSession === item.session && controller.mode === 'audio');
            // New listeners use permanent audio when ready; an existing replay listener keeps the source and position.
            if (item.replay !== true || !available.has(id) || listening) available.set(id, item);
          }
          render();
        };
        const failed = error => {
          if (current === version && /permission-denied|unauthenticated|failed-precondition|user-disabled|user-token-expired/.test(error?.code || '')) { ++version; reset(); }
        };
        // Each result updates controls immediately; a slow request cannot hold up the other.
        await Promise.allSettled([
          globalThis.LightCityMembers.getAudio().then(result => {
            if (current !== version || !Array.isArray(result.recordings)) return;
            recordedAvailable = new Map(result.recordings.filter(item => /^[\w-]{11}$/.test(item.videoId)).map(item => [item.videoId, item])); merge();
          }).catch(failed),
          ((globalThis.LightCityLiveStatus?.getRecordings?.() || globalThis.LightCityMembers.getLiveAudio?.()) || Promise.resolve({ recordings: [] })).then(result => {
            if (current !== version || !Array.isArray(result.recordings)) return;
            liveCheckedAt = Date.now();
            liveAvailable = new Map(result.recordings.filter(item => item.kind === 'live' && /^[\w-]{11}$/.test(item.videoId) && /^session-\d{13}$/.test(item.session) && Number.isFinite(item.offsetSeconds)).map(item => [item.videoId, item])); merge();
          }).catch(failed)
        ]);
      } catch (error) {
        if (current === version && /permission-denied|unauthenticated|failed-precondition/.test(error?.code || '')) { ++version; reset(); }
      }
    }
    window.addEventListener('lightcity-durations-ready',schedule);
    window.addEventListener('lightcity-members-changed', () => void refresh());
    window.addEventListener('pagehide', event => { if (event.persisted) return; for (const controller of mounted.values()) controller.dispose(); mounted.clear(); });
    render();
    await refresh();
    const liveRefresh = setInterval(() => { if (document.visibilityState !== 'hidden') void refresh(); }, 45000);
    liveRefresh.unref?.();
    window.addEventListener('pagehide', event => { if (!event.persisted) clearInterval(liveRefresh); });
  }
  // Deferred scripts can run at "interactive" before the mode module's imports finish.
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', () => void start(), { once: true }); else void start();
})();
