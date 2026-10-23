import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = '//' + readFileSync('script/victorScripts/generalscript.js', 'utf8').split('// Homepage search:')[1];
class Element {
  constructor() { this.children = []; this.events = {}; this.dataset = {}; this.value = ''; this.hidden = false; this.open = false; this.attributes = {}; this.ownText = ''; }
  addEventListener(name, callback) { this.events[name] = callback; }
  dispatch(name) { this.events[name]?.({ preventDefault() {} }); }
  appendChild(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  set textContent(text) { this.ownText = text; this.children = []; }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(' '); }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() {}
  setSelectionRange() {}
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatch('close'); }
}
const settle = () => new Promise(resolve => setTimeout(resolve, 160));
function setup({ failIndex = false, failCatalogue = false, staleCache = false, missingVideo = false, manyResults = false, scope = 'All' } = {}) {
  const nodes = new Map(['dialog', 'desktop', 'query', 'results', 'status', 'warning', 'retry', 'more'].map(name => [name, new Element()]));
  const get = name => nodes.get(name);
  const form = new Element(), mobile = new Element(), close = new Element();
  const filters = ['All', 'Video', 'Article', 'Summary'].map(kind => { const button = new Element(); button.dataset.kind = kind; return button; });
  get('dialog').dataset = { index: '/BibleStudies/search-home.json', videos: '/BibleStudies/search-video-catalog.json', watch: '/BibleStudies/Watch/', scope };
  get('dialog').querySelectorAll = () => filters;
  get('dialog').querySelector = () => close;
  get('desktop').closest = () => form;
  const titles = [{ id: 'abcdefghijk', title: 'Prayer Meeting' }];
  const publications = [
    { title: 'The Holy Spirit', kind: 'Article', url: '/BibleStudies/Spirit/', text: 'Study prayer in context.', categories: 'Bible' },
    { title: 'Mark 10 Reading', kind: 'Summary', url: '/BibleStudies/Mark-10/', text: 'A prayer for understanding.' },
    { title: 'Café teaching', kind: 'Article', url: '/BibleStudies/Cafe/', text: 'Unicode search.' },
    { title: '<script>literal title</script>', kind: 'Article', url: '/BibleStudies/Literal/', text: 'Display as text.' },
    { title: 'Prayer external', kind: 'Article', url: 'https://untrusted.example/', text: '' }
  ];
  const calls = [];
  if (manyResults) for (let i = 0; i < 35; i++) publications.push({ title: 'Many results ' + i, kind: 'Article', url: '/BibleStudies/Many-' + i + '/', text: '' });
  const document = {
    getElementById: id => get(id.replace('home-search-', '')),
    querySelector: () => mobile,
    createElement: () => new Element()
  };
  const storage = new Map();
  const events = {}, memberState = { library: null };
  if (staleCache) storage.set('lightcity-video-search-v1', JSON.stringify([{ id: 'zyxwvutsrqp', title: 'Old members-only video' }]));
  vm.runInNewContext(source, {
    document, window: { addEventListener: (name, handler) => { events[name] = handler; } }, LightCityMembers: memberState, location: { href: 'https://example.com/BibleStudies/Home/', origin: 'https://example.com' },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    URL, AbortSignal, setTimeout, clearTimeout,
    fetch: async url => {
      calls.push(url);
      if (url.includes('search-home')) {
        if (failIndex) throw new Error('Offline');
        return { ok: true, json: async () => ({ publications, videoIds: missingVideo ? ['abcdefghijk', 'lmnopqrstuv'] : ['abcdefghijk'] }) };
      }
      if (url.includes('catalog')) {
        if (failCatalogue) throw Error('Offline');
        return { ok: true, json: async () => titles };
      }
      return { ok: true, json: async () => ({ title: 'New video prayer' }) };
    }
  });
  return { get, form, mobile, close, filters, calls, storage, memberState, events };
}
let app = setup();
app.get('desktop').value = 'prayer'; app.get('desktop').dispatch('input'); await settle();
assert.equal(app.get('dialog').open, true);
assert.equal(app.get('results').children.length, 3);
assert.ok(app.get('results').textContent.includes('Prayer Meeting'));
assert.ok(app.get('results').children.some(li => li.children[0].href === 'https://example.com/BibleStudies/Watch/?v=abcdefghijk'));
assert.ok(!app.get('results').textContent.includes('external'));
app.filters[2].dispatch('click'); assert.equal(app.get('results').children.length, 1);
app.filters[3].dispatch('click'); assert.equal(app.get('results').children.length, 1);
app.filters[0].dispatch('click');
app.get('query').value = 'cafe'; app.get('query').dispatch('input'); await settle();
assert.equal(app.get('results').children.length, 1);
app.get('query').value = 'doesnotexist'; app.get('query').dispatch('input'); await settle();
assert.match(app.get('status').textContent, /No matches/);
app.get('query').value = '<script>'; app.get('query').dispatch('input'); await settle();
assert.ok(app.get('results').textContent.includes('<script>literal title</script>'));
app.close.dispatch('click'); assert.equal(app.get('dialog').open, false);
app.mobile.dispatch('click'); assert.equal(app.get('dialog').open, true);
assert.equal(app.calls.filter(url => url.includes('search-home')).length, 1);
app = setup({ failIndex: true }); app.mobile.dispatch('click'); await settle();
assert.equal(app.get('warning').hidden, false); assert.equal(app.get('retry').hidden, false);
app.get('retry').dispatch('click'); await settle();
assert.equal(app.calls.filter(url => url.includes('search-home')).length, 2);
app = setup({ manyResults: true }); app.get('desktop').value = 'many results'; app.get('desktop').dispatch('input'); await settle();
assert.equal(app.get('results').children.length, 30); assert.equal(app.get('more').hidden, false);
app.get('more').dispatch('click'); assert.equal(app.get('results').children.length, 35); assert.equal(app.get('more').hidden, true);
app = setup({ missingVideo: true }); app.get('desktop').value = 'new video'; app.get('desktop').dispatch('input'); await settle();
assert.equal(app.get('results').children.length, 1);
assert.ok(app.calls.some(url => url.includes('oembed')));
assert.ok([...app.storage.values()].some(value => value.includes('New video prayer')));
vm.runInNewContext(source, { document: { getElementById: () => null } });
for (const scope of ['Video', 'Article', 'Summary']) {
  app = setup({ scope }); app.get('desktop').value = 'prayer'; app.get('desktop').dispatch('input'); await settle();
  assert.equal(app.get('results').children.length, 1, scope);
  assert.equal(app.get('results').children[0].children[0].children[0].textContent, scope);
  app.filters[0].dispatch('click');
  assert.equal(app.get('results').children.length, 1, 'A section cannot switch to mixed results');
  if (scope !== 'Video') assert.ok(!app.calls.some(url => url.includes('catalog') || url.includes('oembed')), 'Non-video sections do not fetch video metadata');
  app.get('query').value = 'no matching phrase'; app.get('query').dispatch('input'); await settle();
  assert.ok(!app.get('status').textContent.includes('choose All'));
}
console.log('PASS: mixed search, content matching, type filters, direct video links, mobile open/close, accent matching, safe text/URLs, empty results, one-time loading, failure/retry state, new-video metadata and cache.');
console.log('PASS: video/article/summary scope restrictions, no cross-section results, and no video loading for article/summary searches.');
app = setup({ failIndex: true, failCatalogue: true, staleCache: true });
app.get('desktop').value = 'members-only'; app.get('desktop').dispatch('input'); await settle();
assert.equal(app.get('results').children.length, 0, 'Failed requests must not expose old cached members-only videos');
assert.ok(!app.calls.some(url => url.includes('oembed')), 'Cached private IDs must not trigger metadata requests');
console.log('PASS: unavailable public indexes cannot fall back to stale member search data.');
app = setup();
app.memberState.library = [{ id: 'abcdefghijk', title: 'Prayer Meeting' }, { id: 'lmnopqrstuv', title: 'Church private teaching' }];
app.get('desktop').value = 'private'; app.get('desktop').dispatch('input'); await settle();
assert.equal(app.get('results').children.length, 1);
assert.ok(![...app.storage.values()].some(value => value.includes('Church private teaching')), 'Private metadata must not enter persistent search storage');
app.memberState.library = null; app.events['lightcity-members-changed']();
assert.equal(app.get('results').children.length, 0, 'Signing out immediately removes private results');
await settle(); assert.equal(app.get('results').children.length, 0);
console.log('PASS: member search results stay in memory and disappear immediately on sign-out.');
