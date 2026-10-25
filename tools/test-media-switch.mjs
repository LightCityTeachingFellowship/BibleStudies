import assert from 'node:assert/strict';
class Node extends EventTarget {
  constructor(tag = 'div') { super(); this.tagName = tag; this.children = []; this.attributes = {}; this.hidden = false; this.isConnected = true; this.classes = new Set(); this.classList = { add: (...items) => items.forEach(item => this.classes.add(item)), remove: (...items) => items.forEach(item => this.classes.delete(item)), toggle: (item, on) => on ? this.classes.add(item) : this.classes.delete(item) }; }
  appendChild(child) { child.remove(); this.children.push(child); child.parentNode = this; return child; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] || null; }
  removeAttribute(key) { delete this.attributes[key]; }
  contains(child) { return this === child || this.children.some(node => node.contains(child)); }
  querySelector(tag) { for (const child of this.children) { if (child.tagName === tag) return child; const found = child.querySelector(tag); if (found) return found; } return null; }
}
class Audio extends Node {
  constructor() { super('audio'); this.currentTime = 0; this.duration = 3600; this.readyState = 0; this.playbackRate = 1; this.paused = true; this.error = null; }
  set src(value) { this.attributes.src = value; this.readyState = 1; this.error = null; }
  load() { if (!this.attributes.src) this.readyState = 0; }
  async play() { this.paused = false; this.dispatchEvent(new Event('play')); }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
}
const players = [], calls = [], store = new Map();
class Player {
  constructor(frame, { events }) { this.frame = frame; this.time = 137.75; this.rate = 1.25; this.state = 1; this.events = events; players.push(this); queueMicrotask(() => events.onReady({ target: this })); }
  getIframe() { return this.frame; }
  getCurrentTime() { return this.time; }
  getPlayerState() { return this.state; }
  getPlaybackRate() { return this.rate; }
  getAvailablePlaybackRates() { return [0.5, 0.75, 1, 1.25, 1.5, 2]; }
  setPlaybackRate(rate) { this.rate = rate; }
  seekTo(time) { this.time = time; calls.push('video-seek:' + time); }
  pauseVideo() { this.state = 2; calls.push('video-pause'); }
  playVideo() { this.state = 1; calls.push('video-play'); this.events.onStateChange?.({ target: this, data: 1 }); }
  destroy() { this.destroyed = true; }
}
const handlers = new Map(), positions = [];
globalThis.MediaMetadata = class { constructor(data) { Object.assign(this, data); } };
globalThis.window = { YT: { Player }, MediaMetadata };
globalThis.document = { createElement: tag => tag === 'audio' ? new Audio() : new Node(tag) };
Object.defineProperty(globalThis, 'navigator', { value: { mediaSession: { setActionHandler: (name, callback) => handlers.set(name, callback), setPositionState: value => positions.push(value) } }, configurable: true });
globalThis.location = { origin: 'https://example.com' };
globalThis.localStorage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) };
let requests = 0;
globalThis.LightCityMembers = { getAudio: async videoId => { requests++; return { videoId, url: 'https://' + 'a'.repeat(32) + '.r2.cloudflarestorage.com/lightcity-audio/audio/' + videoId + '.m4a', expiresAt: Date.now() + 3600000 }; } };
const { mount } = await import('../script/media-switch.js');
const viewport = new Node(), iframe = new Node('iframe'); viewport.appendChild(iframe);
const item = mount({ viewport, videoId: 'R42uVd9spDw', title: 'Public teaching' });
await item.switchTo('audio');
assert.equal(item.audio.currentTime, 137.75); assert.equal(item.audio.playbackRate, 1.25);
assert.equal(players[0].state, 2); assert.equal(iframe.hidden, true); assert.equal(item.audio.paused, false);
assert.equal(requests, 1);
assert.equal(navigator.mediaSession.metadata.title, 'Public teaching');
assert.equal(navigator.mediaSession.playbackState, 'playing');
assert.deepEqual([...handlers.keys()].sort(), ['pause', 'play', 'seekbackward', 'seekforward', 'seekto']);
handlers.get('seekforward')({ seekOffset: 15 }); assert.equal(item.audio.currentTime, 152.75);
item.audio.dispatchEvent(new Event('timeupdate')); assert.equal(positions.at(-1).position, 152.75);
item.audio.currentTime = 243.125;
await item.switchTo('video');
assert.equal(players[0].time, 243.125); assert.equal(players[0].state, 1); assert.equal(iframe.hidden, false); assert.equal(item.audio.paused, true);
assert.equal(navigator.mediaSession.metadata, null, 'Switching to video releases the audio lock-screen session');
players[0].time = 400.5;
await item.switchTo('audio');
assert.equal(item.audio.currentTime, 400.5); assert.equal(requests, 1, 'Valid links are reused in memory, not requested per switch');
item.dispose(); assert.equal(item.audio.paused, true); assert.equal(item.audio.getAttribute('src'), null); assert.equal(iframe.hidden, false);
assert.ok([...store.values()].every(value => !value.includes('https:')));

