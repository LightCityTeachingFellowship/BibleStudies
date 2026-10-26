// One audience-scoped live snapshot for library badges and personal progress labels.
let owner='',recordings=[],checkedAt=0,pending=null,revision=0;
const scope=()=>{const api=globalThis.LightCityMembers;return api?.loading?'loading':(api?.user?.uid||'public')+':'+Array.isArray(api?.library);};
const changed=()=>globalThis.window?.dispatchEvent?.(new Event('lightcity-live-status'));
function syncOwner(){const next=scope();if(next!==owner){owner=next;recordings=[];checkedAt=0;pending=null;revision++;changed();}return next;}
export function isLive(videoId){return owner===scope()&&Date.now()-checkedAt<90000&&recordings.some(r=>r.videoId===videoId&&r.kind==='live'&&r.replay!==true&&r.expiresAt>Date.now()&&/^session-\d{13}$/.test(r.session||''));}
export async function getLiveRecordings({force=false}={}){
 const api=globalThis.LightCityMembers;await api?.ready;const audience=syncOwner();
 if(!force&&checkedAt&&Date.now()-checkedAt<15000)return {recordings};if(pending)return pending;
 const ticket=revision;
 const request=(async()=>{try{const result=await (api?.getLiveAudio?.()||Promise.resolve({recordings:[]}));if(!Array.isArray(result?.recordings))throw Error('Invalid live catalogue');if(ticket===revision&&audience===scope()){recordings=result.recordings;checkedAt=Date.now();changed();}return result;}catch(error){if(ticket===revision)changed();throw error;}finally{if(ticket===revision)pending=null;}})();pending=request;return request;
}
export function refreshLiveStatus(){return getLiveRecordings().catch(()=>{});}
if(globalThis.window){globalThis.LightCityLiveStatus={getRecordings:getLiveRecordings,isLive};window.addEventListener?.('lightcity-members-changed',syncOwner);}
