import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const publicId = 'R42uVd9spDw', memberId = '0xma1jqVwsg';
class Element {
  constructor() { this.dataset = {}; this.children = []; this.hidden = false; this.events = {}; this.attributes = {}; this.value = '1'; this.currentTime = 0; this.playbackRate = 1; }
  appendChild(child) { this.children = this.children.filter(item => item !== child); this.children.push(child); child.parentNode = this; }
  get lastElementChild() { return this.children.at(-1); }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  querySelector(selector) { if (selector === '.iframe-container' || selector === '.home-video-art') return this.viewport || null; return this.children.find(child => child.className === selector.slice(1)) || null; }
  querySelectorAll() { return this.children.filter(child => child.dataset.mediaMode); }
  contains(child) { return child === this || this.children.some(node => node.contains(child)); }
  closest(selector) { if ((selector.startsWith('button') && this.dataset.mediaMode) || this.className === selector.slice(1)) return this; return this.parentNode?.closest(selector) || null; }
  addEventListener(name, callback) { this.events[name] = callback; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name]; }
  removeAttribute(name) { delete this.attributes[name]; }
  pause() {}
  load() {}
  async play() { this.played = true; }
}
const card = id => Object.assign(new Element(), { className: 'video-box', dataset: { videoId: id }, viewport: new Element() });
const publicCard = card(publicId), memberCard = card(memberId), missingCard = card('aaaaaaaaaaa');
const cards = [publicCard, memberCard, missingCard], grid = new Element(); grid.querySelectorAll = () => cards; cards.forEach(card => grid.appendChild(card));
const home = new Element(), watch = new Element(), hero = card(publicId), events = new Map(), observers = [];
let mode = 'public', resolveLate;
const mountedPlayers = [];
const media = { mount: options => {
  const item = { videoId: options.videoId, viewport: options.viewport, mode: 'video', switchTo: async mode => { item.mode = mode; options.onState(mode, ''); }, dispose: () => { item.disposed = true; } };
  mountedPlayers.push(item); return item;
} };
const api = { library: null, ready: Promise.resolve(), getAudio: async () => mode === 'hold' ? new Promise(resolve => { resolveLate = resolve; }) : { recordings: (mode === 'member' ? [publicId, memberId] : [publicId]).map(videoId => ({ videoId })) } };
const source = readFileSync('script/audio-links.js', 'utf8');
let domReady, earlyReads = 0;
vm.runInNewContext(source, { document: { readyState: 'interactive', addEventListener: (name, fn) => { assert.equal(name, 'DOMContentLoaded'); domReady = fn; }, querySelector: () => null, getElementById: () => { earlyReads++; return null; } } });
assert.equal(earlyReads, 0, 'Interactive deferred scripts must wait for the media module imports');
domReady(); assert.ok(earlyReads > 0);
vm.runInNewContext(source, {
  document: { readyState: 'complete', querySelector: selector => selector.startsWith('script') ? { dataset: { base: '/BibleStudies/' } } : hero, getElementById: id => ({ 'videotab-container': grid, 'home-audio-choice': home, 'watch-audio-choice': watch })[id], createElement: () => new Element() },
  window: { addEventListener: (name, fn) => events.set(name, fn) }, LightCityMembers: api, LightCityMedia: media,
  location: { href: 'https://example.com/BibleStudies/Watch/?v=' + publicId, search: '?v=' + publicId },
  URL, URLSearchParams, Set, queueMicrotask, MutationObserver: class { constructor(fn) { observers.push(fn); } observe() {} }
});
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
await settle();
assert.deepEqual(publicCard.children[0].children.map(item => item.textContent), ['Watch', 'Listen']);
assert.equal(publicCard.children[0].children[1].dataset.mediaMode, 'audio');
assert.equal(publicCard.children[0].children[1].type, 'button');
assert.equal(memberCard.children.length, 0); assert.equal(missingCard.children.length, 0);
assert.equal(home.children[1].textContent, 'Listen'); assert.equal(watch.children[1].textContent, 'Listen');
let prevented = false;
grid.events.click({ target: publicCard.children[0].children[1], preventDefault: () => { prevented = true; }, stopPropagation() {} }); await settle();
assert.equal(prevented, true); assert.equal(mountedPlayers[0].viewport, publicCard.viewport);
assert.equal(mountedPlayers[0].mode, 'audio');
assert.equal(publicCard.children[0].children[1].attributes['aria-pressed'], 'true');
events.get('lightcity-members-changed')(); await settle();
assert.equal(mountedPlayers[0].disposed, undefined, 'Repeated unchanged audience events must not interrupt playback');
mode = 'member'; api.library = [{ id: memberId }]; events.get('lightcity-members-changed')(); await settle();
assert.equal(mountedPlayers[0].disposed, true);
assert.equal(memberCard.children[0].hidden, false);
mode = 'public'; api.library = null; events.get('lightcity-members-changed')();
assert.equal(memberCard.children[0].hidden, true, 'Private links disappear immediately on sign-out');
await settle();
mode = 'hold'; events.get('lightcity-members-changed')(); await settle();
mode = 'public'; events.get('lightcity-members-changed')(); await settle();
resolveLate({ recordings: [{ videoId: memberId }] }); await settle();
assert.equal(memberCard.children[0].hidden, true, 'A late member catalogue cannot restore private links');
const clone = card(publicId); cards.push(clone); observers[0](); await settle(); observers[0](); await settle();
assert.equal(clone.children.length, 1); assert.equal(clone.children[0].children.length, 2);
const title = new Element(); publicCard.appendChild(title); observers[0](); await settle();
assert.equal(publicCard.lastElementChild.className, 'lc-video-actions', 'Choices remain below late-loading titles');
console.log('PASS: Watch/Listen buttons switch the matching viewport without navigation, handle dynamic cards, hide unavailable/member audio, and reject stale responses.');

