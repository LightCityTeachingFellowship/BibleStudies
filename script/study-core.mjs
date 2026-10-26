export function resourcePath(value, origin='https://lightcityfellowship.com') {
  try { const u=new URL(value,origin);if(u.origin!==new URL(origin).origin||!u.pathname.startsWith('/')||/%2f|%5c/i.test(u.pathname))return null;return decodeURI(u.pathname).normalize('NFC'); } catch{return null;}
}
export async function resourceId(path){const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(path));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}
export const validResourceId=id=>/^[a-f0-9]{64}$/.test(id||'');
export function readingPosition(sections, viewportTop) {
  if(!sections.length)return {fraction:0,section:0};
  let index=0;for(let i=0;i<sections.length;i++)if(sections[i].top<=viewportTop)index=i;
  return {fraction:Math.min(1,Math.max(0,index/Math.max(1,sections.length-1))),section:index};
}
export function relatedResources(current, entries, videos) {
  const words=s=>new Set(String(s||'').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(w=>!/^\d+$/.test(w)&&!new Set(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec','the','and','for','with','from','lightcity','teaching','fellowship','program','study','reading','summary','meeting','prayer','worship','sun','mon','tue','wed','thu','fri','sat']).has(w))||[]);
  const own=words(current.title), explicit=new Set(current.videoIds||[]), group=current.studyId;
  const scored=entries.filter(e=>e.id!==current.id).map(e=>({entry:e,score:(group&&group===e.studyId?100:0)+(e.videoIds?.some(id=>explicit.has(id))?100:0)+[...words(e.title)].filter(w=>own.has(w)).length})).filter(r=>r.score>=2).sort((a,b)=>b.score-a.score).slice(0,4);
  const media=[...videos].map(([id,title])=>({id,title,score:explicit.has(id)?100:[...words(title)].filter(w=>own.has(w)).length})).filter(v=>v.score>=3).sort((a,b)=>b.score-a.score).slice(0,3);
  return {reading:scored,media};
}
