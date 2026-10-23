import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('service-worker.js', 'utf8').replace(/^---[\s\S]*?---\s*/, '');
const listeners = new Map(), shown = [], opened = [];
let background, failNext = false;
const self = {
 location: { href: 'https://example.com/BibleStudies/service-worker.js' },
 LIGHTCITY_PUSH: { enabled: true, firebase: {} },
 addEventListener: (type, callback) => listeners.set(type, callback),
 registration: { showNotification: async (title, options) => {
  if (failNext) { failNext = false; throw Error('Display failed'); }
  shown.push({ title, options });
 } },
 clients: { openWindow: async url => opened.push(url) }
};
vm.runInNewContext(source, { self, URL, Date, Map, importScripts() {}, firebase: { initializeApp() {}, messaging: () => ({ onBackgroundMessage: callback => { background = callback; } }) } });
async function foreground(payload, url = 'https://example.com/BibleStudies/Videos/') {
 let pending;
 listeners.get('message')({ data: { type: 'LIGHTCITY_FOREGROUND_PUSH', payload }, source: { url }, waitUntil: promise => { pending = promise; } });
 await pending;
}
const payload = { messageId: 'one', notification: { title: 'Video', body: 'Video title' }, data: { id: 'video:abcdefghijk', image: 'https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg', url: 'https://example.com/BibleStudies/Watch/?v=abcdefghijk' } };
await Promise.all([foreground(payload), foreground(payload)]);
assert.equal(shown.length, 1, 'Multiple tabs must display one notification per message');
assert.equal(shown[0].title, 'Video');
assert.equal(shown[0].options.body, 'Video title');
assert.equal(shown[0].options.image, payload.data.image);
assert.ok(shown[0].options.badge.endsWith('/images/notification-badge.png'));
assert.ok(shown[0].options.icon.endsWith('/images/pwa-192.png'));
let clicked;
listeners.get('notificationclick')({ notification: { data: shown[0].options.data, close() {} }, stopImmediatePropagation() {}, waitUntil: promise => { clicked = promise; } });
await clicked;
assert.equal(opened[0], payload.data.url);
await background(payload);
assert.equal(shown.length, 1, 'Firebase handles background notification payloads automatically');
await background({ messageId: 'two', data: { title: 'Summary', url: '/BibleStudies/Summaries/' } });
assert.equal(shown.length, 2, 'Data-only background messages still display');
await foreground({ ...payload, messageId: 'three' }, 'https://elsewhere.example/');
assert.equal(shown.length, 2, 'Messages from outside this app are ignored');
failNext = true;
await assert.rejects(() => foreground({ ...payload, messageId: 'retry' }));
await foreground({ ...payload, messageId: 'retry' });
assert.equal(shown.length, 3, 'Failed display can be retried');
await foreground({ ...payload, messageId: 'new-test' });
assert.equal(shown.length, 4, 'A new send for the same publication must still display');
console.log('PASS: foreground display, cross-tab deduplication, title/image/icon/badge, direct click destination, background delivery, source validation and retry.');
