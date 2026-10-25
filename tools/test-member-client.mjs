import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('script/members.js', 'utf8').replace('import(root + file)', 'mockImport(file)').replace("import(new URL('../pwa-config.js', import.meta.url).href)", 'mockLoadConfig()');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function settle() { for (let i = 0; i < 6; i++) await tick(); }
class Element {
  constructor() { this.hidden = false; this.value = ''; this.dataset = {}; this.attributes = {}; this.textContent = ''; this.disabled = false; this.events = {}; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, fn) { this.events[name] = fn; }
}
function setup(enabled = true, configMode = 'ready', startup = {}) {
  const nodes = new Map(), get = name => { if (!nodes.has(name)) nodes.set(name, new Element()); return nodes.get(name); };
  const page = get('member-page'); page.querySelectorAll = () => [...nodes.values()];
  const callbacks = new Map(), events = new Map(), announcements = [], calls = [];
  const state = { verified: !!startup.verified, approved: !!startup.approved, hold: startup.hold || null, waiting: null, emails: 0, googleError: null };
  const makeUser = anonymous => ({ uid: anonymous ? 'member-anonymous' : 'member-account', isAnonymous: anonymous, email: anonymous ? null : 'member@example.com', getIdToken: async () => 'member-proof' });
  const memberAuth = { currentUser: startup.signedIn ? { ...makeUser(false), providerData: [{ providerId: 'google.com' }] } : null, authStateReady: async () => {} };
  const deviceAuth = { currentUser: { uid: 'notification-device', getIdToken: async () => 'device-proof' }, authStateReady: async () => {} };
  const emit = auth => { for (const callback of callbacks.get(auth) || []) void callback(auth.currentUser); };
  const apps = [];
  const modules = {
    'firebase-app.js': { getApps: () => apps, initializeApp: (config, name = '[DEFAULT]') => { const app = { name }; apps.push(app); return app; } },
    'firebase-auth.js': {
      GoogleAuthProvider: class { setCustomParameters() {} },
      signInWithPopup: async auth => {
        if (state.googleError) throw Object.assign(Error('Popup failure'), { code: state.googleError });
        state.verified = true;
        auth.currentUser = { ...makeUser(false), providerData: [{ providerId: 'google.com' }] };
        emit(auth); return { user: auth.currentUser };
      },
      getAuth: app => app.name === '[DEFAULT]' ? deviceAuth : memberAuth,
      onAuthStateChanged: (auth, callback) => { callbacks.set(auth, [...callbacks.get(auth) || [], callback]); queueMicrotask(() => void callback(auth.currentUser)); return () => {}; },
      signInAnonymously: async auth => { auth.currentUser = makeUser(true); emit(auth); return { user: auth.currentUser }; },
      signInWithEmailAndPassword: async auth => { auth.currentUser = makeUser(false); emit(auth); return { user: auth.currentUser }; },
      signOut: async auth => { auth.currentUser = null; emit(auth); },
      sendEmailVerification: async () => { state.emails++; }, sendPasswordResetEmail: async () => {}, reload: async () => {}
    },
    'firebase-functions.js': { getFunctions: () => ({}), httpsCallable: (functions, name) => async data => {
      calls.push({ name, data });
      if (name === 'registerChurchMember' || name === 'registerGoogleChurchMember') {
        if (data.code !== 'a-valid-code') throw Object.assign(Error('Incorrect church code'), { code: 'functions/permission-denied' });
        state.approved = true; return { data: { verificationRequired: true } };
      }
      if (name === 'getChurchLibrary') {
        if (state.libraryError) throw Object.assign(Error('Lookup failed'), { code: state.libraryError });
        if (!state.approved) throw Object.assign(Error('No church access'), { code: 'functions/permission-denied' });
        if (!state.verified) throw Object.assign(Error('Verify your email'), { code: 'functions/failed-precondition' });
        if (state.hold) return new Promise(resolve => { state.waiting = resolve; });
        return { data: { videos: [{ id: 'abcdefghijk', title: 'Member teaching' }] } };
      }
      return { data: {} };
    } }
  };
  const rootClasses = new Set(enabled ? ['lc-member-restoring'] : []);
  let domReady;
  const context = vm.createContext({
    document: { readyState: startup.domLoading ? 'loading' : 'complete', addEventListener: (name, callback) => { if (name === 'DOMContentLoaded') domReady = callback; }, documentElement: { classList: { add: (...names) => names.forEach(name => rootClasses.add(name)), remove: (...names) => names.forEach(name => rootClasses.delete(name)) } }, getElementById: get, querySelector: () => ({ dataset: { enabled: String(enabled) } }) },
    window: { addEventListener: (name, callback) => { events.set(name, [...events.get(name) || [], callback]); }, dispatchEvent: event => { announcements.push(event); for (const callback of events.get(event.type) || []) callback(event); } },
    ...(configMode === 'ready' ? { LIGHTCITY_PUSH: { firebase: { apiKey: 'test-public-key', projectId: 'test-project' } } } : {}),
    mockLoadConfig: async () => {
      await tick();
      if (configMode === 'failed') throw Error('Config request failed');
      context.LIGHTCITY_PUSH = { firebase: { apiKey: 'test-public-key', projectId: 'test-project' } };
    },
    mockImport: async file => modules[file],
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } }, console
  });
  vm.runInContext(source, context);
  return { get, api: context.LightCityMembers, state, calls, deviceAuth, announcements, rootClasses, events, fireDomReady: () => domReady?.() };
}
let app = setup(false); await app.api.ready;
assert.equal(app.get('member-submit').disabled, true); assert.equal(app.calls.length, 0);
app = setup(); await app.api.ready;
app.get('member-tab-signup').onclick();
app.get('member-email').value = 'member@example.com'; app.get('member-password').value = 'sample-password'; app.get('member-code').value = 'wrong';
app.get('member-form').events.submit({ preventDefault() {} }); await settle();
assert.equal(app.state.approved, false); assert.equal(app.api.library, null);
app.get('member-code').value = 'a-valid-code';
app.get('member-form').events.submit({ preventDefault() {} }); await settle();
assert.equal(app.state.approved, true); assert.equal(app.state.emails, 1); assert.equal(app.api.library, null);
assert.equal(app.get('member-verification').hidden, false);
assert.equal(app.get('member-password').value, ''); assert.equal(app.get('member-code').value, '');
app.state.verified = true; await app.api.refresh();
assert.equal(app.api.library.length, 1); assert.equal(app.get('member-library-link').hidden, false);
assert.equal(app.deviceAuth.currentUser.uid, 'notification-device', 'Membership must preserve the existing anonymous notification identity');
assert.ok(app.calls.some(call => call.name === 'linkChurchDevice' && call.data.deviceToken === 'device-proof'));
app.state.hold = true; const pending = app.api.refresh(); await settle();
app.get('member-signout').onclick(); await settle();
assert.equal(app.api.library, null); assert.equal(app.api.user, null);
assert.ok(app.calls.some(call => call.name === 'unlinkChurchDevice'));
app.state.waiting({ data: { videos: [{ id: 'abcdefghijk', title: 'Stale private response' }] } }); await pending;
assert.equal(app.api.library, null, 'An old library response cannot restore access after sign-out');
assert.ok(app.announcements.some(event => event.detail?.videos === null));
console.log('PASS: disabled rollout, signup code, verification, retained push identity, device linking, sign-out cleanup and stale-response protection.');