const standalone = new Node(), external = new Audio(); standalone.appendChild(external); external.src = 'existing-audio'; external.currentTime = 580.25; await external.play();
const libraryItem = mount({ viewport: standalone, videoId: 'R42uVd9spDw', title: 'Library teaching', audio: external, expiresAt: Date.now() + 3600000 });
await libraryItem.switchTo('video');
assert.equal(players[1].time, 580.25); assert.equal(external.paused, true);
players[1].time = 620.75;
await libraryItem.switchTo('audio'); assert.equal(external.currentTime, 620.75); assert.equal(external.paused, false);
libraryItem.dispose(); assert.equal(external.parentNode, standalone); assert.equal(standalone.querySelector('iframe'), null);
console.log('PASS: integrated YouTube/HTML-audio controller transfers fractional positions and rates, pauses hidden media, reuses signed links safely, and supports the standalone library without navigation.');
let releaseLink;
globalThis.LightCityMembers.getAudio = () => new Promise(resolve => { releaseLink = resolve; });
const pendingViewport = new Node();
const pendingItem = mount({ viewport: pendingViewport, videoId: '0xma1jqVwsg', title: 'Private teaching' });
const pendingSwitch = pendingItem.switchTo('audio');
for (let i = 0; i < 10; i++) await Promise.resolve();
pendingItem.dispose();
releaseLink({ videoId: '0xma1jqVwsg', url: 'https://' + 'a'.repeat(32) + '.r2.cloudflarestorage.com/lightcity-audio/audio/0xma1jqVwsg.m4a', expiresAt: Date.now() + 3600000 });
await pendingSwitch;
assert.equal(pendingItem.audio.getAttribute('src'), null); assert.equal(pendingItem.audio.paused, true);
console.log('PASS: disposing an inline member player while its access request is pending discards the late signed link.');

globalThis.LightCityMembers.getAudio = async videoId => { requests++; return { videoId, url: 'https://' + 'a'.repeat(32) + '.r2.cloudflarestorage.com/lightcity-audio/audio/' + videoId + '.m4a', expiresAt: Date.now() + 3600000 }; };
const reconnectViewport = new Node(); reconnectViewport.appendChild(new Node('iframe'));
const reconnect = mount({ viewport: reconnectViewport, videoId: 'R42uVd9spDw', title: 'Reconnect fixture' });
await reconnect.switchTo('audio'); reconnect.audio.currentTime = 222.25;
const beforeReconnect = requests; reconnect.audio.error = { code: 2 }; reconnect.audio.paused = true;
reconnect.audio.dispatchEvent(new Event('error'));
await new Promise(resolve => setTimeout(resolve, 2200));
assert.ok(requests > beforeReconnect); assert.equal(reconnect.audio.currentTime, 222.25); assert.ok(!reconnect.audio.paused);
reconnect.dispose();
console.log('PASS: interrupted recorded audio renews its link and resumes from the same position.');
