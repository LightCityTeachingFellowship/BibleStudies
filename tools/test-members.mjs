import assert from 'node:assert/strict';
import { createMemberHandlers } from './members/functions/core.mjs';
import { memberDeviceIds, recipients } from './push/audiences.mjs';
class Failure extends Error { constructor(code, message) { super(message); this.code = code; } }
function setup() {
  const values = new Map(), users = new Map([['member', { uid: 'member', emailVerified: false, disabled: false }], ['outsider', { uid: 'outsider', email: 'outsider@example.com', emailVerified: true }]]);
  const snapshot = path => ({ exists: values.has(path), data: () => values.get(path) });
  const db = {
    doc: path => ({ path, get: async () => snapshot(path), set: async (value, options) => values.set(path, options?.merge ? { ...values.get(path), ...value } : value) }),
    runTransaction: async task => task({ get: async ref => snapshot(ref.path), set: (ref, value) => values.set(ref.path, value), delete: ref => values.delete(ref.path) }),
    getAll: async (...refs) => refs.map(ref => snapshot(ref.path))
  };
  let changed = 0, currentSecret = 'test-code-for-the-church';
  const auth = {
    getUser: async id => users.get(id),
    updateUser: async (id, data) => { changed++; users.set(id, { ...users.get(id), ...data }); },
    verifyIdToken: async token => { if (token !== 'valid-device-proof') throw Error('Invalid token'); return { uid: 'phone' }; },
    getUsers: async ids => ({ users: ids.flatMap(({ uid }) => users.has(uid) ? [users.get(uid)] : []) })
  };
  const handlers = createMemberHandlers({ auth, db, secret: () => currentSecret, fail: Failure, now: () => 1000000 });
  const request = { auth: { uid: 'member' }, rawRequest: { ip: '127.0.0.1' }, data: { email: 'member@example.com', password: 'sample-password', code: currentSecret } };
  return { handlers, request, values, users, db, auth, changed: () => changed, rotate: () => { currentSecret = 'a-different-registration-code'; } };
}
const rejected = (task, code) => assert.rejects(task, error => error.code === code);
let app = setup();
await rejected(() => app.handlers.registerChurchMember({ data: app.request.data }), 'unauthenticated');
await rejected(() => app.handlers.registerChurchMember({ ...app.request, data: { ...app.request.data, code: 'wrong' } }), 'permission-denied');
assert.equal(app.changed(), 0); assert.equal(app.values.has('churchMembers/member'), false);
await app.handlers.registerChurchMember(app.request);
assert.equal(app.values.get('churchMembers/member').active, true);
await rejected(() => app.handlers.getChurchLibrary(app.request), 'failed-precondition');
app.users.get('member').emailVerified = true;
app.values.set('churchVideoLibrary/current', { videos: [{ id: 'abcdefghijk', visibility: 'members' }] });
assert.equal((await app.handlers.getChurchLibrary(app.request)).videos.length, 1);
await rejected(() => app.handlers.getChurchLibrary({ auth: { uid: 'outsider', member: true } }), 'permission-denied');
app.users.get('member').disabled = true;
await rejected(() => app.handlers.getChurchLibrary(app.request), 'permission-denied');
app.users.get('member').disabled = false;
await rejected(() => app.handlers.linkChurchDevice({ ...app.request, data: { deviceToken: 'forged' } }), 'permission-denied');
await app.handlers.linkChurchDevice({ ...app.request, data: { deviceToken: 'valid-device-proof', memberUid: 'outsider' } });
assert.equal(app.values.get('churchDevices/phone').memberUid, 'member');
await app.handlers.unlinkChurchDevice({ auth: { uid: 'outsider' }, data: { deviceToken: 'valid-device-proof' } });
assert.equal(app.values.has('churchDevices/phone'), true, 'Another member cannot unlink a different account');
await app.handlers.unlinkChurchDevice({ ...app.request, data: { deviceToken: 'valid-device-proof' } });
assert.equal(app.values.has('churchDevices/phone'), false);
app.rotate();
await rejected(() => app.handlers.registerChurchMember(app.request), 'permission-denied');
assert.equal((await app.handlers.getChurchLibrary(app.request)).videos.length, 1, 'Changing the registration code does not remove existing members');
app.values.set('churchMembers/member', { active: false });
await rejected(() => app.handlers.getChurchLibrary(app.request), 'permission-denied');
app = setup();
for (let i = 0; i < 20; i++) await rejected(() => app.handlers.registerChurchMember({ ...app.request, data: { ...app.request.data, code: 'wrong' } }), 'permission-denied');
await rejected(() => app.handlers.registerChurchMember(app.request), 'resource-exhausted');

