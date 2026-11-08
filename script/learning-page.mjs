const api=()=>globalThis.LightCityMembers;
const root=document.getElementById('learning-resource'),status=document.getElementById('learning-status');
const params=new URL(location.href).searchParams,id=params.get('id'),preview=params.get('preview')==='1';
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
let epoch=0;const dateNode=document.getElementById('archive-date');
function references(){if(typeof globalThis.replaceAllStrongsAndRefs==='function')globalThis.replaceAllStrongsAndRefs(root);}
window.addEventListener('load',references,{once:true});
document.getElementById('summary-copy-link').onclick=async()=>{try{const url=new URL(location.href);url.searchParams.delete('continue');await navigator.clipboard.writeText(url.href);status.textContent='Link copied.';}catch{status.textContent='Copy the address from your browser.';}};
async function load(){
 const ticket=++epoch;root.replaceChildren();root.setAttribute('aria-busy','true');status.textContent='Loading this summary…';
 dateNode.textContent='';document.getElementById('summary-navigation').hidden=true;
 try{
  await api()?.ready;
  const {resource:r}=await api().learning({id,...(preview?{preview:true}:{})});if(ticket!==epoch)return;
  if(!preview&&r.url&&!new URL(r.url,location.origin).search&&new URL(r.url,location.origin).pathname!==location.pathname){location.replace(r.url);return;}
  if(r.kind==='Quiz'){location.replace('/TeachingQuiz/?id='+encodeURIComponent(id)+(preview?'&preview=1':''));return;}
  if(r.kind!=='Summary')throw Error('This summary is not available.');
  status.textContent=preview?'Private preview · not published · no notifications.':'';
  document.title=r.title+' | LightCity';
  const header=el('header'),border=el('div');border.className='leftBorderForArticleTitle';header.append(border,dateNode,el('h1',r.title));root.append(header);
  for(const s of r.sections||[]){root.append(el('h2',s.heading));const list=el('ul');for(const p of s.points)list.append(el('li',p));root.append(list);}
  if(r.teachingDate){const date=new Date(r.teachingDate+'T12:00:00Z');if(Number.isFinite(date.getTime()))dateNode.textContent=new Intl.DateTimeFormat('en-GB',{weekday:'short',month:'short',day:'2-digit',year:'2-digit',timeZone:'Africa/Lagos'}).format(date)+'.';}
  let links=[];try{links=JSON.parse(document.getElementById('summary-category-links').textContent);}catch{}
  const cats=document.getElementById('summary-categories');cats.replaceChildren();
  for(const category of r.categories||[]){const match=links.find(link=>link.name===category);const n=el(match?'a':'span',category);n.className='cat-link ArtSumCatName';if(match)n.href=match.url;cats.append(n);}
  document.getElementById('summary-navigation').hidden=false;references();
 }catch(e){if(ticket!==epoch)return;status.textContent=e.message||'This summary could not load.';const retry=el('button','Retry');retry.type='button';retry.onclick=()=>void load();status.append(retry);}
 finally{if(ticket===epoch)root.setAttribute('aria-busy','false');}
}
window.addEventListener('lightcity-members-changed',()=>void load());void load();
