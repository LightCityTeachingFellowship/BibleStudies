const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('script/members-v2.js', 'utf8');
const cache = source.slice(source.indexOf('const memberCacheKey'), source.indexOf('const field ='));
function setup(android = false) {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const context = vm.createContext({ isAndroidApp: () => android, localStorage: storage, Date, JSON, Number, Array });
  vm.runInContext(cache + '\nthis.cache = { rememberMemberLibrary, rememberedMemberLibrary, clearMemberCache, memberCacheKey };', context);
  return { ...context.cache, data };
}
const web = setup(), user = { uid: 'member-1' }, videos = [{ id: 'abcdefghijk', title: 'Teaching' }];
web.rememberMemberLibrary(user, videos);
assert.equal(web.memberCacheKey, 'lc-web-member-library-v1');
assert.equal(web.rememberedMemberLibrary(user)[0].title, 'Teaching');
assert.equal(web.rememberedMemberLibrary({ uid: 'other' }), null);
const stored = JSON.parse(web.data.get(web.memberCacheKey));
for (const at of [Date.now() - 8 * 86400000, Date.now() + 60000]) {
  web.data.set(web.memberCacheKey, JSON.stringify({ ...stored, at }));
  assert.equal(web.rememberedMemberLibrary(user), null);
}
web.data.set(web.memberCacheKey, JSON.stringify({ ...stored, videos: [{ id: 'invalid' }] }));
assert.equal(web.rememberedMemberLibrary(user), null);
web.clearMemberCache();
assert.equal(web.data.size, 0);
assert.equal(setup(true).memberCacheKey, 'lc-android-member-library-v1');
assert.match(source, /if\(!retain\)\{clearMemberCache\(\);publish\(null\);\}/);
console.log('PASS: website cache restores only the same account, expires, validates entries and clears on denial; Android remains separate.');

