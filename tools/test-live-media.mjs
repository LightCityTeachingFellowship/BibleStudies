import assert from 'node:assert/strict';
const nativeTimeout = globalThis.setTimeout, nativeNow = performance.now.bind(performance), nativeDate = Date.now;
let clock = 0, dateShift = 0;
Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
Date.now = () => nativeDate() + dateShift;
globalThis.setTimeout = (callback, delay, ...args) => {
  if (delay > 30000) { const timer = nativeTimeout(callback, delay, ...args); timer.unref?.(); return timer; }
  return nativeTimeout(() => { clock += Math.min(delay, 100); callback(...args); }, 1);
};
class Node extends EventTarget {
  constructor(tag = 'div') { super(); this.tagName = tag; this.children = []; this.attributes = {}; this.hidden = false; this.isConnected = true; this.classes = new Set(); this.classList = { add: (...names) => names.forEach(name => this.classes.add(name)), remove: (...names) => names.forEach(name => this.classes.delete(name)), toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) }; }
  append(...items) { items.forEach(item => this.appendChild(item)); }
  appendChild(item) { item.remove(); item.parentNode = this; this.children.push(item); return item; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(item => item !== this); this.parentNode = null; }
  contains(item) { return this === item || this.children.some(child => child.contains(item)); }
  querySelector(tag) { for (const child of this.children) { if (child.tagName === tag) return child; const found = child.querySelector(tag); if (found) return found; } return null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] || null; }
  removeAttribute(name) { delete this.attributes[name]; }
}
const timeRanges = { length: 1, start: () => 0, end: () => 10000 };
class Audio extends Node {
  constructor() { super('audio'); this.paused = true; this.ended = false; this.playbackRate = 1; this.base = 0; this.anchor = clock; this.readyState = 0; this.duration = 10000; this.seeking = false; this.buffered = timeRanges; this.seekable = timeRanges; }
  get currentTime() { return this.base + (this.paused ? 0 : (clock - this.anchor) / 1000 * this.playbackRate); }
  set currentTime(value) { this.base = value; this.anchor = clock; }
  set src(value) { this.attributes.src = value; this.readyState = 4; }
  load() { if (!this.attributes.src) this.readyState = 0; }
  canPlayType() { return ''; }
  async play() { this.anchor = clock; this.paused = false; this.dispatchEvent(new Event('play')); }
  pause() { this.base = this.currentTime; this.paused = true; this.anchor = clock; this.dispatchEvent(new Event('pause')); }
}
const players = [], sources = [], hlsInstances = [];
class Player {
  constructor(frame, { events }) { this.frame = frame; this.events = events; this.state = 1; this.base = 120.5; this.anchor = clock; this.rate = 1; this.muted = false; players.push(this); queueMicrotask(() => events.onReady({ target: this })); }
  getIframe() { return this.frame; }
  getCurrentTime() { return this.base + (this.state === 1 ? (clock - this.anchor) / 1000 * this.rate : 0); }
  getPlayerState() { return this.state; }
  getDuration() { return 10000; }
  getPlaybackRate() { return this.rate; }
  getAvailablePlaybackRates() { return [1, 1.25, 1.5, 2]; }
  setPlaybackRate(value) { this.rate = value; }
  isMuted() { return this.muted; } mute() { this.muted = true; } unMute() { this.muted = false; }
  pauseVideo() { this.base = this.getCurrentTime(); this.anchor = clock; this.state = 2; }
  playVideo() { this.anchor = clock; this.state = 1; this.events.onStateChange({ target: this, data: 1 }); }
  seekTo(time) { this.base = time; this.anchor = clock; }
  loadVideoById({ startSeconds }) { this.base = startSeconds; this.anchor = clock; this.state = 1; }
  destroy() { this.destroyed = true; }
}
class Hls {
  static Events = { LEVEL_UPDATED: 'level', ERROR: 'error' }; static isSupported() { return true; }
  constructor(config) { this.events = {}; this.config = config; hlsInstances.push(this); }
  on(event, callback) { this.events[event] = callback; }
  loadSource(url) { sources.push(url); }
  attachMedia(audio) { this.audio = audio; audio.src = 'blob:synthetic-live'; audio.currentTime = 900; this.events.level?.(null, { details: { fragments: [{ start: 0, cc: 0 }], edge: 10000 } }); }
  startLoad(time) { if (time !== undefined) this.audio.currentTime = time; }
  stopLoad() {} destroy() { this.destroyed = true; }
}
globalThis.window = Object.assign(new EventTarget(), { YT: { Player }, Hls });
globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible', createElement: tag => tag === 'audio' ? new Audio() : new Node(tag) });
globalThis.location = { origin: 'https://lightcityfellowship.com' };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaSession: { setActionHandler() {}, setPositionState() {} } } });
globalThis.localStorage = { getItem() { return null; }, setItem() { throw Error('Live capability URLs must not be saved'); } };
const videoId = 'R42uVd9spDw', session = 'session-1792874042803'; let requests = 0, denied = false, release;
globalThis.LightCityMembers = { async getLiveAudio(id) {
  requests++; if (denied) throw Error('Access no longer available');
  if (release === 'pending') await new Promise(resolve => { release = resolve; });
  return { kind: 'live', videoId: id, session, offsetSeconds: 0, expiresAt: Date.now() + 3600000, url: `https://lightcity-live-audio-test.example.workers.dev/live/${session}/audio.m3u8?token=${Math.floor(Date.now() / 1000) + 3600}.${'a'.repeat(64)}` };
} };
try {
  const { mount } = await import('../script/media-switch.js');
  const make = () => { const viewport = new Node(); const frame = new Node('iframe'); viewport.appendChild(frame); const messages = []; const item = mount({ viewport, videoId, title: 'Live teaching', recording: { kind: 'live', session, offsetSeconds: 0 }, onState: (_mode, message) => messages.push(message) }); return { viewport, frame, item, messages }; };
  const { item, frame, viewport, messages } = make();
  for (let cycle = 0; cycle < 3; cycle++) {
    if (cycle) { clock += 11000; }
    const expected = players[0]?.getCurrentTime() || 120.5;
    await item.switchTo('audio');
    assert.equal(item.mode, 'audio'); assert.equal(frame.hidden, true); assert.ok(!item.audio.paused);
    assert.ok(item.audio.currentTime >= expected && item.audio.currentTime < expected + 2);
    clock += 17000; const returnAt = item.audio.currentTime;
    await item.switchTo('video');
    assert.equal(item.mode, 'video'); assert.equal(frame.hidden, false); assert.ok(item.audio.paused);
    assert.ok(players[0].getCurrentTime() >= returnAt && players[0].getCurrentTime() < returnAt + 2);
  }
  assert.equal(requests, 1, 'valid live links stay in memory across switches');
  assert.ok(messages.includes('Preparing playback…'));
  dateShift += 3600000; clock += 5000;
  await item.switchTo('audio'); assert.equal(requests, 2, 'expired links are reissued through the access gate');
  assert.equal(sources.length, 1, 'access renewal does not reattach or reload the HLS source'); assert.ok(!item.audio.paused);
  let refreshedUrl;
  hlsInstances[0].config.xhrSetup({ open: (_method, url) => { refreshedUrl = url; } }, sources[0].replace('audio.m3u8', 'segment-000001.ts'));
  assert.equal(new URL(refreshedUrl).searchParams.get('token').split('.')[0], String(Math.floor(Date.now() / 1000) + 3600));
  const beforeReturn = item.audio.currentTime, beforeRequests = requests;
  document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pageshow'));
  assert.equal(item.audio.currentTime, beforeReturn); assert.equal(requests, beforeRequests);
  assert.ok(!item.audio.paused, 'healthy audio is untouched when returning to the app');
  await item.switchTo('video'); denied = true; dateShift += 3600000;
  await item.switchTo('audio'); assert.equal(item.mode, 'video'); assert.equal(players[0].state, 1, 'denied renewal restores outgoing video');
  item.dispose(); assert.equal(item.audio.getAttribute('src'), null); assert.equal(viewport.querySelector('audio'), null); assert.equal(frame.hidden, false);
  denied = false; release = 'pending'; const pending = make(); const switching = pending.item.switchTo('audio');
  for (let i = 0; i < 20 && typeof release !== 'function'; i++) await Promise.resolve();
  assert.equal(typeof release, 'function'); pending.item.dispose(); release(); await switching;
  assert.equal(pending.item.audio.getAttribute('src'), null, 'disposed player discards late signed links');
  release = undefined;
  const directViewport = new Node();
  const direct = mount({ viewport: directViewport, videoId, title: 'Direct live Listen', recording: { kind: 'live', session, offsetSeconds: 0 } });
  await direct.switchTo('audio');
  assert.equal(direct.mode, 'audio'); assert.ok(direct.audio.currentTime >= 9988, 'Listen before Watch starts near the retained live edge');
  await direct.switchTo('video'); assert.equal(direct.mode, 'video');
  const directFrame = directViewport.querySelector('iframe'); assert.ok(directFrame);
  direct.dispose(); assert.equal(directViewport.querySelector('iframe'), null, 'a generated live iframe is removed on disposal');
  const paused = make(); const pausedPlayer = await globalThis.LightCityMedia.trackYouTube(paused.frame); pausedPlayer.pauseVideo();
  await paused.item.switchTo('audio'); assert.equal(paused.item.mode, 'audio'); assert.ok(paused.item.audio.paused, 'paused video remains paused after switching to audio');
  paused.item.audio.currentTime = 240;
  await paused.item.switchTo('video'); assert.equal(pausedPlayer.getCurrentTime(), 240); assert.equal(pausedPlayer.state, 2);
  paused.item.dispose();
  const recovery = make(); await recovery.item.switchTo('audio');
  const recoveryAt = recovery.item.audio.currentTime, beforeRecovery = requests;
  recovery.item.audio.paused = true;
  hlsInstances.at(-1).events[Hls.Events.ERROR](null, { fatal: true });
  for (let i = 0; i < 100 && (requests === beforeRecovery || recovery.item.audio.paused); i++) await new Promise(resolve => nativeTimeout(resolve, 5));
  assert.ok(requests > beforeRecovery, 'Fatal live errors automatically obtain fresh playback access');
  assert.equal(recovery.item.mode, 'audio'); assert.ok(!recovery.item.audio.paused);
  assert.ok(Math.abs(recovery.item.audio.currentTime - recoveryAt) < 2, 'Reconnect retains the content position');
  const replayAt = recovery.item.audio.currentTime, sourceCount = sources.length;
  recovery.item.updateRecording({ session, offsetSeconds: 0, replay: true });
  assert.ok(!recovery.item.audio.paused, 'becoming a replay does not pause current listening');
  assert.equal(recovery.item.audio.currentTime, replayAt); assert.equal(sources.length, sourceCount);
  assert.equal(recovery.item.audio.parentNode.getAttribute('aria-label'), 'Audio replay player');
  recovery.item.dispose();

  const replayViewport = new Node();
  const replayItem = mount({ viewport: replayViewport, videoId, title: 'Completed service', onState: (_mode, text) => messages.push(text), recording: { kind: 'live', session, offsetSeconds: 0, replay: true } });
  await replayItem.switchTo('audio');
  assert.equal(replayItem.mode, 'audio'); assert.ok(replayItem.audio.currentTime < 2, 'a new replay listener starts at the beginning, not the old live edge');
  assert.ok(!messages.at(-1), 'successful replay playback clears obsolete warnings and live alignment advice');
  replayItem.dispose();
  const boundary = make(); const boundaryPlayer = await globalThis.LightCityMedia.trackYouTube(boundary.frame);
  boundaryPlayer.pauseVideo(); boundaryPlayer.seekTo(0);
  // This is the measured Day 29 capture offset; the omitted fraction of a second is normal startup rounding.
  const savedLiveApi = globalThis.LightCityMembers.getLiveAudio;
  globalThis.LightCityMembers.getLiveAudio = async id => ({ ...await savedLiveApi(id), offsetSeconds: -0.468, replay: true });
  boundary.item.dispose();
  const boundaryReplay = mount({ viewport: boundary.viewport, videoId, title: 'Replay start', recording: { kind: 'live', session, offsetSeconds: -0.468, replay: true }, onState: (_mode, text) => messages.push(text) });
  await boundaryReplay.switchTo('audio');
  assert.equal(boundaryReplay.mode, 'audio', 'replay start with sub-second capture offset must work on the first switch');
  assert.equal(boundaryReplay.audio.currentTime, 0);
  assert.ok(!messages.at(-1)?.includes('not available'));
  boundaryReplay.dispose(); globalThis.LightCityMembers.getLiveAudio = savedLiveApi;

  console.log('PASS: production live mount, repeated progressing handoffs, direct Listen, paused switches, access-gated renewal, failure rollback, and disposal.');
} finally { globalThis.setTimeout = nativeTimeout; Date.now = nativeDate; Object.defineProperty(performance, 'now', { configurable: true, value: nativeNow }); }
