import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Run the production category helpers and metadata handler without YouTube/network calls.
const source = readFileSync('script/victorScripts/liteYtEmbed.js', 'utf8');
const helpers = source.slice(source.indexOf('function getVideoCategory('), source.indexOf('// Select the container element'));
const begin = source.indexOf('.then(data => {') + '.then(data => {'.length;
const last = 'syncVideoCategoryTab(videoBoxElement);';
const metadata = source.slice(begin, source.indexOf(last, begin) + last.length);
class Element {
  constructor(tag = 'div') { this.tag = tag; this.attributes = {}; this.children = []; this.ownText = ''; this.className = ''; this.dataset = {}; this.classList = { add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/), ...names])].join(' '); }, remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); } }; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  set textContent(value) { this.ownText = String(value); this.children = []; }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(''); }
  set innerHTML(value) { this.textContent = value; }
  get innerHTML() { return this.textContent; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  appendChild(child) { if (typeof child === 'string') child = Object.assign(new Element('text'), { textContent: child }); child.parentNode = this; this.children.push(child); }
  prepend(child) { child.parentNode = this; this.children.unshift(child); }
  insertBefore(child, next) { child.parentNode = this; const index = next ? this.children.indexOf(next) : this.children.length; this.children.splice(index, 0, child); }
  remove() { this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); }
  replaceChildren() { this.children = []; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...((selector.startsWith('.') ? child.className.split(/\s+/).includes(selector.slice(1)) : child.tag === selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  cloneNode() { const copy = new Element(this.tag); copy.attributes = { ...this.attributes }; copy.className = this.className; copy.dataset = { ...this.dataset }; copy.hidden = this.hidden; copy.ownText = this.ownText; this.children.forEach(child => copy.appendChild(child.cloneNode(true))); return copy; }
}
const categories = ['Sunday', 'Meeting', 'Study', 'Program', 'Excerpts', 'Ceremonies'];
const tabs = new Map(categories.map(name => [`${name}-Tab-content`, new Element()]));
const context = vm.createContext({
  videoCategories: categories,
  savedVideoCategories: {},
  document: { getElementById: id => tabs.get(id), createElement: tag => new Element(tag), createTextNode: text => Object.assign(new Element('text'), { textContent: text }) },
  stripHtmlTags: html => html,
  console: { error() {} }
});
vm.runInContext(helpers + '\nfunction processMetadata(data) {' + metadata + '\n}', context);
for (const [title, expected] of [
  ['LightCity Sunday Fellowship', 'Sunday'],
  ['PRAYER MEETING', 'Meeting'],
  ['Bible Study without a date', 'Study'],
  ['Teaching Excerpts', 'Excerpts'],
  ['Wedding Ceremonies', 'Ceremonies'],
  ['Special Program', 'Program'],
  ['Walking in faith', 'Program'],
  ['Walking in faith || Fri, Oct 09, 2026.', 'Program'],
  ['A teaching - LightCity Bible Study || Fri, Oct 09, 2026.', 'Study'],
  ['Sunday lessons - LightCity Program || Fri, Oct 09, 2026.', 'Program']
]) {
  tabs.forEach(tab => { tab.children = []; });
  const box = new Element(); box.setAttribute('data-video-id', 'example'); box.setAttribute('data-video-order', 0);
  const player = new Element(); player.closest = () => box;
  context.processMetadata.call(player, { title });
  assert.equal(box.getAttribute('videoCategoryTab'), expected, title);
  assert.equal(tabs.get(`${expected}-Tab-content`).children.length, 1, title);
  context.syncVideoCategoryTab(box);
  assert.equal(tabs.get(`${expected}-Tab-content`).children.length, 1, 'Repeated syncing must not duplicate videos');
}
// Simulate a slow title arriving after a later video was already copied.
tabs.forEach(tab => { tab.children = []; });
const boxes = [0, 1, 2].map(index => { const box = new Element(); box.setAttribute('data-video-id', `video-${index}`); box.setAttribute('data-video-order', index); box.setAttribute('videoCategoryTab', 'Program'); return box; });
[boxes[2], boxes[0], boxes[1]].forEach(box => context.syncVideoCategoryTab(box));
const programs = tabs.get('Program-Tab-content');
assert.deepEqual(programs.children.map(box => box.getAttribute('data-video-id')), ['video-0', 'video-1', 'video-2']);
boxes[1].setAttribute('videoCategoryTab', 'Study'); context.syncVideoCategoryTab(boxes[1]);
assert.equal(programs.children.length, 2); assert.equal(tabs.get('Study-Tab-content').children.length, 1);
console.log('PASS: matching categories, Programs fallback, titles without dates, late metadata, stable order and no duplicate copies.');
const playingBox = new Element(); playingBox.setAttribute('data-video-id', 'playing'); playingBox.setAttribute('videoCategoryTab', 'Program');
const viewport = new Element(); viewport.className = 'lc-media-viewport lc-audio-mode';
const lite = new Element('lite-youtube'); lite.hidden = true; lite.className = 'lyt-activated'; lite.appendChild(new Element('iframe'));
const audioPanel = new Element(); audioPanel.className = 'lc-inline-audio'; audioPanel.appendChild(new Element('audio'));
const controls = new Element(); controls.className = 'lc-video-actions'; controls.dataset.audioSignature = 'playing:inline-1'; controls.appendChild(new Element('button'));
viewport.append(lite, audioPanel); playingBox.append(viewport, controls); context.syncVideoCategoryTab(playingBox);
const preview = tabs.get('Program-Tab-content').children.find(box => box.getAttribute('data-video-id') === 'playing');
assert.equal(preview.querySelectorAll('iframe').length, 0); assert.equal(preview.querySelectorAll('audio').length, 0);
assert.equal(preview.querySelectorAll('lite-youtube')[0].hidden, false);
assert.equal(preview.querySelectorAll('.lyt-activated').length, 0);
assert.equal(preview.querySelectorAll('.lc-video-actions')[0].dataset.audioSignature, undefined);
assert.equal(playingBox.querySelectorAll('iframe').length, 1, 'Creating a preview does not disturb the active original');
console.log('PASS: category copies do not clone active video/audio players or signed audio sources.');

// Verify the migration against the actual UI metadata handler, not a second copy of its rules.
const library = JSON.parse(readFileSync('_data/videos.json', 'utf8'));
for (const video of library) {
  tabs.forEach(tab => { tab.children = []; });
  const box = new Element(); box.setAttribute('data-video-id', video.id); box.setAttribute('data-video-order', 0);
  const player = new Element(); player.closest = () => box;
  context.processMetadata.call(player, { title: video.title });
  assert.equal(box.getAttribute('videoCategoryTab'), video.category, video.id + ': ' + video.title);
}
const player = new Element(), box = new Element();
player.videoId = library[0].id; player.closest = () => box;
context.savedVideoCategories[player.videoId] = 'Program';
context.processMetadata.call(player, { title: 'A renamed Sunday Fellowship video' });
assert.equal(box.getAttribute('videoCategoryTab'), 'Program', 'Saved categories survive title changes');
console.log(`PASS: saved classifications match the UI for all ${library.length} videos and survive future title changes.`);
