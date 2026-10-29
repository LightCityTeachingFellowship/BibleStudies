import {audioLibrary,filterAudio,audioCategories} from './audio-library-core.mjs?v=daily-titles-1';
const page=document.getElementById('audio-library-page');
if(page){
 const byId=id=>document.getElementById(id),grid=byId('videotab-container'),status=byId('audio-library-status'),search=byId('audio-library-search'),more=byId('audio-library-more'),retry=byId('audio-library-retry');
 const publicVideos=JSON.parse(byId('audio-public-videos')?.textContent||'[]');
 const cards=new Map(),controllers=new Map();let recordings=[],live=[],rows=[],category='all',limit=24,generation=0,audience='',requestedApplied=false,errors=[];
 const requested=new URL(location.href).searchParams.get('v');
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 function stopAll(){for(const c of controllers.values())c.dispose();controllers.clear();cards.clear();grid.replaceChildren();recordings=[];live=[];rows=[];requestedApplied=false;}
 function card(recording){let item=cards.get(recording.videoId);if(item){item.recording=recording;item.title.textContent=recording.title;item.card.setAttribute('video-title',recording.title);const controller=controllers.get(recording.videoId);controller?.updateRecording?.(recording);if(controller?.liveSession&&recording.kind==='live'&&controller.liveSession!==recording.session){controller.dispose();controllers.delete(recording.videoId);}return item;}
  const card=node('article','', 'video-box lc-audio-card homeResources-grid-containter bg-color');card.dataset.videoId=recording.videoId;card.setAttribute('video-title',recording.title);
  const viewport=node('div','', 'iframe-container lc-audio-art');const preview=node('button','', 'lc-audio-preview');preview.type='button';preview.setAttribute('aria-label','Play audio: '+recording.title);const image=node('img');image.src='https://i.ytimg.com/vi/'+recording.videoId+'/hqdefault.jpg';image.alt='';image.loading='lazy';preview.appendChild(image);preview.appendChild(node('span','♫','lc-audio-play'));viewport.appendChild(preview);card.appendChild(viewport);
  const badge=node('span','', 'lc-audio-badge');card.appendChild(badge);const title=node('h3',recording.title,'video-title');card.appendChild(title);
  const actions=node('div','', 'lc-video-actions');actions.setAttribute('role','group');actions.setAttribute('aria-label','Playback mode');const buttons={};for(const [mode,label]of [['video','Watch'],['audio','Listen']]){const button=node('button',label,'lc-mode-button');button.type='button';button.dataset.mediaMode=mode;button.setAttribute('aria-pressed','false');button.onclick=()=>void choose(recording.videoId,mode);buttons[mode]=button;actions.appendChild(button);}card.appendChild(actions);
  const feedback=node('p','', 'lc-mode-feedback');feedback.setAttribute('role','status');feedback.hidden=true;card.appendChild(feedback);
  item={card,viewport,title,badge,buttons,feedback,recording};cards.set(recording.videoId,item);preview.onclick=()=>void choose(recording.videoId,'audio');return item;
 }
 async function choose(id,mode,checkpoint){const item=cards.get(id),recording=rows.find(r=>r.videoId===id),owner=audience;if(!item||!recording)return;
  if(!globalThis.LightCityMedia){item.feedback.textContent='Playback controls are loading. Try again shortly.';item.feedback.hidden=false;return;}
  let controller=controllers.get(id);if(!controller){controller=LightCityMedia.mount({viewport:item.viewport,videoId:id,title:recording.title,recording,onState:(current,message)=>{if(owner!==audience||cards.get(id)!==item)return;for(const [key,button]of Object.entries(item.buttons))button.setAttribute('aria-pressed',String(key===current));item.feedback.textContent=message||'';item.feedback.hidden=!message;globalThis.LightCityDurations?.set(item.viewport,recording.durationSeconds,{live:recording.kind==='live'&&!recording.replay});}});controllers.set(id,controller);}
  try{if(checkpoint&&controller.restoreListening)await controller.restoreListening(checkpoint);else await controller.switchTo(mode);if(owner!==audience||controllers.get(id)!==controller)return;if(mode==='audio'&&!checkpoint){try{await controller.audio.play();}catch{item.feedback.textContent='Tap Play on the audio player to begin.';item.feedback.hidden=false;}}}
  catch{if(owner===audience&&cards.get(id)===item){item.feedback.textContent='Playback could not start. Please try again.';item.feedback.hidden=false;}}
 }
 function render(){rows=audioLibrary({publicVideos:globalThis.LightCityMembers?.publicLibrary || publicVideos,memberVideos:globalThis.LightCityMembers?.library,recordings,live});const allowed=new Set(rows.map(r=>r.videoId));
  for(const [id,item]of cards)if(!allowed.has(id)){controllers.get(id)?.dispose();controllers.delete(id);item.card.remove();cards.delete(id);}
  const filtered=filterAudio(rows,search.value,category),visible=filtered.slice(0,limit);const shown=new Set(visible.map(r=>r.videoId));for(const [id,item]of cards)item.card.hidden=!shown.has(id);
  visible.forEach((r,i)=>{const item=card(r);item.card.hidden=false;item.badge.hidden=r.kind!=='live';item.badge.textContent=r.kind==='live'?(r.replay?'Audio replay':'LIVE'):'';item.badge.className='lc-audio-badge'+(r.kind==='live'&&!r.replay?' lc-audio-live':'');globalThis.LightCityDurations?.set(item.viewport,r.durationSeconds,{live:r.kind==='live'&&!r.replay});if(grid.children[i]!==item.card)grid.insertBefore(item.card,grid.children[i]||null);});
  more.hidden=filtered.length<=limit;retry.hidden=!errors.length;
  status.textContent=rows.length?`${filtered.length} matching recordings · Showing ${visible.length} of ${filtered.length}.`:'No audio is available for this selection yet.';
  if(!search.value&&category==='all')status.textContent=`${rows.length} audio recordings available · Showing ${visible.length}. Other videos will appear as their audio becomes available.`;
  if(errors.length)status.textContent=(rows.length?'Your available recordings are shown. ':'')+errors.join(' ');status.hidden=rows.length>0&&!search.value&&category==='all'&&!errors.length;
  if(requested&&!requestedApplied&&allowed.has(requested)){requestedApplied=true;const found=filtered.findIndex(r=>r.videoId===requested);if(found>=limit){limit=Math.ceil((found+1)/24)*24;render();return;}void choose(requested,'audio');}
 }
 async function refresh(){const ticket=++generation;const api=globalThis.LightCityMembers;const next=api?.loading?'loading':Array.isArray(api?.library)?'member:'+(api.user?.uid||''):'public';
  if(audience!==next){stopAll();audience=next;}if(api?.loading){status.textContent='Loading your audio library…';await api.ready;if(ticket!==generation)return;return refresh();}
  errors=[];render();status.textContent=rows.length?status.textContent:'Loading your audio library…';
  const sources=[()=>api.getAudio(),()=>(globalThis.LightCityLiveStatus?.getRecordings?.() || api.getLiveAudio?.())||Promise.resolve({recordings:[]})];
  await Promise.allSettled(sources.map(async (load,i)=>{try{const result=await load();if(ticket!==generation)return;if(!Array.isArray(result.recordings))throw Error('Invalid audio catalogue');if(i===0)recordings=result.recordings;else live=result.recordings;render();}catch(error){if(ticket!==generation)return;const code=String(error?.code||'');if(/permission-denied|unauthenticated|user-disabled|user-token-expired/.test(code)){++generation;stopAll();status.textContent='Your access changed. Reload the audio library to continue.';retry.hidden=false;return;}errors.push(i===0?'Recorded audio could not refresh.':'Live audio could not refresh.');render();}}));
  if(ticket!==generation)return;
  render();
  const checkpoint=globalThis.LightCityMedia?.savedListening?.();if(checkpoint&&!requestedApplied&&rows.some(r=>r.videoId===checkpoint.videoId)){requestedApplied=true;const index=rows.findIndex(r=>r.videoId===checkpoint.videoId);limit=Math.max(limit,Math.ceil((index+1)/24)*24);render();void choose(checkpoint.videoId,'audio',checkpoint);}
 }
 for(const [value,label]of [['all','All'],...Object.entries(audioCategories)]){const button=node('button',label,'videos-header-btns'+(value==='all'?' active':''));button.type='button';button.dataset.audioCategory=value;button.setAttribute('aria-pressed',String(value==='all'));button.onclick=()=>{category=value;limit=24;for(const other of byId('audio-library-categories').children){other.setAttribute('aria-pressed',String(other===button));other.className='videos-header-btns'+(other===button?' active':'');}render();};byId('audio-library-categories').appendChild(button);}
 search.form?.addEventListener('submit',event=>event.preventDefault());
 search.addEventListener('input',()=>{limit=24;render();});more.onclick=()=>{limit+=24;render();};retry.onclick=()=>void refresh();
 window.addEventListener('lightcity-durations-ready',render);window.addEventListener('lightcity-members-changed',()=>void refresh());window.addEventListener('online',()=>void refresh());window.addEventListener('pagehide',e=>{if(!e.persisted)stopAll();});
 const timer=setInterval(()=>{if(document.visibilityState!=='hidden')void refresh();},45000);timer.unref?.();void refresh();
}
