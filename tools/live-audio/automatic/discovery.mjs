import {processingLibrary} from '../../studio-library.mjs';
import { loadVideoLibrary } from '../../video-library.mjs';
export async function declaredLibrary(root) {
  return (await processingLibrary(root,()=>loadVideoLibrary(root))).map(({ id, title, visibility, studioSelected }) => ({ id, title, studioSelected, visibility: visibility === 'public' ? 'public' : 'members' }));
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
  return data.items.filter(item => item.snippet?.channelId === channelId).map(item => ({ id: item.id, title: typeof item.snippet.title === 'string' ? item.snippet.title.slice(0, 300) : '', live: item.snippet.liveBroadcastContent === 'live' && Number.isFinite(Date.parse(item.liveStreamingDetails?.actualStartTime)) && !item.liveStreamingDetails?.actualEndTime && ['public', 'unlisted'].includes(item.status?.privacyStatus), startedAt: Date.parse(item.liveStreamingDetails?.actualStartTime), ended: !!item.liveStreamingDetails?.actualEndTime }));
}
export async function discoverBroadcast(library, lookup, signal) {
  const selected=library.filter(item=>item.studioSelected===true);
  if(selected.length>1)return {video:null,reason:'More than one Studio selection was returned. Audio is waiting for a single selection.'};
  const found = [], ids = [...new Set((selected.length?selected:library).map(item => item.id))];
  for (let i = 0; i < ids.length; i += 50) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    for (const video of await lookup(ids.slice(i, i + 50))) if (video.live && video.title) found.push(video);
  }
  if (found.length !== 1) return { video: null, reason: found.length ? 'More than one listed video is live on this channel. Audio is waiting for an unambiguous match.' : 'Waiting for a listed video to become live on YouTube.' };
  const entry = library.find(item => item.id === found[0].id);
  return { video: { ...found[0], visibility: entry.visibility === 'public' ? 'public' : 'members' }, reason: '' };
}

// One lookup at OBS startup; this does not read browser tabs or YouTube cookies.
export async function activeChannelLink({apiKey,channelId,startedAt,send=fetch}){
 if(!/^UC[\w-]{22}$/.test(channelId||'')||typeof apiKey!=='string'||apiKey.length<20)throw Error('Invalid channel setup');
 const url=new URL('https://www.googleapis.com/youtube/v3/search');url.search=new URLSearchParams({part:'id',channelId,eventType:'live',type:'video',maxResults:'5',key:apiKey,fields:'items(id/videoId)'});
 const response=await send(url,{redirect:'error',signal:AbortSignal.timeout(10000)});if(!response.ok){await response.body?.cancel();return null;}
 const data=await response.json();if(!Array.isArray(data.items)||data.items.length!==1)return null;
 const id=data.items[0]?.id?.videoId;if(!/^[\w-]{11}$/.test(id||''))return null;
 const verified=await youtubeVideos([id],{apiKey,channelId,send});return verified.length===1&&verified[0].live&&(!Number.isFinite(startedAt)||Math.abs(verified[0].startedAt-startedAt)<180000)?'https://youtube.com/watch?v='+id:null;
}