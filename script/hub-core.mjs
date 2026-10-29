export const icons={
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
 settings:'<path d="m9 3 1-2h4l1 2 3 2 2 0 2 4-1 2v3l1 2-2 4-2 0-3 2-1 2h-4l-1-2-3-2-2 0-2-4 1-2v-3L2 9l2-4h2z"/><circle cx="12" cy="12" r="3"/>',
 playlist:'<path d="M3 5h16M3 10h16M3 15h9M18 14v8M14 18h8"/>',
 bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
 history:'<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v6l4 2"/>',
 video:'<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 9 6-4v14l-6-4"/>',
 audio:'<path d="M3 13v-2a9 9 0 0 1 18 0v2M3 12h4v9H3zM17 12h4v9h-4z"/>',
 Article:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
 Summary:'<path d="M12 5C8 2 4 2 2 3v17c4-1 7 0 10 2 3-2 6-3 10-2V3c-2-1-6-1-10 2v17"/>',
 more:'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>'
};
export function icon(name){return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(icons[name]||icons.bookmark)+'</svg>';}
export function element(tag,text='',cls=''){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
export function sitePath(path){const base=globalThis.document?.querySelector('script[data-lightcity-personal]')?.dataset.base||'/';return base.replace(/\/$/,'')+'/'+path.replace(/^\//,'');}
export function safeUrl(value){try{const u=new URL(value,location.origin);return u.origin===location.origin&&u.pathname.startsWith('/')?u.href:null;}catch{return null;}}
export function combineResources({view,media,readings,videos,catalog,live=()=>false}){
 const result=[];
 for(const row of media.rows(view)){
  if(!videos.has(row.videoId))continue;const point=media.history(row.videoId),mode=point?.mode==='audio'?'audio':'video';
  const title=videos.get(row.videoId);result.push({type:'media',id:row.videoId,title:title&&title!==row.videoId?title:row.title&&row.title!==row.videoId?row.title:'LightCity video',kind:mode==='audio'?'Audio':'Video',mode,updatedAt:row.updatedAt,url:sitePath('/Watch/?v=')+row.videoId+(mode==='audio'?'&mode=audio':''),point,live:live(row.videoId)});
 }
 const entries=new Map(catalog.map(e=>[e.id,e]));
 for(const row of readings.rows(view)){const entry=entries.get(row.resourceId);if(!entry)continue;const point=readings.history(row.resourceId);result.push({type:'reading',id:row.resourceId,title:entry.title,kind:entry.kind,url:entry.url+(point&&!point.completed?'?continue=reading':''),updatedAt:row.updatedAt,point});}
 return result.sort((a,b)=>b.updatedAt-a.updatedAt);
}
