import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const videoSource = readFileSync('script/victorScripts/liteYtEmbed.js', 'utf8');
const start = videoSource.indexOf('function renderAudienceVideos()');
const stop = videoSource.indexOf("\nwindow.addEventListener('lightcity-members-changed'", start);
const tabs = new Map(['Sunday', 'Program'].map(name => [name + '-Tab-content', { innerHTML: 'private card' }]));
const calls = [], memberState = { library: null };
const active = new Map();
const controls = ['All-Tab', 'Sunday-Tab', 'All-Tab-content', 'Sunday-Tab-content'].map(id => ({ id, classList: { toggle: (name, value) => active.set(id, value) } }));
const context = vm.createContext({
  LightCityMembers: memberState, publicVideoIds: ['abcdefghijk'], publicVideoCategories: { abcdefghijk: 'Program' },
  videoIds: [], savedVideoCategories: {}, videoCategories: ['Sunday', 'Program'], renderedAudience: null,
  document: { getElementById: id => tabs.get(id), querySelectorAll: selector => controls.filter(control => selector === '.videos-header-btns' ? !control.id.endsWith('-content') : control.id.endsWith('-content')) }, createVideoCards: ids => calls.push([...ids])
});
vm.runInContext(videoSource.slice(start, stop), context);
context.renderAudienceVideos(); assert.deepEqual(calls.at(-1), ['abcdefghijk']);
memberState.library = [{ id: 'lmnopqrstuv', category: 'Sunday' }, { id: 'abcdefghijk', category: 'Program' }];
context.renderAudienceVideos(); assert.deepEqual(calls.at(-1), ['lmnopqrstuv', 'abcdefghijk']);
tabs.forEach(tab => { tab.innerHTML = 'member card'; });
memberState.library = null; context.renderAudienceVideos();
assert.deepEqual(calls.at(-1), ['abcdefghijk']);
assert.ok([...tabs.values()].every(tab => tab.innerHTML === ''));
assert.equal(context.savedVideoCategories.lmnopqrstuv, undefined);
assert.equal(active.get('All-Tab'), true); assert.equal(active.get('Sunday-Tab-content'), false);

const generalSource = readFileSync('script/victorScripts/generalscript.js', 'utf8');
const begin = generalSource.indexOf('// Enhance the featured home video');
const end = generalSource.indexOf('\nconst categories =', begin);
const title = { textContent: 'Public teaching' }, image = { naturalWidth: 1280, complete: false, src: 'https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg' };
const hero = { dataset: { videoId: 'abcdefghijk' }, href: 'https://example.com/Home/../Watch/?v=abcdefghijk', hidden: false, querySelector: selector => selector === '.home-video-title' ? title : image };
const events = new Map(); let resolvePrivate;
memberState.library = null;
vm.runInNewContext(generalSource.slice(begin, end), {
  document: { querySelector: () => hero }, LightCityMembers: memberState,
  window: { addEventListener: (name, callback) => events.set(name, callback) },
  location: { href: 'https://example.com/Home/' }, URL, AbortController, setTimeout, clearTimeout,
  fetch: async url => {
    const id = new URL(new URL(url).searchParams.get('url')).searchParams.get('v');
    if (id === 'lmnopqrstuv') return new Promise(resolve => { resolvePrivate = resolve; });
    return { ok: true, json: async () => ({ title: 'Public teaching' }) };
  }
});
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
await settle();
memberState.library = [{ id: 'lmnopqrstuv', title: 'Member teaching' }];
events.get('lightcity-members-changed')();
assert.ok(hero.href.endsWith('v=lmnopqrstuv')); assert.equal(title.textContent, 'Member teaching');
memberState.library = null; events.get('lightcity-members-changed')(); await settle();
resolvePrivate({ ok: true, json: async () => ({ title: 'Late private title' }) }); await settle();
assert.ok(hero.href.endsWith('v=abcdefghijk')); assert.equal(title.textContent, 'Public teaching');
assert.ok(image.src.includes('/abcdefghijk/'));
console.log('PASS: member video tabs and featured homepage video switch audiences, clear private copies on sign-out and ignore late private metadata.');
