// Refresh the public video-title catalogue without requiring a YouTube API key.
// Run from the repository root: node tools/build-video-search.mjs
import { readFile, writeFile } from 'node:fs/promises';
const ids = [...new Set((await readFile('_includes/videosALL.html', 'utf8'))
  .replace(/<[^>]*>/g, ' ').split(/\s+/).filter(id => /^[\w-]{11}$/.test(id)))];
let previous = [];
try { previous = JSON.parse(await readFile('search-video-catalog.json', 'utf8')); } catch {}
const entries = new Map(previous.filter(item => ids.includes(item.id) && item.title).map(item => [item.id, item]));
const queue = ids.filter(id => !entries.has(id));
let done = 0;
async function save() {
  await writeFile('search-video-catalog.json', JSON.stringify(ids.flatMap(id => entries.has(id) ? [entries.get(id)] : []), null, 2) + '\n');
}
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const id = queue.shift();
    try {
      const url = 'https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id) + '&format=json';
      const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (typeof data.title !== 'string' || !data.title.trim()) throw new Error('Missing title');
      entries.set(id, { id, title: data.title });
    } catch (error) { console.warn(id + ': ' + error.message); }
    done++;
    if (done % 100 === 0) console.log('Checked ' + done + ' videos');
  }
}));
await save();
console.log('Saved ' + entries.size + ' searchable video titles from ' + ids.length + ' listed videos.');
