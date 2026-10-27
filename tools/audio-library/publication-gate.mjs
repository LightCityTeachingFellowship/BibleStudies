import { reconcileReplacements } from '../video-replacements.mjs';

// Work from the last published snapshot, so a pending replacement cannot remove
// the original or redirect its saved links before the matching recording exists.
export function audioReadyPublication(previous, desired, { recordings = [], live = [], declared = [], now = Date.now(), planned = false } = {}) {
  if (!Array.isArray(previous) || !previous.length) throw Error('A published library baseline is required before enabling audio-ready publishing.');
  const candidates = planned ? desired : reconcileReplacements(previous, desired, declared).videos;
  const before = new Map(previous.map(v => [v.id, v]));
  const ready = new Map(recordings.filter(r => /^[\w-]{11}$/.test(r.videoId || '') && r.objectKey === `audio/${r.videoId}.m4a`
    && Number.isSafeInteger(r.bytes) && r.bytes > 0 && /^[a-f\d]{64}$/.test(r.sha256 || '')
    && Number.isFinite(r.durationSeconds) && r.durationSeconds > 0).map(r => [r.videoId, r]));
  // Only the gateway's fresh, active audio feed exempts a new live broadcast.
  const liveIds = new Set(live.filter(r => r.active === true && !r.replay && r.expiresAt > now).map(r => r.videoId));
  const videos = [], pending = [], held = new Set();
  for (const video of candidates) {
    if (before.has(video.id) || ready.has(video.id) || liveIds.has(video.id)) {
      const record = ready.get(video.id) || live.find(r => r.videoId === video.id && r.active === true && r.expiresAt > now);
      videos.push({ ...video, ...(record && !video.title ? { title: record.title || null } : {}) });
      continue;
    }
    pending.push(video.id);
    for (const oldId of video.replaces || []) if (before.has(oldId) && !held.has(oldId)) {
      videos.push(before.get(oldId)); held.add(oldId);
    }
  }
  // Do not publish aliases pointing at a hidden replacement. Existing aliases on
  // a retained original continue to resolve to the currently available version.
  const ids = new Set(videos.map(v => v.id));
  if (ids.size !== videos.length) throw Error('Publication plan contains duplicate videos.');
  for (const v of videos) if ((v.replaces || []).some(id => ids.has(id))) throw Error('Publication alias points at an active video.');
  return { videos, pending };
}
