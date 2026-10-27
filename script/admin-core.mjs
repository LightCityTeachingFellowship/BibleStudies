import {videoShareLink} from './share-links.mjs?v=1';
const origin='https://lightcityfellowship.com';
const validId=id=>/^[\w-]{11}$/.test(id||'');
export function streamId(value){
 const text=String(value||'').trim();if(validId(text))return text;
 try{const u=new URL(text);if(u.protocol!=='https:'||u.username||u.password)return null;
  const host=u.hostname.toLowerCase();if(!['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be'].includes(host))return null;
  const id=host.endsWith('youtu.be')?u.pathname.split('/')[1]:u.pathname==='/watch'?u.searchParams.get('v'):/^\/(live|embed|shorts)\//.test(u.pathname)?u.pathname.split('/')[2]:null;
  return validId(id)?id:null;
 }catch{return null;}
}
export function watchLink(id,audio=false){if(!validId(id))return null;return origin+(audio?'/Listen/?v=':'/Watch/?v=')+id;}
export function siteLink(path){try{const url=new URL(path,origin);return url.origin===origin&&!/%2f|%5c/i.test(url.pathname)?url.href:null;}catch{return null;}}
export function dashboardRows(data){
 const rows=(data.videos||[]).filter(v=>validId(v.id)).map(v=>({...v,kind:'Video',url:watchLink(v.id),shareUrl:videoShareLink(v.id)}));
 for(const r of data.readings||[])if(['Article','Summary'].includes(r.kind)&&siteLink(r.url))rows.push({...r,url:siteLink(r.url),published:true});
 for(const [title,path]of [['Home','/Home/'],['Video library','/Videos/'],['Audio library','/Listen/'],['Articles','/Teaching-Articles/'],['Summaries','/teaching-summary/']])rows.push({title,url:siteLink(path),kind:'Page',visibility:'public',published:true});
 return rows;
}
export function filterRows(rows,tab='All',query=''){
 const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const words=normal(query).split(/\s+/).filter(Boolean);
 return rows.filter(r=>tab==='All'||tab==='Audio'&&r.audio&&r.published||tab==='Live'&&r.live||tab==='Pending'&&!r.published||r.kind===tab).filter(r=>words.every(w=>normal([r.title,r.id,r.date,r.visibility].join(' ')).includes(w)));
}

export const previewLink=(id,audio=false)=>videoShareLink(id,{audio});
