// Test dependency: npm install --prefix tools/visibility-qa --no-save --package-lock=false liquidjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { validateLibrary, publicVideos, visibility, parseVideoIds, libraryFromLists, loadVideoLibrary } from './video-library.mjs';
const require = createRequire(import.meta.url);
const { Liquid } = require('./visibility-qa/node_modules/liquidjs');
const videos = validateLibrary(JSON.parse(await readFile('_data/videos.json', 'utf8')));
const currentLibrary = await loadVideoLibrary();
let engine = new Liquid({ root: '_includes', dynamicPartials: false });
engine.registerFilter('jsonify', value => JSON.stringify(value ?? null));
engine.registerFilter('relative_url', value => '/BibleStudies' + value);
engine.registerFilter('normalize_whitespace', value => String(value).replace(/\s+/g, ' ').trim());
const source = async path => (await readFile(path, 'utf8')).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
for (const enabled of [false, true]) {
  const site = { data: { videos }, pages: [], posts: [], video_visibility_enabled: enabled };
  const expected = enabled ? publicVideos(currentLibrary) : currentLibrary;
  const render = async path => engine.parseAndRender(await source(path), { site });
  const catalogue = JSON.parse(await render('search-video-catalog.json'));
  assert.deepEqual(catalogue.map(video => video.id), expected.map(video => video.id));
  const index = JSON.parse(await render('search-home.json'));
  assert.deepEqual(index.videoIds, expected.map(video => video.id));
  const feed = JSON.parse(await render('publication-feed.json'));
  assert.deepEqual(feed.videos.map(video => video.id), expected.map(video => 'video:' + video.id));
  const page = await render('videos.html');
  const categoryData = JSON.parse(page.match(/id="video-category-data">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(Object.keys(categoryData), expected.map(video => video.id));
  const home = (await source('home.html')).split('<!doctype html>')[0] + '{{ latest_video }}';
  assert.equal((await engine.parseAndRender(home, { site })).trim(), expected[0].id);
  if (enabled) for (const video of currentLibrary.filter(video => visibility(video) === 'members')) {
    assert.ok(!catalogue.some(item => item.id === video.id));
    assert.ok(!page.includes(video.id));
  }
}
assert.equal(visibility({}), 'members');
assert.equal(publicVideos([{ id: 'x' }, { id: 'y', visibility: 'members' }]).length, 0);
assert.throws(() => validateLibrary([{ ...videos[0], visibility: 'publci' }]));
assert.throws(() => validateLibrary([videos[0], videos[0]]));
console.log(`PASS: all ${videos.length} cached records validated; legacy mode retains all ${currentLibrary.length} pasted videos; public mode filters listings, search data, homepage and publication feed to ${publicVideos(currentLibrary).length} public entries. Missing visibility stays Members.`);

// A paste must work without updating JSON or running any preparation command.
const originalRead = engine.options.fs.readFile;
let publicText = '', memberText = '';
engine = new Liquid({ root: '_includes', dynamicPartials: false, fs: { ...engine.options.fs, readFile: async file => file.endsWith('video-ids-public.txt') ? publicText : file.endsWith('video-ids-members.txt') ? memberText : originalRead(file) } });
engine.registerFilter('jsonify', value => JSON.stringify(value ?? null));
engine.registerFilter('relative_url', value => '/BibleStudies' + value);
engine.registerFilter('normalize_whitespace', value => String(value).replace(/\s+/g, ' ').trim());
const knownPublic = videos.find(video => video.visibility === 'public');
const knownMember = videos.find(video => video.visibility === 'members');
publicText = `\r\nabcdefghijk\r\nabcdefghijk\n${knownPublic.id}\ninvalid\n1234567890!\n`;
memberText = `lmnopqrstuv\n${knownMember.id}\n${knownPublic.id}\n`;
const fixtureSite = { data: { videos: [knownMember, knownPublic] }, pages: [], posts: [], video_visibility_enabled: true };
const renderFixture = async path => engine.parseAndRender(await source(path), { site: fixtureSite });
let catalogue = JSON.parse(await renderFixture('search-video-catalog.json'));
assert.deepEqual(catalogue.map(video => video.id), ['abcdefghijk'], 'New public paste appears; invalid IDs and overlapping member IDs stay out');
assert.equal(catalogue[0].title, null, 'An uncached ID reaches the browser for automatic title retrieval');
let index = JSON.parse(await renderFixture('search-home.json'));
assert.deepEqual(index.videoIds, ['abcdefghijk']);
const homeSource = (await source('home.html')).split('<!doctype html>')[0] + '{{ latest_video }}';
assert.equal((await engine.parseAndRender(homeSource, { site: fixtureSite })).trim(), 'abcdefghijk');
const categoryPage = await renderFixture('videos.html');
assert.deepEqual(JSON.parse(categoryPage.match(/id="video-category-data">([\s\S]*?)<\/script>/)[1]), { abcdefghijk: null });
const feed = JSON.parse(await renderFixture('publication-feed.json'));
assert.deepEqual(feed.videos.map(video => video.id), ['video:abcdefghijk']);
fixtureSite.video_visibility_enabled = false;
catalogue = JSON.parse(await renderFixture('search-video-catalog.json'));
assert.deepEqual(catalogue.map(video => video.id), ['abcdefghijk', 'lmnopqrstuv', knownMember.id, knownPublic.id]);
publicText = knownMember.id; memberText = '';
fixtureSite.video_visibility_enabled = true;
catalogue = JSON.parse(await renderFixture('search-video-catalog.json'));
assert.deepEqual(catalogue.map(video => video.id), [knownMember.id], 'Moving an ID changes visibility without editing the metadata cache');
assert.deepEqual(parseVideoIds('abcdefghijk\r\n abcdefghijk\n lmnopqrstuv'), ['abcdefghijk', 'lmnopqrstuv']);
assert.throws(() => parseVideoIds('not-an-id'));
assert.deepEqual(libraryFromLists([knownMember, knownPublic], ['abcdefghijk', knownMember.id], ['lmnopqrstuv']).map(video => [video.id, video.visibility]), [['abcdefghijk', 'public'], ['lmnopqrstuv', 'members'], [knownMember.id, 'public']]);
console.log('PASS: paste-only additions reach listings, search, homepage and feed without cached metadata; blank lines, duplicates, invalid IDs, removals, overlap and visibility moves handled.');

// Uncached items inserted in the middle must not jump ahead of newer recordings.
const ids = ['newday29000', 'cached28000', 'cached27000', 'uncache2600', 'cached25000'];
const cacheFixture = [ids[4], ids[1], ids[2]].map(id => ({id, title:id}));
publicText = 'publicnew00 publicold00'; memberText = ids.join(' ');
fixtureSite.data.videos = [...cacheFixture, {id:'publicold00',title:'Public'}];
const ordered = libraryFromLists(fixtureSite.data.videos, publicText.split(' '), ids);
assert.deepEqual(ordered.filter(v=>v.visibility==='members').map(v=>v.id), ids);
assert.deepEqual(ordered.filter(v=>v.visibility==='public').map(v=>v.id), publicText.split(' '));
fixtureSite.video_visibility_enabled = false;
assert.deepEqual(JSON.parse(await renderFixture('search-video-catalog.json')).map(v=>v.id), ordered.map(v=>v.id));
console.log('PASS: source order overrides cached order and preserves uncached middle entries; Liquid and worker ordering agree.');
