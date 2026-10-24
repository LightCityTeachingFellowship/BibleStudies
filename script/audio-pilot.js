(() => {
  'use strict';
  async function start() {
    if (!document.getElementById('audio-pilot-page')) return;
    const el = id => document.getElementById(id);
    const player = el('pilot-audio'), status = el('audio-status'), panel = el('audio-player-panel');
    const list = el('audio-recordings'), retry = el('audio-retry'), speed = el('audio-speed');
    let generation = 0, selection = 0, current = null, expiresAt = 0, lastSaved = 0;
    const stored = id => { try { return JSON.parse(localStorage.getItem('lc-audio-progress:' + id)) || {}; } catch { return {}; } };
    function save() {
      if (!current || !Number.isFinite(player.currentTime)) return;
      try { localStorage.setItem('lc-audio-progress:' + current.videoId, JSON.stringify({ seconds: player.currentTime, rate: player.playbackRate })); } catch {}
    }
    function position() {
      try {
        if (navigator.mediaSession && Number.isFinite(player.duration) && player.duration > 0)
          navigator.mediaSession.setPositionState({ duration: player.duration, playbackRate: player.playbackRate, position: Math.min(player.currentTime, player.duration) });
      } catch {}
    }
    function clear() {
      save(); ++selection; current = null; expiresAt = 0;
      player.pause(); player.removeAttribute('src'); player.load();
      list.replaceChildren(); panel.hidden = true; retry.hidden = true;
      el('audio-now-playing').textContent = 'Choose a teaching below';
      if (navigator.mediaSession) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; }
    }
    async function choose(recording, resume) {
      save(); const ticket = ++selection, access = generation;
      player.pause(); player.removeAttribute('src'); player.load(); current = recording; retry.hidden = true;
      status.textContent = 'Preparing your audio…';
      const progress = stored(recording.videoId);
      try {
        const result = await window.LightCityMembers.getAudio(recording.videoId);
        if (ticket !== selection || access !== generation) return;
        const url = new URL(result.url);
        if (url.protocol !== 'https:' || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(url.hostname) || result.videoId !== recording.videoId || !(result.expiresAt > Date.now())) throw Error('Invalid playback link');
        expiresAt = result.expiresAt;
        el('audio-now-playing').textContent = recording.title;
        for (const button of list.children) button.setAttribute('aria-pressed', String(button.dataset.videoId === recording.videoId));
        player.onloadedmetadata = () => {
          if (ticket !== selection) return;
          const seconds = resume ?? progress.seconds;
          if (Number.isFinite(seconds) && seconds > 0 && seconds < player.duration - 10) player.currentTime = seconds;
          const rate = Number(progress.rate || speed.value);
          player.playbackRate = [0.5, 0.75, 1, 1.25, 1.5, 2].includes(rate) ? rate : 1;
          speed.value = String(player.playbackRate); position();
        };
        player.src = url.href;
        if (navigator.mediaSession && window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: recording.title, artist: 'LightCity Teaching Fellowship' });
        status.textContent = 'Ready to listen. You can switch apps or lock your screen.';
        try { await player.play(); } catch { if (ticket === selection) status.textContent = 'Your audio is ready. Tap Play on the player to begin.'; }
      } catch {
        if (ticket !== selection || access !== generation) return;
        status.textContent = 'Audio could not be loaded. Check your connection, then retry. If this continues, the storage connection may need checking.';
        retry.hidden = false;
      }
    }
    async function refresh() {
      const access = ++generation;
      const approved = Array.isArray(window.LightCityMembers?.library);
      clear(); el('audio-signin').hidden = approved;
      status.textContent = 'Loading your audio library…';
      try {
        const result = await window.LightCityMembers.getAudio();
        if (access !== generation) return;
        if (!Array.isArray(result.recordings)) throw Error('Missing library');
        for (const recording of result.recordings) {
          const button = document.createElement('button'); button.type = 'button';
          button.className = 'lc-audio-recording'; button.dataset.videoId = recording.videoId;
          button.textContent = recording.title; button.setAttribute('aria-pressed', 'false');
          button.addEventListener('click', () => void choose(recording)); list.append(button);
        }
        panel.hidden = result.recordings.length === 0;
        status.textContent = result.recordings.length ? 'Choose a teaching to start listening.' : approved ? 'No audio recordings are available yet.' : 'Public audio recordings are being prepared. Members can sign in for additional recordings.';
      } catch { if (access === generation) status.textContent = 'The audio pilot is not connected yet. Please try again once setup is complete.'; }
    }
    retry.addEventListener('click', () => { if (current) void choose(current, player.currentTime || stored(current.videoId).seconds); });
    speed.addEventListener('change', () => { player.playbackRate = Number(speed.value); save(); position(); });
    player.addEventListener('timeupdate', () => { position(); if (Date.now() - lastSaved > 5000) { lastSaved = Date.now(); save(); } });
    player.addEventListener('pause', () => { save(); if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused'; });
    player.addEventListener('play', () => {
      if (current && expiresAt && expiresAt <= Date.now()) { const seconds = player.currentTime; player.pause(); void choose(current, seconds); return; }
      if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing'; position();
    });
    player.addEventListener('error', () => { if (current && player.getAttribute('src')) { status.textContent = 'Playback stopped. Check your connection and retry to resume.'; retry.hidden = false; } });
    window.addEventListener('pagehide', save);
    if (navigator.mediaSession) {
      const seek = seconds => { if (Number.isFinite(player.duration)) player.currentTime = Math.max(0, Math.min(player.duration, seconds)); position(); };
      const actions = { play: () => { void player.play().catch(() => {}); }, pause: () => player.pause(), seekbackward: event => seek(player.currentTime - (event.seekOffset || 15)), seekforward: event => seek(player.currentTime + (event.seekOffset || 15)), seekto: event => seek(event.seekTime) };
      for (const [name, handler] of Object.entries(actions)) try { navigator.mediaSession.setActionHandler(name, handler); } catch {}
    }
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    window.addEventListener('lightcity-members-changed', () => void refresh());
    await window.LightCityMembers?.ready;
    await refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void start()); else void start();
})();