const playerSource = readFileSync('script/audio-pilot.js', 'utf8');
async function playerFixture(selected, available) {
  const nodes = new Map(), calls = [];
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  get('audio-watch').dataset.watchBase = '/Watch/';
  const memberApi = { library: null, ready: Promise.resolve(), getAudio: async id => {
    if (!id) return { recordings: available.map(videoId => ({ videoId, title: 'Teaching ' + videoId })) };
    calls.push(id); return { videoId: id, url: 'https://' + 'a'.repeat(32) + '.r2.cloudflarestorage.com/lightcity-audio/audio/' + id + '.m4a', expiresAt: Date.now() + 100000 };
  } };
  vm.runInNewContext(playerSource, { document: { readyState: 'complete', getElementById: get, createElement: () => new Element() }, window: { LightCityMembers: memberApi, addEventListener() {} }, location: { href: 'https://example.com/Listen/?v=' + selected }, navigator: {}, localStorage: { getItem() {}, setItem() {} }, URL, Date });
  await settle(); return { get, calls };
}
const selected = await playerFixture(publicId, [publicId]);
assert.deepEqual(selected.calls, [publicId]);
assert.equal(selected.get('audio-now-playing').textContent, 'Teaching ' + publicId);
assert.equal(selected.get('audio-watch').href, 'https://example.com/Watch/?v=' + publicId);
assert.equal(selected.get('pilot-audio').played, true);
const denied = await playerFixture(memberId, [publicId]);
assert.equal(denied.calls.length, 0);
assert.match(denied.get('audio-status').textContent, /not available in the public audio library/);
assert.equal(denied.get('audio-watch').hidden, true);
assert.match(readFileSync('Listen.html', 'utf8'), /permalink: \/Listen\//);
console.log('PASS: Listen deep links select only an accessible matching recording and offer the matching Watch link; inaccessible recordings never request playback.');
