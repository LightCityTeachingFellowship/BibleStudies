// Member summaries use the normal summary template; only their body is private.
const placeholder=document.querySelector('[data-generated-summary]'),api=()=>globalThis.LightCityMembers;
if(placeholder){
 const id=placeholder.dataset.generatedSummary,main=placeholder.closest('main'),date=document.getElementById('archive-date');let epoch=0;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 async function load(){const ticket=++epoch;main.replaceChildren(placeholder);placeholder.textContent='Loading this member summary…';
  try{await api()?.ready;const {resource:r}=await api().learning({id});if(ticket!==epoch)return;if(r.kind!=='Summary')throw Error('This summary is not available.');
   const header=el('header'),border=el('div');border.className='leftBorderForArticleTitle';header.append(border);if(date)header.append(date);header.append(el('h1',r.title));main.replaceChildren(header);
   for(const s of r.sections){main.append(el('h2',s.heading));const list=el('ol');for(const p of s.points)list.append(el('li',p));main.append(list);}
   document.title=r.title+' | LightCity';if(typeof globalThis.replaceAllStrongsAndRefs==='function')globalThis.replaceAllStrongsAndRefs(main);
   window.dispatchEvent(new Event('lightcity-reading-rendered'));
  }catch(e){if(ticket!==epoch)return;placeholder.textContent=e.message||'This member summary could not load.';const retry=el('button','Retry');retry.type='button';retry.onclick=()=>void load();placeholder.append(retry);}
 }
 window.addEventListener('lightcity-members-changed',()=>void load());void load();
}
