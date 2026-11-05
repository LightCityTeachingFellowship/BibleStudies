import {mountAudioControls} from './audio-controls.mjs?v=archive-1';
const section=document.getElementById('message-archive');
import {archiveRequest} from './audio-archive-api.mjs';

if(section){
 const $=s=>section.querySelector(s),make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const grid=$('[data-archive-grid]'),search=$('[data-archive-search]'),group=$('[data-archive-group]'),status=$('[data-archive-status]'),more=$('[data-archive-more]'),panel=$('[data-archive-player]');
 let rows=[],limit=24,current,dispose,audio;
 const stamp=n=>{n=Math.floor(n||0);return(n>=3600?Math.floor(n/3600)+':':'')+String(Math.floor(n/60)%60).padStart(n>=3600?2:1,'0')+':'+String(n%60).padStart(2,'0');};
 function remember(){if(!audio||!current)return;try{localStorage.setItem('lc-archive-position:'+current.id,String(audio.currentTime||0));}catch{}}
 async function play(row){
  remember();audio?.pause();dispose?.();panel.replaceChildren();panel.hidden=false;current=row;
  const heading=make('h2',row.title),meta=make('p',[row.group,row.year,row.series].filter(Boolean).join(' · '));audio=make('audio');audio.controls=true;audio.dataset.archiveAudio='';audio.preload='metadata';panel.append(heading,meta,audio);panel.scrollIntoView({block:'center',behavior:'smooth'});
  const note=make('p','Loading audio…');panel.append(note);const selected=audio;
  try{const result=await archiveRequest({id:row.id});if(selected!==audio)return;audio.src=result.url;
   audio.addEventListener('loadedmetadata',()=>{try{const position=Number(localStorage.getItem('lc-archive-position:'+row.id));if(position>0&&position<audio.duration-5)audio.currentTime=position;}catch{}},{once:true});
   dispose=mountAudioControls(audio,{title:row.title,downloadAudio:()=>archiveRequest({id:row.id,download:true})});audio.addEventListener('pause',remember);audio.addEventListener('timeupdate',remember);
   audio.addEventListener('play',()=>{globalThis.LightCityMedia?.pauseOthers?.(audio);document.querySelectorAll('audio,video').forEach(other=>{if(other!==audio)other.pause();});if('mediaSession'in navigator){navigator.mediaSession.metadata=new MediaMetadata({title:row.title,artist:'LightCity Teaching Fellowship',album:'Older messages'});navigator.mediaSession.setActionHandler('play',()=>audio.play());navigator.mediaSession.setActionHandler('pause',()=>audio.pause());navigator.mediaSession.setActionHandler('seekto',e=>{audio.currentTime=e.seekTime;});}});
   const url=new URL(location.pathname,location.origin);url.searchParams.set('archive',row.id);history.replaceState(null,'',url);
   note.textContent='';await audio.play();
  }catch(e){if(selected===audio)note.textContent='Press Play to listen, or select this message again to retry.';}
 }
 function render(){const query=search.value.trim().toLocaleLowerCase(),filtered=rows.filter(r=>(!group.value||r.group===group.value)&&[r.title,r.year,r.series,r.group].join(' ').toLocaleLowerCase().includes(query));grid.replaceChildren();
  for(const row of filtered.slice(0,limit)){
   const card=make('article','', 'video-box lc-archive-card'),cover=make('button','', 'lc-archive-cover');cover.type='button';cover.setAttribute('aria-label','Listen to '+row.title);cover.append(make('span','LIGHTCITY · MESSAGE ARCHIVE'),make('strong',row.series||row.group),make('span',[row.year,stamp(row.durationSeconds)].filter(Boolean).join(' · ')));cover.onclick=()=>play(row);
   card.append(cover,make('h2',row.title,'video-title'),make('p',[row.group,row.year,row.series].filter(Boolean).join(' · ')));
   const actions=make('div','', 'lc-personal-row'),listen=make('button','Listen','lc-personal-remove'),copy=make('button','Copy link','lc-personal-remove');listen.type=copy.type='button';listen.onclick=()=>play(row);copy.onclick=async()=>{const url=new URL(location.pathname,location.origin);url.searchParams.set('archive',row.id);try{await navigator.clipboard.writeText(url.href);copy.textContent='Copied';}catch{status.textContent=url.href;}};actions.append(listen,copy);card.append(actions);grid.append(card);
  }
  status.textContent=filtered.length+' older messages'+(filtered.length>limit?' · Showing '+limit:'');more.hidden=filtered.length<=limit;
 }
 async function load(){status.textContent='Loading older messages…';try{rows=(await archiveRequest()).recordings||[];group.replaceChildren(new Option('All collections',''),...[...new Set(rows.map(r=>r.group))].sort().map(g=>new Option(g,g)));render();const id=new URLSearchParams(location.search).get('archive'),row=rows.find(r=>r.id===id);if(row)void play(row);}catch(e){status.textContent=e.message;}}
 search.oninput=group.onchange=()=>{limit=24;render();};more.onclick=()=>{limit+=24;render();};$('[data-archive-retry]').onclick=load;window.addEventListener('pagehide',remember);void load();
}
