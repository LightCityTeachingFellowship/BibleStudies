let remote={},remoteOwner='',loadedAt=0,pending=null,remoteRevision=0;
const owner=()=>{const api=globalThis.LightCityMembers;return (api?.user?.uid||'public')+':'+Array.isArray(api?.library);};
export async function loadRemoteReplacements(){
 const api=globalThis.LightCityMembers;await api?.ready;const scope=owner();
 if(remoteOwner!==scope){remote={};remoteOwner=scope;loadedAt=0;pending=null;remoteRevision++;}
 if(loadedAt&&Date.now()-loadedAt<30000)return;if(pending)return pending;
 if(!api?.getVideoReplacements)return;
 const ticket=++remoteRevision;const request=(async()=>{try{const result=await api.getVideoReplacements(),value=result?.replacements;if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid replacement catalogue');if(ticket===remoteRevision&&owner()===scope&&remoteOwner===scope){remote=value;loadedAt=Date.now();}}catch{if(ticket===remoteRevision&&owner()===scope)loadedAt=Date.now();}finally{if(ticket===remoteRevision&&remoteOwner===scope)pending=null;}})();pending=request;return request;
}
const valid=id=>typeof id==='string'&&/^[\w-]{11}$/.test(id);
const json=id=>{try{const value=JSON.parse(globalThis.document?.getElementById?.(id)?.textContent||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}};
export function replacementMap(){
 const result=new Map(),publicVideos=json('lc-public-video-data'),links=json('lc-public-video-replacements');
 for(const [from,to] of Object.entries({...links,...(remoteOwner===owner()?remote:{})}))if(valid(from)&&valid(to)&&from!==to&&!Object.hasOwn(publicVideos,from)&&Object.hasOwn(publicVideos,to))result.set(from,to);
 const members=globalThis.LightCityMembers,library=members?.loading===true?[]:members?.library||[],active=new Set(library.map(v=>v.id));
 for(const video of library)if(valid(video.id))for(const from of Array.isArray(video.replaces)?video.replaces:[])if(valid(from)&&from!==video.id&&!active.has(from))result.set(from,video.id);
 return result;
}
export async function resolveWatchReplacement(id){
 let map=replacementMap();if(map.has(id))return map.get(id);
 if(Object.hasOwn(json('lc-public-video-data'),id))return id;
 await globalThis.LightCityMembers?.ready;map=replacementMap();if(map.has(id))return map.get(id);if(globalThis.LightCityMembers?.library?.some(video=>video.id===id))return id;await loadRemoteReplacements();map=replacementMap();return map.get(id)||id;
}
