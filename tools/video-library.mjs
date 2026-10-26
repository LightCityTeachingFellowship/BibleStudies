import {loadReplacements,attachReplacements} from './video-replacements.mjs';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { join } from 'node:path';

export const categories = ['Sunday', 'Meeting', 'Study', 'Program', 'Excerpts', 'Ceremonies'];
export const labels = { Sunday: 'Sunday Fellowship', Meeting: 'Prayer Meeting', Study: 'Bible Study', Program: 'Programs', Excerpts: 'Excerpts', Ceremonies: 'Ceremonies' };

// Use the site's own category matcher when preparing the initial list.
export async function categoryMatcher() {
  const source = await readFile('script/victorScripts/liteYtEmbed.js', 'utf8');
  const start = source.indexOf('function getVideoCategory(');
  const end = source.indexOf('\nfunction syncVideoCategoryTab(', start);
  if (start < 0 || end < 0) throw Error('Video category matcher not found');
  const context = vm.createContext({ videoCategories: categories });
  vm.runInContext(source.slice(start, end), context);
  return title => {
    // Match the existing title presentation: only dated titles are split at the last dash.
    const date = title.match(/(\d{1,2}(?:st|nd|rd|th)?)\s?(\w{3})\,\s?(\d{4})\.?/)
      || title.match(/(\d{1,2}(?:st|nd|rd|th)?)\s?(\w{3})\.\s?(\d{4})\.?/)
      || title.match(/(?:\w{3},\s)?(\w{3})\s(\d{1,2}),\s(\d{4})\.?/);
    const withoutDate = date ? title.replace(date[0], '') : title;
    const preferred = date ? withoutDate.slice(withoutDate.lastIndexOf('-') + 1).trim() : title;
    return context.getVideoCategory(title, preferred);
  };
}

export function validateLibrary(videos) {
  if (!Array.isArray(videos) || !videos.length) throw Error('Video library must be a non-empty list');
  const ids = new Set();
  for (const video of videos) {
    if (!/^[\w-]{11}$/.test(video.id || '') || ids.has(video.id)) throw Error('Invalid or duplicate video ID: ' + video.id);
    ids.add(video.id);
    if (typeof video.title !== 'string' || !video.title.trim()) throw Error('Missing title: ' + video.id);
    if (!categories.includes(video.category)) throw Error('Unknown category: ' + video.id);
    if (video.visibility != null && !['public', 'members'].includes(video.visibility)) throw Error('Unknown visibility: ' + video.id);
  }
  return videos;
}

export function publicVideos(videos) { return videos.filter(video => video.visibility === 'public'); }
export function visibility(video) { return video.visibility === 'public' ? 'public' : 'members'; }

export function parseVideoIds(text) {
  const ids = String(text).trim().split(/\s+/).filter(Boolean);
  const invalid = ids.filter(id => !/^[\w-]{11}$/.test(id));
  if (invalid.length) throw Error('Invalid video ID(s): ' + invalid.join(', '));
  return [...new Set(ids)];
}

export function libraryFromLists(cached, publicIds, memberIds) {
  const members = new Set(memberIds), pasted = [...new Set([...publicIds, ...memberIds])];
  const cache = new Map(cached.map(video => [video.id, video]));
  const order = [...pasted.filter(id => !cache.has(id)), ...cached.filter(video => pasted.includes(video.id)).map(video => video.id)];
  return order.map(id => ({ ...(cache.get(id) || { id, title: null, category: null }), visibility: publicIds.includes(id) && !members.has(id) ? 'public' : 'members' }));
}

export async function loadVideoLibrary(root = '.') {
  const [cached, publicText, memberText] = await Promise.all([
    readFile(join(root, '_data/videos.json'), 'utf8').then(JSON.parse),
    readFile(join(root, '_includes/video-ids-public.txt'), 'utf8'),
    readFile(join(root, '_includes/video-ids-members.txt'), 'utf8')
  ]);
  return attachReplacements(libraryFromLists(cached, parseVideoIds(publicText), parseVideoIds(memberText)),await loadReplacements(root));
}
