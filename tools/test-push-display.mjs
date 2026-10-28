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
assert.equal(shown[0].title, 'Video');assert.equal(shown[0].options.silent,false);assert.equal(shown[0].options.renotify,true);assert.ok(shown[0].options.tag,'re-alerting always has a notification tag');
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

await background({data:{title:'Recording'}});
assert.equal(shown.at(-1).options.tag,'lightcity-update','untagged background alerts get a valid fallback tag');
assert.equal(shown.at(-1).options.silent,false);
assert.equal(shown.at(-1).options.renotify,true);
const sender=readFileSync('tools/push/send.mjs','utf8');
const builder=sender.slice(sender.indexOf('function notificationMessage'),sender.indexOf('// YouTube hqdefault'));
const message=vm.runInNewContext(builder+';notificationMessage({id:"resource-1",title:"Update",body:"New recording",url:"https://example.com/Watch/"})',{URL,origin:new URL('https://example.com/')});
assert.equal(message.webpush.headers.Urgency,'high');assert.equal(message.webpush.notification.silent,false);assert.equal(message.webpush.notification.renotify,true);assert.ok(message.notification,'automatic background display remains enabled');
console.log('PASS: alert/re-alert options match foreground, data-only background and automatic Firebase background paths; high-urgency delivery retained. No notifications were sent.');

assert.equal(shown[0].options.requireInteraction,false,'ordinary publication alerts are not made persistent');
await foreground({messageId:'stream-feedback',data:{id:'stream-issue-report1',title:'Stream message',url:'/BibleStudies/Admin/?reports=1',requireInteraction:'true'}});
assert.equal(shown.at(-1).options.requireInteraction,true,'foreground admin feedback stays open where supported');
await background({messageId:'stream-feedback-background',data:{id:'stream-issue-report2',title:'Volume request',url:'/BibleStudies/Admin/?reports=1',requireInteraction:'true'}});
assert.equal(shown.at(-1).options.requireInteraction,true,'data-only background preserves persistent feedback alerts');
console.log('PASS: persistent feedback display in foreground/data-only paths, with ordinary alerts unchanged.');