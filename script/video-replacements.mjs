const valid=id=>typeof id==='string'&&/^[\w-]{11}$/.test(id);
const json=id=>{try{const value=JSON.parse(globalThis.document?.getElementById?.(id)?.textContent||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}};
export function replacementMap(){
 const result=new Map(),publicVideos=json('lc-public-video-data'),links=json('lc-public-video-replacements');
 for(const [from,to] of Object.entries(links))if(valid(from)&&valid(to)&&from!==to&&!Object.hasOwn(publicVideos,from)&&Object.hasOwn(publicVideos,to))result.set(from,to);
 const members=globalThis.LightCityMembers,library=members?.loading===true?[]:members?.library||[],active=new Set(library.map(v=>v.id));
 for(const video of library)if(valid(video.id))for(const from of Array.isArray(video.replaces)?video.replaces:[])if(valid(from)&&from!==video.id&&!active.has(from))result.set(from,video.id);
 return result;
}
export async function resolveWatchReplacement(id){
 let map=replacementMap();if(map.has(id))return map.get(id);
 if(Object.hasOwn(json('lc-public-video-data'),id))return id;
 await globalThis.LightCityMembers?.ready;map=replacementMap();return map.get(id)||id;
}
