import assert from 'node:assert/strict';
const store = new Map();
globalThis.sessionStorage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
globalThis.location = { href: 'https://example.com/Watch/?v=abcdefghijk' };
globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
globalThis.window = new EventTarget();
const { keepListening, savedListening, listeningLifecycle } = await import('../script/listening-session.mjs');
const controllers = new Set(); listeningLifecycle(controllers);
class Audio extends EventTarget {
 constructor() { super(); this.currentTime = 153.75; this.duration = 1000; this.playbackRate = 1.25; this.paused = false; this.ended = false; this.seekable = { length: 1, start: () => 0, end: () => 1000 }; }
 async play() { this.paused = false; this.dispatchEvent(new Event('play')); }
 pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
}
const make = (liveSession = undefined) => {
 const item = { videoId: 'abcdefghijk', mode: 'audio', liveSession, audio: new Audio(), async switchTo(mode) { this.mode = mode; this.audio.currentTime = 0; }, dispose() { controllers.delete(this); this.audio.pause(); } };
 controllers.add(item); return keepListening(item, controllers);
};
let item = make(); item.audio.dispatchEvent(new Event('play'));
assert.equal(savedListening().seconds, 153.75); assert.equal(savedListening().playing, true);
item.audio.currentTime = 207.2; document.visibilityState = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
const snapshot = savedListening(); assert.equal(snapshot.seconds, 207.2);
assert.ok(![...store.values()].some(value => /https:|token|secret/i.test(value)), 'Checkpoint contains no URL or credentials');
window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: true }));
assert.ok(!item.audio.paused); window.dispatchEvent(new Event('pageshow'));
// A real unload retains its pre-disposal playback intent for a recreated document.
window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: false })); item.dispose();
assert.equal(savedListening().playing, true); window.dispatchEvent(new Event('pageshow'));
item = make(); await item.restoreListening(snapshot);
assert.equal(item.audio.currentTime, 207.2); assert.equal(item.audio.playbackRate, 1.25); assert.ok(!item.audio.paused);
item.audio.pause(); const paused = savedListening(); assert.equal(paused.playing, false);
await item.restoreListening(paused); assert.ok(item.audio.paused, 'A deliberate pause stays paused');
item.dispose(); assert.equal(savedListening(), null, 'Revoked/disposed players cannot resurrect a checkpoint');
item = make('session-1792874042803'); await item.restoreListening({ ...snapshot, session: 'session-1792874042804' });
assert.equal(item.audio.currentTime, 153.75, 'A new live session never reuses an old timeline');
location.href = 'https://example.com/Videos/'; assert.equal(savedListening(), null);
console.log('PASS: background checkpointing, persisted page preservation, reload restoration, pause intent, no stored credentials, disposal, and live-session identity.');
