import { loadVideoLibrary } from '../../video-library.mjs';
export async function declaredLibrary(root) {
  return (await loadVideoLibrary(root)).map(({ id, title, visibility }) => ({ id, title, visibility: visibility === 'public' ? 'public' : 'members' }));
}
export async function youtubeVideos(ids, { apiKey, channelId, send = fetch, signal }) {
  if (!/^UC[\w-]{22}$/.test(channelId || '') || typeof apiKey !== 'string' || apiKey.length < 20 || apiKey.length > 200 || ids.length > 50 || ids.some(id => !/^[\w-]{11}$/.test(id))) throw Error('YouTube lookup configuration is invalid');
  if (!ids.length) return [];
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.search = new URLSearchParams({ part: 'snippet,liveStreamingDetails,status', id: ids.join(','), key: apiKey, fields: 'items(id,snippet(title,channelId,liveBroadcastContent),liveStreamingDetails(actualStartTime,actualEndTime),status(privacyStatus))' });
  let response;
  try { response = await send(url, { redirect: 'error', signal: signal || AbortSignal.timeout(10000) }); }
  catch { throw Error('YouTube lookup is temporarily unavailable'); }
  if (!response.ok) { await response.body?.cancel(); throw Error('YouTube lookup was not accepted; check the API key and quota'); }
  let data; try { data = await response.json(); } catch { throw Error('YouTube returned an unreadable response'); }
  if (!Array.isArray(data.items) || data.items.length > 50 || data.items.some(item => !ids.includes(item.id))) throw Error('YouTube returned an invalid response');
  return data.items.filter(item => item.snippet?.channelId === channelId).map(item => ({ id: item.id, title: typeof item.snippet.title === 'string' ? item.snippet.title.slice(0, 300) : '', live: item.snippet.liveBroadcastContent === 'live' && Number.isFinite(Date.parse(item.liveStreamingDetails?.actualStartTime)) && !item.liveStreamingDetails?.actualEndTime && ['public', 'unlisted'].includes(item.status?.privacyStatus), ended: !!item.liveStreamingDetails?.actualEndTime }));
}
export async function discoverBroadcast(library, lookup, signal) {
  const found = [], ids = [...new Set(library.map(item => item.id))];
  for (let i = 0; i < ids.length; i += 50) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    for (const video of await lookup(ids.slice(i, i + 50))) if (video.live && video.title) found.push(video);
  }
  if (found.length !== 1) return { video: null, reason: found.length ? 'More than one listed video is live on this channel. Audio is waiting for an unambiguous match.' : 'Waiting for a listed video to become live on YouTube.' };
  const entry = library.find(item => item.id === found[0].id);
  return { video: { ...found[0], visibility: entry.visibility === 'public' ? 'public' : 'members' }, reason: '' };
}
