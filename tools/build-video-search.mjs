// Optional metadata-cache maintenance. Pasting IDs works without running this.
// Run from the repository root: node tools/build-video-search.mjs [--refresh]
import { writeFile } from 'node:fs/promises';
import { categoryMatcher, validateLibrary, loadVideoLibrary } from './video-library.mjs';
const videos = await loadVideoLibrary();
const classify = await categoryMatcher();
const queue = videos.filter(video => process.argv.includes('--refresh') || !video.title);
let failed = 0;
await Promise.all(Array.from({ length: Math.min(6, queue.length) }, async () => {
  while (queue.length) {
    const video = queue.shift();
    if (!/^[\w-]{11}$/.test(video.id || '')) throw Error('Invalid YouTube ID');
    try {
      const url = 'https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + video.id) + '&format=json';
      const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw Error('HTTP ' + response.status);
      const data = await response.json();
      if (typeof data.title !== 'string' || !data.title.trim()) throw Error('Missing title');
      video.title = data.title.trim();
    } catch (error) { failed++; console.warn(video.id + ': ' + error.message); }
  }
}));
for (const video of videos) {
  if (!video.category && video.title) video.category = classify(video.title);
  if (video.visibility == null) video.visibility = 'members';
}
const complete = videos.filter(video => video.title && video.category);
validateLibrary(complete);
await writeFile('_data/videos.json', JSON.stringify(complete, null, 2) + '\n');
console.log('Cached ' + complete.length + ' video records. Visibility comes from the plain ID lists. Failed title refreshes: ' + failed);
