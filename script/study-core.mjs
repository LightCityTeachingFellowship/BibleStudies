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
// Match explicit calendar days without Date.parse locale rules or timezone shifts.
export function contentDates(...values) {
  const dates=new Set();
  const add=(year,month,day)=>{year=Number(year);month=Number(month);day=Number(day);if(year<1000||year>2999||month<1||month>12||day<1||day>31)return;const value=new Date(Date.UTC(year,month-1,day));if(value.getUTCFullYear()===year&&value.getUTCMonth()===month-1&&value.getUTCDate()===day)dates.add(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`);};
  const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const month='(January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sept|Sep|October|Oct|November|Nov|December|Dec)\\.?';
  for(const value of values){if(typeof value!=='string')continue;
    for(const match of value.matchAll(/\b([12]\d{3})-(\d{2})-(\d{2})(?=T\d{2}:|\b)/g))add(match[1],match[2],match[3]);
    for(const match of value.matchAll(new RegExp('\\b'+month+'\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+)([12]\\d{3})\\b','gi')))add(match[3],months.indexOf(match[1].slice(0,3).toLowerCase())+1,match[2]);
    for(const match of value.matchAll(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+'+month+'(?:,?\\s+)([12]\\d{3})\\b','gi')))add(match[3],months.indexOf(match[2].slice(0,3).toLowerCase())+1,match[1]);
  }
  return dates;
}
export function relatedResources(current, entries, videos) {
  const ignored=new Set('jan january feb february mar march apr april may jun june jul july aug august sep sept september oct october nov november dec december the and for with from lightcity teaching fellowship program study reading summary meeting prayer worship sun sunday mon monday tue tuesday wed wednesday thu thursday fri friday sat saturday'.split(' '));
  const words=s=>new Set(String(s||'').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(w=>!/^\d+$/.test(w)&&!ignored.has(w))||[]);
  const own=words(current.title),explicit=new Set(current.videoIds||[]),group=current.studyId,dates=contentDates(current.date,current.title);
  const videoDates=new Map([...videos].map(([id,title])=>[id,contentDates(title)]));
  for(const id of explicit)for(const day of videoDates.get(id)||[])dates.add(day);
  const sameDate=days=>[...days].some(day=>dates.has(day));
  const ranked=(item,linked,days)=>{const byDate=sameDate(days);return {...item,score:linked+(byDate?20:0)+[...words(item.title||item.entry?.title)].filter(w=>own.has(w)).length,reason:linked>0?'explicit':byDate?'date':'title'};};
  const scored=entries.filter(e=>e.id!==current.id).map(e=>ranked({entry:e},(group&&group===e.studyId?100:0)+(e.videoIds?.some(id=>explicit.has(id))?100:0),contentDates(e.date,e.title))).filter(r=>r.score>=2).sort((a,b)=>b.score-a.score).slice(0,4);
  const media=[...videos].map(([id,title])=>ranked({id,title},explicit.has(id)?100:0,videoDates.get(id))).filter(v=>v.score>=3).sort((a,b)=>b.score-a.score).slice(0,3);
  return {reading:scored,media};
}
