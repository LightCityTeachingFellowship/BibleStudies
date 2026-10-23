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
  constructor(tag = 'div') { this.tag = tag; this.attributes = {}; this.children = []; this.ownText = ''; this.classList = { add() {} }; }
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
  cloneNode() { const copy = new Element(this.tag); copy.attributes = { ...this.attributes }; copy.textContent = this.textContent; return copy; }
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