app = setup(); app.users.get('member').emailVerified = true;
app.values.set('churchMembers/member', { active: true });
app.values.set('churchDevices/phone', { memberUid: 'member' });
const docs = [{ id: 'phone', data: () => ({ token: 'phone-token' }) }, { id: 'public', data: () => ({ token: 'public-token', member: true, memberUid: 'member' }) }];
let devices = await memberDeviceIds(app.db, app.auth, docs);
assert.deepEqual([...devices], ['phone']);
assert.deepEqual(recipients(docs, 'members', devices).map(doc => doc.id), ['phone']);
assert.equal(recipients(docs, 'public', devices).length, 2);
assert.equal(recipients([...docs, docs[0]], 'public', devices).length, 2, 'Duplicate push tokens are sent once');
app.users.get('member').emailVerified = false;
assert.equal((await memberDeviceIds(app.db, app.auth, docs)).size, 0);
app.users.get('member').emailVerified = true; app.values.set('churchMembers/member', { active: false });
assert.equal((await memberDeviceIds(app.db, app.auth, docs)).size, 0);
console.log('PASS: registration code, email verification, approval, revoked/disabled accounts, rate limiting, code rotation, device proof, sign-out unlinking and notification audience restrictions.');

app = setup();
const googleRequest = { ...app.request, auth: { uid: 'member', token: { firebase: { sign_in_provider: 'google.com' } } }, data: { code: app.request.data.code } };
await rejected(() => app.handlers.registerGoogleChurchMember(googleRequest), 'permission-denied');
Object.assign(app.users.get('member'), { emailVerified: true, providerData: [{ providerId: 'google.com' }] });
await rejected(() => app.handlers.registerGoogleChurchMember({ ...googleRequest, auth: { uid: 'member' } }), 'permission-denied');
await rejected(() => app.handlers.registerGoogleChurchMember({ ...googleRequest, data: { code: 'wrong' } }), 'permission-denied');
assert.equal(app.values.has('churchMembers/member'), false);
await app.handlers.registerGoogleChurchMember(googleRequest);
assert.equal(app.values.get('churchMembers/member').active, true);
assert.equal(app.changed(), 0, 'Google registration must not change passwords or email');
app.values.set('churchVideoLibrary/current', { videos: [] });
assert.deepEqual((await app.handlers.getChurchLibrary(googleRequest)).videos, []);
app.values.set('churchMembers/member', { active: false });
await rejected(() => app.handlers.registerGoogleChurchMember(googleRequest), 'permission-denied');
assert.equal(app.values.get('churchMembers/member').active, false);
app = setup();
Object.assign(app.users.get('member'), { emailVerified: true, providerData: [{ providerId: 'google.com' }] });
for (let i = 0; i < 20; i++) await rejected(() => app.handlers.registerGoogleChurchMember({ ...googleRequest, data: { code: 'wrong' } }), 'permission-denied');
await rejected(() => app.handlers.registerGoogleChurchMember(googleRequest), 'resource-exhausted');
console.log('PASS: Google provider proof, code gate, password preservation, revoked access and rate limiting.');
