import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync('script/audio-links.js', 'utf8'), id = 'abcdefghijk';
class Node {
 constructor() { this.dataset = {}; this.children = []; this.events = {}; this.hidden = false; this.attributes = {}; }
 appendChild(child) { this.children.push(child); child.parent = this; }
 replaceChildren() { this.children = []; }
 setAttribute(key, value) { this.attributes[key] = value; }
 querySelector() { return null; }
 querySelectorAll() { return this.children.filter(child => child.dataset.mediaMode); }
 addEventListener(event, fn) { this.events[event] = fn; }
 contains(child) { return child === this || this.children.includes(child); }
 closest(selector) { if (selector.startsWith('button') && this.dataset.mediaMode) return this; if (selector === '.lc-video-actions' && this.className === 'lc-video-actions') return this; return this.parent?.closest(selector); }
 click() { this.parent.events.click({ target: this, preventDefault() {}, stopPropagation() {} }); }
}
async function scenario(allowed) {
 const holder = new Node(); holder.className = 'lc-video-actions';
 const viewport = new Node(); let restores = 0, plays = 0, mounts = 0;
 const checkpoint = { version: 1, videoId: id, seconds: 453.25, playing: false, rate: 1.25, session: null };
 vm.runInNewContext(source, {
  document: { readyState: 'complete', querySelector: () => null,
   getElementById: name => ({ 'watch-audio-choice': holder, 'watch-player': viewport })[name], createElement: () => new Node() },
  window: { addEventListener() {} }, location: { href: 'https://example.com/Watch/?v=' + id + '&mode=audio', search: '?v=' + id + '&mode=audio' },
  URL, URLSearchParams, queueMicrotask, setInterval: () => ({ unref() {} }), clearInterval() {}, MutationObserver: class { observe() {} },
  LightCityMembers: { ready: Promise.resolve(), getAudio: async () => ({ recordings: allowed ? [{ videoId: id }] : [] }) },
  LightCityMedia: { savedListening: () => checkpoint, mount: options => {
   mounts++; assert.equal(options.videoId, id);
   return { mode: 'audio', videoId: id, restoreListening: async value => { assert.equal(value.seconds, 453.25); restores++; }, audio: { play: async () => { plays++; } }, dispose() {}, switchTo: async () => { throw Error('Must restore through checkpoint'); } };
  } }
 });
 for (let i = 0; i < 20; i++) await Promise.resolve();
 assert.equal(mounts, allowed ? 1 : 0); assert.equal(restores, allowed ? 1 : 0);
 assert.equal(plays, 0, 'A paused checkpoint must not be overridden by the Listen URL');
}
await scenario(true); await scenario(false);
console.log('PASS: page reload restores the authorized player once, preserves pause intent, and never mounts an unavailable recording.');
