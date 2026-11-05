import {mountAudioControls} from './audio-controls.mjs?v=archive-1';
const section=document.getElementById('message-archive');
import {archiveRecordings, archiveRequest} from './audio-archive-api.mjs?v=collections-1';

if(section){
 const $=s=>section.querySelector(s),make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const grid=$('[data-archive-grid]'),search=$('[data-archive-search]'),group=$('[data-archive-group]'),status=$('[data-archive-status]'),more=$('[data-archive-more]'),panel=$('[data-archive-player]');
 const seriesSection=$('[data-archive-series]'),seriesList=$('[data-archive-series-list]');
 const order=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
 let rows=[],limit=24,current,dispose,audio,selectedSeries='';
 let transcripts={};
 try{transcripts=JSON.parse(document.getElementById('archive-transcripts').textContent)||{};}catch{}

 function renderSeries(){
  const counts=new Map();
  for(const row of rows){
   if(row.series&&(!group.value||row.group===group.value))counts.set(row.series,(counts.get(row.series)||0)+1);
  }
  if(!counts.has(selectedSeries))selectedSeries='';
  seriesSection.hidden=!counts.size;
  seriesList.replaceChildren();
  for(const [name,count] of [['',null],...[...counts].sort(([a],[b])=>order.compare(a,b))]){
   const button=make('button',name ? name+' ('+count+')' : 'All series','lc-personal-remove');
   button.type='button';
   button.setAttribute('aria-pressed',String(name===selectedSeries));
   button.onclick=()=>{
    selectedSeries=name;limit=24;
    for(const item of seriesList.children)item.setAttribute('aria-pressed',String(item===button));
    render();
   };
   seriesList.append(button);
  }
 }

 function addTranscript(row){
  const text=transcripts[row.id];
  if(typeof text!=='string'||!text.trim())return;
  const transcript=make('details','', 'lc-archive-transcript');
  transcript.append(make('summary','Read transcript'),make('p',text));
  panel.append(transcript);
 }
 const stamp=n=>{n=Math.floor(n||0);return(n>=3600?Math.floor(n/3600)+':':'')+String(Math.floor(n/60)%60).padStart(n>=3600?2:1,'0')+':'+String(n%60).padStart(2,'0');};
 function remember(){if(!audio||!current)return;try{localStorage.setItem('lc-archive-position:'+current.id,String(audio.currentTime||0));}catch{}}
 async function play(row){
  remember();audio?.pause();dispose?.();panel.replaceChildren();panel.hidden=false;current=row;
  const heading=make('h2',row.title),meta=make('p',[row.group,row.year,row.series].filter(Boolean).join(' · '));audio=make('audio');audio.controls=true;audio.dataset.archiveAudio='';audio.preload='metadata';panel.append(heading,meta,audio);panel.scrollIntoView({block:'center',behavior:'smooth'});
  const note=make('p','Loading audio…');panel.append(note);addTranscript(row);const selected=audio;
  try{const result=await archiveRequest({id:row.id});if(selected!==audio)return;audio.src=result.url;
   audio.addEventListener('loadedmetadata',()=>{try{const position=Number(localStorage.getItem('lc-archive-position:'+row.id));if(position>0&&position<audio.duration-5)audio.currentTime=position;}catch{}},{once:true});
   dispose=mountAudioControls(audio,{title:row.title,downloadAudio:()=>archiveRequest({id:row.id,download:true})});audio.addEventListener('pause',remember);audio.addEventListener('timeupdate',remember);
   audio.addEventListener('play',()=>{globalThis.LightCityMedia?.pauseOthers?.(audio);document.querySelectorAll('audio,video').forEach(other=>{if(other!==audio)other.pause();});if('mediaSession'in navigator){navigator.mediaSession.metadata=new MediaMetadata({title:row.title,artist:'LightCity Teaching Fellowship',album:'Older messages'});navigator.mediaSession.setActionHandler('play',()=>audio.play());navigator.mediaSession.setActionHandler('pause',()=>audio.pause());navigator.mediaSession.setActionHandler('seekto',e=>{audio.currentTime=e.seekTime;});}});
   const url=new URL(location.pathname,location.origin);url.searchParams.set('archive',row.id);history.replaceState(null,'',url);
   note.textContent='';await audio.play();
  }catch(e){if(selected===audio)note.textContent='Press Play to listen, or select this message again to retry.';}
 }
 function render(){const query=search.value.trim().toLocaleLowerCase(),filtered=rows.filter(r=>(!group.value||r.group===group.value)&&(!selectedSeries||r.series===selectedSeries)&&[r.title,r.year,r.series,r.group].join(' ').toLocaleLowerCase().includes(query));grid.replaceChildren();
  if(selectedSeries)filtered.sort((a,b)=>order.compare(a.title,b.title));
  for(const row of filtered.slice(0,limit)){
   const card=make('article','', 'video-box lc-archive-card'),cover=make('button','', 'lc-archive-cover');cover.type='button';cover.setAttribute('aria-label','Listen to '+row.title);cover.append(make('span','LIGHTCITY · MESSAGE ARCHIVE'),make('strong',row.series||row.group),make('span',[row.year,stamp(row.durationSeconds)].filter(Boolean).join(' · ')));cover.onclick=()=>play(row);
   card.append(cover,make('h2',row.title,'video-title'),make('p',[row.group,row.year,row.series].filter(Boolean).join(' · ')));
   const actions=make('div','', 'lc-personal-row'),listen=make('button','Listen','lc-personal-remove'),copy=make('button','Copy link','lc-personal-remove');listen.type=copy.type='button';listen.onclick=()=>play(row);copy.onclick=async()=>{const url=new URL(location.pathname,location.origin);url.searchParams.set('archive',row.id);try{await navigator.clipboard.writeText(url.href);copy.textContent='Copied';}catch{status.textContent=url.href;}};actions.append(listen,copy);card.append(actions);grid.append(card);
  }
  status.textContent=filtered.length+' older messages'+(filtered.length>limit?' · Showing '+limit:'');more.hidden=filtered.length<=limit;
 }
 async function load({refresh=false,openLinked=false}={}){
  status.textContent='Loading older messages…';
  try{
   rows=await archiveRecordings({refresh});
   const previousGroup=group.value;
   group.replaceChildren(new Option('All collections',''),...[...new Set(rows.map(row=>row.group).filter(Boolean))].sort().map(name=>new Option(name,name)));
   if([...group.options].some(option=>option.value===previousGroup))group.value=previousGroup;
   renderSeries();
   render();
   if(openLinked&&!current){
    const id=new URLSearchParams(location.search).get('archive');
    const row=rows.find(recording=>recording.id===id);
    if(row)void play(row);
   }
  }catch(error){status.textContent=error.message;}
 }
 search.oninput=()=>{limit=24;render();};
 group.onchange=()=>{limit=24;renderSeries();render();};
 more.onclick=()=>{limit+=24;render();};
 $('[data-archive-retry]').onclick=()=>load({refresh:true,openLinked:true});
 window.addEventListener('pagehide',remember);void load({openLinked:true});
}