app = setup(); await app.api.ready;
app.get('member-google').onclick(); await settle();
assert.equal(app.api.library, null, 'Google sign-in alone cannot grant membership');
assert.equal(app.get('member-google-form').hidden, false);
assert.equal(app.get('member-form').hidden, true);
app.get('member-google-code').value = 'wrong';
app.get('member-google-form').events.submit({ preventDefault() {} }); await settle();
assert.equal(app.state.approved, false);
app.get('member-google-code').value = 'a-valid-code';
app.get('member-google-form').events.submit({ preventDefault() {} }); await settle();
assert.equal(app.api.library.length, 1);
assert.equal(app.get('member-google-code').value, '');
assert.equal(app.get('member-google-form').hidden, true);
assert.equal(app.state.emails, 0);
assert.equal(app.deviceAuth.currentUser.uid, 'notification-device');
app.get('member-signout').onclick(); await settle();
const registrations = app.calls.filter(call => call.name === 'registerGoogleChurchMember').length;
app.get('member-google').onclick(); await settle();
assert.equal(app.api.library.length, 1);
assert.equal(app.calls.filter(call => call.name === 'registerGoogleChurchMember').length, registrations, 'Returning members do not register again');
app = setup(); await app.api.ready; app.state.googleError = 'auth/popup-blocked';
app.get('member-google').onclick(); await settle();
assert.match(app.get('member-status').textContent, /Allow pop-ups/);
assert.equal(app.api.library, null);
console.log('PASS: Google first registration, wrong code, returning membership, popup failure and preserved notification identity.');

