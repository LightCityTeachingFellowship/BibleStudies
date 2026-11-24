// Build the compact Continue section from existing account-scoped progress.
export async function collectContinue({study,personal,catalogue,videos,isCurrent=()=>true}){
 const allowed=new Map((videos||[]).filter(v=>/^[A-Za-z0-9_-]{11}$/.test(v.id||'')).map(v=>[v.id,v]));
 const history=personal.rows('history').filter(row=>!row.completed&&row.seconds>5&&allowed.has(row.videoId)).map(row=>({type:'video',row,video:allowed.get(row.videoId),updatedAt:row.updatedAt||0}));
 const reading=study.store.rows('history').filter(row=>!row.completed&&(Number(row.section)>0||Number(row.fraction)>0)),wanted=new Map(reading.map(row=>[row.resourceId,row]));
 if(wanted.size){let count=0;for(const publication of catalogue?.publications||[]){if(!isCurrent())return[];const id=await study.idFor(publication.url);if(wanted.has(id)){const row=wanted.get(id);history.push({type:'reading',row,publication,updatedAt:row.updatedAt||0});wanted.delete(id);if(!wanted.size)break}if(++count%50===0)await new Promise(resolve=>setTimeout(resolve,0))}}
 return history.sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,4);
}
export function createContinueView({document,api,services}){
 const section=document.createElement('section'),heading=document.createElement('h2'),grid=document.createElement('div');heading.textContent='Continue…';grid.className='lc-v2-continue-grid';section.className='lc-v2-continue';section.hidden=true;const library=document.createElement('a');library.className='lc-v2-continue-library';library.href='/v2/library/';library.textContent='Open my study library →';section.append(heading,grid,library);let disposed=false,revision=0,personal,unsubscribe,scheduled=null,idle=false;
 async function refresh(){const ticket=++revision;try{
  const [study,module]=await Promise.all([services.getStudy(),import('/script/video-personal.js?v=search-1')]);personal=module.personal;await personal.ready;
  const state=services.session.state,videos=state.status==='member'?state.library:api.publicLibrary||[];
  const hasReading=study.store.rows('history').some(row=>!row.completed);const catalogue=hasReading?await services.resources.get('publications'):{publications:[]};
  const entries=await collectContinue({study,personal,catalogue,videos,isCurrent:()=>!disposed&&ticket===revision});if(disposed||ticket!==revision)return;
  grid.replaceChildren();for(const entry of entries){
   const card=document.createElement('article'),type=document.createElement('small'),title=document.createElement('a'),detail=document.createElement('span'),bar=document.createElement('progress');
   type.textContent=entry.type==='video'?(entry.row.mode==='audio'?'AUDIO':'VIDEO'):(entry.publication.kind||'READING').toUpperCase();title.className='lc-v2-continue-title';title.textContent=entry.type==='video'?(entry.video.title||entry.row.title||'LightCity recording'):entry.publication.title;
   bar.max=1;bar.value=entry.type==='video'?(Number(entry.row.duration)>0?Math.max(0,Math.min(1,Number(entry.row.seconds)/Number(entry.row.duration))):0):Math.max(0,Math.min(1,Number(entry.row.fraction)||0));bar.setAttribute('aria-label',entry.type==='video'?'Playback progress':'Reading progress');
   detail.textContent=entry.type==='video'?'Continue from '+module.timeLabel(entry.row.seconds):Math.round((entry.row.fraction||0)*100)+'% through this reading';card.append(type);
   if(entry.type==='video'){
    title.href='/v2/watch/';title.onclick=event=>{event.preventDefault();void services.openWatch({id:entry.row.videoId,mode:entry.row.mode==='audio'?'audio':'video',...(services.player.current?.id===entry.row.videoId?{}:{startSeconds:entry.row.seconds})}).catch(()=>{detail.textContent='Unable to open this recording.'})};detail.setAttribute('role','link');detail.tabIndex=0;detail.style.cursor='pointer';detail.onclick=()=>title.click();detail.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();title.click()}};card.append(title,bar,detail);
   }else{
    const target='/v2/read/?url='+encodeURIComponent(entry.publication.url),titleRow=document.createElement('div'),bookmark=document.createElement('button'),actions=document.createElement('div'),resume=document.createElement('a'),restart=document.createElement('a');titleRow.className='lc-v2-continue-title-row';bookmark.className='lc-v2-continue-bookmark';bookmark.type='button';bookmark.setAttribute('aria-label','Save '+title.textContent);bookmark.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 3.5h12v17l-6-4-6 4z"/></svg>';const updateBookmark=()=>bookmark.setAttribute('aria-pressed',String(study.store.saved(entry.row.resourceId)));updateBookmark();bookmark.onclick=()=>{study.save(entry.row.resourceId,!study.store.saved(entry.row.resourceId));updateBookmark()};title.href=target+'&continue=reading';titleRow.append(title,bookmark);actions.className='lc-v2-continue-actions';resume.href=title.href;resume.textContent='Continue reading';restart.href=target;restart.textContent='Start over';actions.append(resume,restart);card.append(titleRow,bar,detail,actions);
   }
   grid.append(card)
  }section.hidden=!entries.length;
 }catch{if(!disposed&&ticket===revision)section.hidden=true}}
 const changed=()=>{if(disposed||scheduled!==null)return;const run=()=>{scheduled=null;void refresh()};idle=typeof window.requestIdleCallback==='function';scheduled=idle?window.requestIdleCallback(run,{timeout:4000}):window.setTimeout(run,300)};
 return {element:section,activate(){window.addEventListener('lightcity-publications-updated',changed);window.addEventListener('lightcity-study-changed',changed);window.addEventListener('lightcity-video-activity',changed);unsubscribe=services.session.subscribe(()=>{section.hidden=true;grid.replaceChildren();++revision;changed()})},dispose(){disposed=true;++revision;unsubscribe?.();if(scheduled!==null){if(idle)window.cancelIdleCallback(scheduled);else window.clearTimeout(scheduled)}window.removeEventListener('lightcity-publications-updated',changed);window.removeEventListener('lightcity-study-changed',changed);window.removeEventListener('lightcity-video-activity',changed)}};
}
