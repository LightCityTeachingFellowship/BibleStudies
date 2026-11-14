// The mode coordinator carries a content timestamp, never an audio/video stream.
export function createModeSwitch(adapter) {
  let mode = adapter.initialMode || 'video', position = Number.isFinite(adapter.initialPosition) && adapter.initialPosition >= 0 ? adapter.initialPosition : 0, playing = true;
  let version = 0, disposed = false, pending = null, loading = false;
  const validTime = value => Number.isFinite(value) && value >= 0;
  return {
    get mode() { return mode; },
    get position() { return position; },
    async switchTo(next) {
      if (disposed || !['audio', 'video'].includes(next)) return;
      const ticket = ++version;
      pending?.abort(); pending = new AbortController();
      const signal = pending.signal, stale = () => disposed || ticket !== version;
      try {
        const snapshot = loading ? { time: position, playing } : mode === 'audio' ? adapter.readAudio() : await adapter.readVideo(signal);
        if (stale()) return;
        if (validTime(snapshot?.time)) position = snapshot.time;
        if (typeof snapshot?.playing === 'boolean') playing = snapshot.playing;
        const rate = Number(snapshot?.rate) || adapter.getRate?.() || 1;
        loading = true;
        adapter.onState?.(mode, 'Preparing ' + next + '…');
        if (next === 'audio') await adapter.loadAudio(signal);
        else await adapter.loadVideo(signal);
        if (stale()) return;
        // Playback continues during preparation, so capture its latest position.
        loading = false;
        const current = mode === 'audio' ? adapter.readAudio() : await adapter.readVideo(signal);
        if (stale()) return;
        if (validTime(current?.time)) position = current.time;
        if (typeof current?.playing === 'boolean') playing = current.playing;
        const currentRate = Number(current?.rate) || rate;
        adapter.pauseAudio(); adapter.pauseVideo();
        mode = next; adapter.show(mode); loading = false;
        if (mode === 'audio') {
          adapter.seekAudio(position, currentRate);
          if (playing) await adapter.playAudio();
        } else {
          adapter.seekVideo(position, currentRate);
          if (playing) await adapter.playVideo();
          else adapter.pauseVideo();
        }
        if (!stale()) adapter.onState?.(mode, playing ? '' : 'Paused. Press Play to continue.');
      } catch (error) {
        if (stale() || signal.aborted) return;
        loading = false;
        adapter.onState?.(mode, error.name === 'NotAllowedError' ? 'Press Play to continue from the same position.' : 'Playback could not be prepared. Try the mode button again.');
      }
    },
    readPendingAudio() { return loading ? { time: position, playing } : null; },
    dispose() {
      if (disposed) return;
      disposed = true; ++version; pending?.abort();
      adapter.pauseAudio(); adapter.pauseVideo(); adapter.dispose?.();
    }
  };
}