app = setup(true, 'delayed'); await app.api.ready;
app.get('member-google').onclick(); await settle();
assert.equal(app.api.user.email, 'member@example.com', 'Sign-in waits for the shared configuration');
assert.equal(app.api.library, null);
app = setup(true, 'failed'); await app.api.ready;
assert.match(app.get('member-status').textContent, /Sign-in settings could not be loaded/);
assert.equal(app.calls.length, 0);
app.get('member-google').onclick(); await settle();
assert.match(app.get('member-status').textContent, /Please reload the page/);
assert.equal(app.api.library, null);
console.log('PASS: delayed configuration load and friendly configuration failure without partial sign-in.');

app = setup(true, 'ready', { signedIn: true, approved: true, verified: true, hold: true, domLoading: true });
await settle();
assert.equal(app.api.loading, true);
assert.equal(app.rootClasses.has('lc-member-restoring'), true);
assert.equal(app.api.library, null, 'Pending access never restores a cached private library');
app.state.waiting({ data: { videos: [{ id: 'abcdefghijk', title: 'Restored member teaching' }] } });
await app.api.ready;
assert.equal(app.api.library.length, 1);
assert.equal(app.rootClasses.has('lc-member-restoring'), true, 'Wait for deferred renderers before revealing the selected audience');
app.fireDomReady();
assert.equal(app.rootClasses.has('lc-member-restoring'), false);
assert.equal(app.announcements.at(-1).detail.videos[0].title, 'Restored member teaching');
app = setup(); await app.api.ready;
assert.equal(app.api.loading, false);
assert.equal(app.rootClasses.has('lc-member-restoring'), false, 'Signed-out visitors are released to the public view');
app = setup(true, 'failed'); await app.api.ready;
assert.equal(app.rootClasses.has('lc-member-restoring'), false, 'A failed bootstrap does not leave the page masked');
console.log('PASS: slow restored member sessions stay masked until access and renderers are ready; guest and failed startup release the loading state.');

app = setup(true, 'ready', { signedIn: true, approved: true, verified: true }); await app.api.ready;
app.state.hold = true;
app.events.get('pageshow')[0]({ persisted: true }); await settle();
assert.equal(app.api.loading, false);
assert.equal(app.api.library.length, 1, 'Restored verified access stays mounted while revalidation runs');
assert.equal(app.rootClasses.has('lc-member-restoring'), false);
app.state.waiting({ data: { videos: [{ id: 'abcdefghijk', title: 'Revalidated member teaching' }] } });
await app.api.ready;
assert.equal(app.api.loading, false);
assert.equal(app.rootClasses.has('lc-member-restoring'), false);
console.log('PASS: back/forward cache restores recheck membership without showing the public library.');

app = setup(true, 'ready', { signedIn: true, approved: true, verified: true }); await app.api.ready;
app.state.libraryError = 'functions/unavailable';
app.events.get('pageshow')[0]({ persisted: true }); await app.api.ready;
assert.equal(app.api.library.length, 1, 'Transient return-to-app network errors retain verified access');
app.state.libraryError = 'functions/permission-denied';
app.events.get('pageshow')[0]({ persisted: true }); await app.api.ready;
assert.equal(app.api.library, null, 'Revoked access still clears the member library');
console.log('PASS: quiet membership revalidation preserves playback on network failure and clears revoked access.');
