import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('script/pwa.js', 'utf8').replace('import(root + file)', 'mockImport(file)');
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.hidden = false; this.dataset = {}; this.textContent = ''; this.attributes = {}; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(key, value) { this.attributes[key] = value; }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function setup({ enabled = true, supported = true, permission = 'default', subscribed = false, ios = false, standalone = false, serviceWorker = true, subscriptionFails = false, pageViews = 1, snoozeUntil = 0, memberPage = false } = {}) {
  const body = new Element('body'), events = {}, state = { permissionRequests: 0, saved: 0, deleted: 0, tokenDeleted: 0, tokens: 0, placedBeforeNav: false };
  const cache = new Map(subscribed ? [['lc-push-enabled', 'yes']] : []);
  if (snoozeUntil) cache.set('lc-install-snooze-until', String(snoozeUntil));
  const session = new Map([['lc-install-page-views', String(pageViews)]]);
  const timers = new Map(); let timerId = 0;
  const storage = map => ({ getItem: key => map.get(key), setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) });
  const notification = { permission, requestPermission: async () => { state.permissionRequests++; notification.permission = 'granted'; return 'granted'; } };
  const window = { addEventListener: (name, handler) => { events[name] = handler; }, dispatchEvent: event => { events[event.type]?.(event); } };
  if (supported) { window.Notification = notification; window.PushManager = function () {}; }
  const navigator = { userAgent: ios ? 'iPhone' : 'Chrome', platform: '', maxTouchPoints: 0, standalone };
  if (serviceWorker) navigator.serviceWorker = { register: async () => ({ scope: '/BibleStudies/' }) };
  const modules = {
    'firebase-app.js': { initializeApp: () => ({}) },
    'firebase-auth.js': { getAuth: () => ({ authStateReady: async () => {}, currentUser: { uid: 'device-user' } }) },
    'firebase-firestore.js': { getFirestore: () => ({}), doc: (...args) => args, serverTimestamp: () => 123, setDoc: async () => { if (subscriptionFails) throw Error('Offline'); state.saved++; }, deleteDoc: async () => { state.deleted++; } },
    'firebase-messaging.js': { isSupported: async () => true, getMessaging: () => ({}), getToken: async () => { state.tokens++; return 'device-token'; }, deleteToken: async () => { state.tokenDeleted++; } }
  };
  vm.runInNewContext(source, {
    document: { currentScript: { dataset: { base: '/BibleStudies/' } }, body, getElementById: id => memberPage && id === 'member-page' ? {} : null, createElement: tag => new Element(tag), querySelector: selector => selector === 'dialog[open]' ? (state.dialogOpen ? {} : null) : ({ before: node => { body.append(node); state.placedBeforeNav = true; } }), addEventListener: (name, handler) => { events[name] = handler; } },
    navigator, window, Event, Notification: supported ? notification : undefined,
    matchMedia: () => ({ matches: standalone }), location: { origin: 'https://example.com' }, URL,
    LIGHTCITY_PUSH: { enabled, firebase: {}, vapidKey: 'public-key' },
    localStorage: storage(cache), sessionStorage: storage(session),
    mockImport: async file => modules[file], console: { error() {} },
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout: id => timers.delete(id)
  });
  const area = body.children[0];
  const popup = body.children.find(node => node.className.includes('lc-install-popup'));
  const notificationPopup = body.children.find(node => node.className.includes('lc-notification-popup'));
  const install = popup?.children[0], notify = notificationPopup?.children[0], settings = area?.children[0];
  return { state, events, area, popup, notificationPopup, install, notify, settings, cache,
    advance: delay => { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.fn(); } }
  };
}
let app = setup({ enabled: false });
assert.equal(app.area.hidden, true);
let nativePrompts = 0;
app.events.beforeinstallprompt({ preventDefault() {}, prompt: async () => { nativePrompts++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
assert.equal(app.install.hidden, false); assert.equal(app.popup.hidden, false); assert.equal(app.area.hidden, true);
await app.install.children[1].children[0].onclick(); assert.equal(nativePrompts, 1); assert.equal(app.install.hidden, true);
app = setup({ enabled: false });
app.events.beforeinstallprompt({ preventDefault() {} }); app.install.children[1].children[1].onclick(); assert.equal(app.popup.hidden, true); assert.ok(Number(app.cache.get('lc-install-snooze-until')) > Date.now());
app = setup(); assert.equal(app.notify.hidden, true); app.advance(10000); assert.equal(app.notify.hidden, false); assert.equal(app.state.permissionRequests, 0);
await app.notify.children[1].children[0].onclick();
assert.equal(app.state.permissionRequests, 1); assert.equal(app.state.saved, 1); assert.equal(app.notify.hidden, true); assert.equal(app.settings.hidden, false); assert.equal(app.cache.get('lc-push-enabled'), 'yes');
await app.settings.children[1].onclick(); assert.equal(app.state.deleted, 1); assert.equal(app.state.tokenDeleted, 1); assert.equal(app.notify.hidden, false); assert.equal(app.cache.has('lc-push-enabled'), false);
app = setup({ permission: 'granted', subscribed: true, standalone: true }); await tick();
assert.equal(app.install.hidden, true); assert.equal(app.notify.hidden, true); assert.equal(app.state.saved, 1); assert.equal(app.state.permissionRequests, 0);
app = setup({ permission: 'denied' }); assert.equal(app.notify.hidden, true); assert.equal(app.area.hidden, true);
app = setup({ supported: false }); assert.equal(app.area.hidden, true);
app = setup({ serviceWorker: false }); assert.equal(app.area, undefined);
app = setup({ ios: true }); assert.equal(app.install.hidden, false); assert.equal(app.notify.hidden, true);
await app.install.children[1].children[0].onclick(); assert.ok(app.install.children[0].children[1].textContent.includes('Add to Home Screen'));
app.events.appinstalled(); assert.equal(app.install.hidden, true);
app = setup({ subscriptionFails: true }); app.advance(10000); await app.notify.children[1].children[0].onclick();
assert.equal(app.notify.hidden, false); assert.equal(app.notify.children[1].children[0].disabled, false); assert.equal(app.notify.children[2].textContent, 'Offline');
assert.equal(app.state.placedBeforeNav, true);
console.log('PASS: install availability/dismissal, iPhone guidance, unsupported/blocked states, explicit permission, subscription save/hide, existing-token refresh, opt-out, failure/retry and navigation placement.');

app = setup({ enabled: false, pageViews: 0 });
app.events.beforeinstallprompt({ preventDefault() {} });
assert.equal(app.popup.hidden, true); app.advance(20000); assert.equal(app.popup.hidden, false);
app.install.children[1].children[2].onclick(); assert.equal(app.popup.hidden, true);
app = setup({ enabled: false, snoozeUntil: Date.now() + 100000 });
app.events.beforeinstallprompt({ preventDefault() {} }); assert.equal(app.popup.hidden, true);
app = setup({ enabled: false, snoozeUntil: Date.now() - 1000 });
app.events.beforeinstallprompt({ preventDefault() {} }); assert.equal(app.popup.hidden, false);
app = setup({ enabled: false }); app.state.dialogOpen = true;
app.events.beforeinstallprompt({ preventDefault() {} }); assert.equal(app.popup.hidden, true);
app.state.dialogOpen = false; app.advance(5000); assert.equal(app.popup.hidden, false);
app.events.keydown({ key: 'Escape' }); assert.equal(app.popup.hidden, true);
console.log('PASS: first-page delay, second-page invitation, week-long cooldown and expiry, close/Not now/Escape dismissal, and waiting for search dialogs.');

app = setup();
app.events.beforeinstallprompt({ preventDefault() {} });
app.advance(10000);
assert.equal(app.notificationPopup.hidden, false); assert.equal(app.popup.hidden, true);
assert.equal(app.notify.children[0].children[0].textContent, 'Stay up to date');
assert.equal(app.notify.children[0].children[1].textContent, 'Get alerts for new videos, articles and summaries.');
app.notify.children[1].children[1].onclick();
assert.equal(app.notificationPopup.hidden, true); assert.equal(app.popup.hidden, true);
assert.ok(Number(app.cache.get('lc-notification-snooze-until')) > Date.now());
app.advance(20000); assert.equal(app.popup.hidden, false);
app = setup(); app.state.dialogOpen = true; app.advance(10000);
assert.equal(app.notificationPopup.hidden, true);
app.state.dialogOpen = false; app.advance(5000); assert.equal(app.notificationPopup.hidden, false);
app.events.keydown({ key: 'Escape' }); assert.equal(app.notificationPopup.hidden, true);
app = setup(); app.advance(10000); app.notify.children[1].children[2].onclick(); assert.equal(app.notificationPopup.hidden, true);
app = setup({ permission: 'granted', subscribed: true }); app.advance(10000); assert.equal(app.notificationPopup.hidden, true);
console.log('PASS: notification pop-up delay, unchanged wording, dismissal, subscriber hiding, search-dialog deferral and separation from installation.');
app = setup({ memberPage: true }); app.events.beforeinstallprompt({ preventDefault() {} }); app.advance(10000); app.advance(20000);
assert.equal(app.popup.hidden, true); assert.equal(app.notificationPopup.hidden, true);
console.log('PASS: install and notification invitations do not interrupt member sign-in.');
