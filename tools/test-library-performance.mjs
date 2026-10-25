import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('script/victorScripts/liteYtEmbed.js', 'utf8');
class Node {
 constructor(tag = 'div') { this.tag = tag; this.children = []; this.attributes = {}; this.style = {}; this.events = []; this.textContent = ''; this.classList = { add() {}, contains: () => false }; }
 setAttribute(name, value) { this.attributes[name] = String(value); }
 getAttribute(name) { return this.attributes[name] || null; }
 removeAttribute(name) { delete this.attributes[name]; }
 set innerHTML(value) { this.children = []; }
 appendChild(child) { if (child.tag === 'fragment') { for (const item of child.children) this.appendChild(item); return; } this.children.push(child); child.parentNode = this; }
 append(child) { this.appendChild(child); }
 querySelector() { return null; }
 closest() { return this.card || null; }
 addEventListener(event) { this.events.push(event); }
}
const tasks = [], container = new Node(); let completed = 0;
const build = source.slice(source.indexOf('    let cardBuildVersion ='), source.indexOf('    // Initial call'));
const context = vm.createContext({ document: { getElementById: () => container, createElement: tag => new Node(tag), createDocumentFragment: () => new Node('fragment') }, setTimeout: fn => tasks.push(fn), syncVideoCategoryTab() {}, videoCloneToOtherTabs: () => completed++ });
vm.runInContext(build, context);
const ids = Array.from({ length: 1000 }, (_, i) => String(i).padStart(11, '0'));
context.createVideoCards(ids); assert.equal(container.children.length, 24, 'Only the first batch blocks initial rendering');
while (tasks.length) { const before = container.children.length; tasks.shift()(); assert.ok(container.children.length - before <= 24); }
assert.equal(container.children.length, 1000); assert.equal(completed, 1);
context.createVideoCards(ids); context.createVideoCards(['public12345']);
while (tasks.length) tasks.shift()();
assert.equal(container.children.length, 1); assert.equal(container.children[0].getAttribute('data-video-id'), 'public12345', 'Stale member batches never reappear after sign-out');
const rows = JSON.parse(readFileSync('_data/videos.json', 'utf8'));
let Klass, applied = 0, queued = 0, observed = 0;
const elementContext = vm.createContext({ HTMLElement: Node, savedVideoTitles: Object.fromEntries(rows.map(row => [row.id, row.title])), document: { createElement: tag => new Node(tag) },
 IntersectionObserver: class { observe() { observed++; } unobserve() {} },
 customElements: { define: (_name, ctor) => { Klass = ctor; } },
 applyVideoMetadata: function() { applied++; this.hasFetchedVideoInfo = true; }, queueVideoMetadata: () => queued++,
});
vm.runInContext(source.slice(source.indexOf('function runFirstPartOfCode()'), source.indexOf('// Run the first part of the code')) + '\nrunFirstPartOfCode();', elementContext);
for (const row of rows) {
 const player = new Klass(); player.setAttribute('videoid', row.id); player.card = new Node();
 player.connectedCallback(); const events = player.events.length; player.connectedCallback();
 assert.equal(player.events.length, events, 'Reconnecting a card does not duplicate click handlers');
 assert.equal(player.style.backgroundImage, undefined, 'Off-screen thumbnails wait for intersection');
}
assert.equal(applied, rows.length); assert.equal(queued, 0, 'Saved library titles do not request YouTube metadata'); assert.ok(observed >= rows.length);
console.log(`PASS: 1,000 cards render in batches of 24, stale builds cancel, and all ${rows.length} cached titles render with zero YouTube title requests.`);
