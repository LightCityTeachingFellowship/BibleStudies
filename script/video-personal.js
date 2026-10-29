import {libraryMenu} from './library-menu.mjs?v=3';
import {replacementMap,loadRemoteReplacements} from './video-replacements.mjs?v=automatic-1';
import {isLive,refreshLiveStatus} from './live-status.mjs';
import { createVideoStore, resumeSeconds } from './video-personal-store.mjs?v=replacements-1';
const browser = typeof window !== 'undefined' && typeof document !== 'undefined';
const emit = () => { if (browser) window.dispatchEvent?.(new Event('lightcity-video-activity')); };
let storage; try { storage = globalThis.localStorage; } catch {}
export const personal = createVideoStore({ storage, changed: emit });
let revision = 0, syncing = false, refreshPromise = Promise.resolve(), syncMessage = '', active = false;
let cursors = {saved:null,history:null};
function publicData() { try { return JSON.parse(document.getElementById?.('lc-public-video-data')?.textContent || '{}'); } catch { return {}; } }
export function visibleVideos() {
  const result = new Map(Object.entries(browser ? publicData() : {}).map(([id,title]) => [id, title || id]));
  for (const v of globalThis.LightCityMembers?.library || []) result.set(v.id, v.title || v.id);
  return result;
}
const titleFor = (id, fallback) => { const value = visibleVideos().get(id); return value && value !== id ? value : fallback || id; };
async function flush() {
  if (syncing || !personal.signedIn || !personal.pending().length) return;
  const api = globalThis.LightCityMembers, owner = personal.scope;
  if (!api?.updateVideoActivity) return;
  syncing = true; let completed=false;
  try {
    for (const [key, op] of personal.pending()) {
      if (personal.scope !== owner) break;
      let result; do { result = await api.updateVideoActivity({...op,accountUid:owner.slice(5)}); } while (op.action === 'clearHistory' && result.more && personal.scope === owner);
      if (personal.scope === owner) personal.acknowledge(key,op);
    }
    if (personal.scope === owner) {syncMessage = 'Saved to your account.';completed=true;}
  } catch { if (personal.scope === owner) syncMessage = 'Saved on this device. Account sync will retry when available.'; }
  finally { syncing = false; emit(); if(completed&&personal.scope===owner&&personal.pending().length)queueMicrotask(()=>void flush()); }
}
async function refresh() {
  const ticket = ++revision;
  const initial = globalThis.LightCityMembers;
  if (!initial?.loading) personal.setIdentity(initial?.user && !initial.user.isAnonymous ? initial.user.uid : null);
  await globalThis.LightCityMembers?.ready;void refreshLiveStatus();
  if (ticket !== revision) return;
  const user = globalThis.LightCityMembers?.user;
  personal.setIdentity(user && !user.isAnonymous ? user.uid : null);
  const owner = personal.scope;
  await loadRemoteReplacements();if(owner!==personal.scope||ticket!==revision)return;personal.replaceSaved(replacementMap(),id=>titleFor(id));
  if (!personal.signedIn || !globalThis.LightCityMembers?.getVideoActivity) { syncMessage = 'Saved on this device. Sign in to sync across devices.'; emit(); return; }
  await flush();
  try {
    const watchId = document.getElementById?.('watch-personal-actions') && new URLSearchParams(location.search).get('v');
    if (watchId && visibleVideos().has(watchId)) {
      const point = await globalThis.LightCityMembers.getVideoActivity({videoId:watchId,accountUid:owner.slice(5)});
      if(owner!==personal.scope||ticket!==revision)return;
      personal.acceptSaved(watchId,point.saved,titleFor(watchId)); if(point.history)personal.acceptHistory(point.history);
      syncMessage='Saved videos and history sync with your account.';emit();return;
    }
    const searchOnly=!['videotab-container','watch-personal-actions','my-video-list','audio-pilot-page','study-continue-title'].some(id=>document.getElementById?.(id))||!!document.querySelector?.('.home-featured[data-video-id]');
    for (const view of searchOnly?['saved']:['saved','history']) {
      const rows = []; let cursor = null, pages = 0;
      do {
        const page = await globalThis.LightCityMembers.getVideoActivity({ view, accountUid:owner.slice(5), ...(cursor ? { cursor } : {}) });
        if (owner !== personal.scope || ticket !== revision) return;
        if (!Array.isArray(page.rows)) throw Error('Invalid activity response');
        rows.push(...page.rows); cursor = page.cursor;
      } while (cursor && view==='saved' && !document.getElementById?.('my-video-list') && ++pages < 30);
      cursors[view]=cursor;personal.hydrate(view,rows);
    }
    syncMessage = 'Saved videos and history sync with your account.';
  } catch { syncMessage = 'Saved on this device. Account sync will retry when available.'; }
  emit();
}
personal.ready = Promise.resolve();
personal.forVideo = async id => {
  await Promise.race([personal.ready, new Promise(done => { const timer = setTimeout(done,1500); timer.unref?.(); })]);
  if (!visibleVideos().has(id)) return null;
  if (personal.history(id) || !personal.signedIn) return personal.history(id);
  const owner = personal.scope;
  try { const result = await globalThis.LightCityMembers.getVideoActivity({ videoId:id, accountUid:owner.slice(5) }); if (personal.scope === owner && result.history) personal.acceptHistory(result.history); } catch {}
  return owner === personal.scope ? personal.history(id) : null;
};
personal.resume = id => resumeSeconds(personal.history(id));
personal.record = (row, owner = personal.scope) => { if (owner === personal.scope && visibleVideos().has(row.videoId)) personal.progress({ ...row, title: titleFor(row.videoId,row.title) }); };
personal.flush = flush;
personal.attachAudio = item => {
  const owner = personal.scope; let played = false, last = 0, disposed = false;
  const listeners=[];
  const on=(event,fn)=>{item.audio.addEventListener(event,fn);listeners.push(()=>item.audio.removeEventListener(event,fn));};
  const save = () => {
    if (!played || disposed || item.mode !== 'audio') return;
    const offset = item.liveOffset || 0;
    personal.record({ videoId:item.videoId, title:item.title, seconds:Math.max(0,item.audio.currentTime-offset), duration:item.liveSession&&!item.liveReplay?0:Number.isFinite(item.audio.duration)?Math.max(0,item.audio.duration-offset):0, rate:item.audio.playbackRate, mode:'audio', completed:item.audio.ended },owner);
  };
  on('play', () => { played = true; save(); });
  on('timeupdate', () => { if (Date.now()-last > 5000) { last=Date.now(); save(); } });
  for (const event of ['pause','ended','seeked']) on(event,()=>{save();if(event!=='seeked')void flush();});
  const dispose = item.dispose; item.dispose = () => { if(disposed)return;save();disposed=true;listeners.forEach(remove=>remove());dispose.call(item); };
};
function node(tag, text, className) { const n=document.createElement(tag); if(text)n.textContent=text; if(className)n.className=className; return n; }
let pageView='saved', renderScheduled=false;
function schedule() { if(renderScheduled)return; renderScheduled=true; queueMicrotask(()=>{renderScheduled=false; render();}); }
function watchUrl(id,row,startOver=false) {
  const base=document.querySelector('script[data-lightcity-personal]')?.dataset.base || '/';
  const url=new URL(base+'Watch/',location.href); url.searchParams.set('v',id);
  if(row?.mode==='audio')url.searchParams.set('mode','audio');
  if(startOver)url.searchParams.set('t','0'); else if(resumeSeconds(row))url.searchParams.set('t',String(Math.floor(row.seconds)));
  return url.href;
}
export function timeLabel(seconds) { const s=Math.max(0,Math.floor(seconds || 0)); return s>=3600 ? `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
function saveButton(holder,id,title) {
  let button=holder._lcSaveButton || holder.querySelector?.('.lc-save-video');
  if(!button) {
    button=node('button','', 'lc-save-video');button.type='button';
    button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3.5h12v17l-6-4-6 4z"/></svg>';
  }
  holder._lcSaveButton=button;
  button.onclick=event=>{
    event?.preventDefault();event?.stopPropagation();
    personal.save(id,titleFor(id,holder.getAttribute?.('video-title') || title),!personal.saved(id));void flush();
  };
  const saved=personal.saved(id), audio=holder.className?.split(' ').includes('lc-audio-card'), label=saved?(audio?'Remove from saved audio':'Remove from saved videos'):(audio?'Save audio for later':'Save video for later');
  button.disabled=globalThis.LightCityMembers?.loading===true;
  button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',label);button.title=label;
  const menuLabel=button.querySelector?.('.lc-save-label');if(menuLabel)menuLabel.textContent=label;
  return button;
}
function decorate(holder,id,title,search=false) {
  if(!visibleVideos().has(id))return;
  const button=saveButton(holder,id,title);
  if(search) {if(button.parentNode!==holder)holder.appendChild(button);return;}
  const heading=holder.querySelector?.('.video-title') || holder.querySelector?.('.home-video-title') || (holder===document.getElementById?.('watch-personal-actions')?document.getElementById('watch-title'):null);
  const saveSlot=holder===document.getElementById?.('watch-personal-actions')?document.getElementById('watch-save-slot'):null;
  if(saveSlot) {
    let label=button.querySelector('.lc-save-label');
    if(!label){label=node('span','', 'lc-save-label');button.appendChild(label);}
    label.textContent=button.getAttribute('aria-label');
    if(button.parentNode!==saveSlot)saveSlot.appendChild(button);
  } else if(heading) {
    let line=heading.parentNode?.className==='lc-video-title-row'?heading.parentNode:holder.querySelector?.('.lc-video-title-row');
    if(!line){line=node('div','', 'lc-video-title-row');heading.parentNode.insertBefore(line,heading);}
    if(heading.parentNode!==line)line.insertBefore(heading,line.children[0] || null);
    libraryMenu({document,holder,line,save:button,id,title:()=>heading.textContent||titleFor(id,title),audio:holder.className?.split(' ').includes('lc-audio-card')});
  }
  if(holder.className?.split(' ').includes('home-featured'))return;
  let actions=holder.querySelector?.('.lc-personal-actions');
  if(!actions){actions=node('div','', 'lc-personal-actions');holder.appendChild(actions);}
  let progress=actions.querySelector('.lc-video-resume');const row=personal.history(id);
  if(isLive(id)||resumeSeconds(row)){if(!progress){progress=node('a','', 'lc-video-resume');actions.appendChild(progress);}progress.href=watchUrl(id,row);progress.textContent=isLive(id)?'LIVE':'Continue from '+timeLabel(row.seconds);progress.className='lc-video-resume'+(isLive(id)?' lc-live-label':'');}
  else progress?.remove();
  actions.hidden=!progress;
}
function renderPage(visible) {
  const list=document.getElementById?.('my-video-list'); if(!list)return;
  document.getElementById('load-more-videos').hidden=!personal.signedIn||!cursors[pageView];
  document.getElementById('my-video-status').textContent=syncMessage;
  const signIn=document.getElementById('personal-video-signin');if(signIn)signIn.hidden=personal.signedIn;
  const copy=document.getElementById('import-device-videos');if(copy)copy.hidden=!personal.signedIn||!['saved','history'].some(view=>createVideoStore({storage}).rows(view).some(r=>visible.has(r.videoId))); 
  document.getElementById('clear-video-history').hidden=pageView!=='history';
  list.replaceChildren();
  const rows=personal.rows(pageView).filter(r=>visible.has(r.videoId));
  document.getElementById('my-video-empty').hidden=rows.length>0;
  document.getElementById('my-video-empty').textContent=pageView==='saved'?'No saved videos yet. Use the bookmark beside a video title to keep it here.':'Your watched and listened-to videos will appear here.';
  if(document.querySelector?.('[data-study-hub]'))return;
  for(const row of rows) {
    const card=node('article','', 'lc-personal-card'), link=node('a');link.href=watchUrl(row.videoId,personal.history(row.videoId));
    const image=node('img');image.src=`https://i.ytimg.com/vi/${row.videoId}/hqdefault.jpg`;image.alt='';image.loading='lazy';link.appendChild(image);
    const title=node('h2',titleFor(row.videoId,row.title));link.appendChild(title);card.appendChild(link);
    const history=personal.history(row.videoId);
    if(!isLive(row.videoId)&&history?.duration>0){const bar=node('progress');bar.max=history.duration;bar.value=Math.min(history.seconds,history.duration);bar.setAttribute('aria-label','Playback progress');card.appendChild(bar);}
    if(history){card.appendChild(node('p',isLive(row.videoId)?'LIVE':history.completed?'Finished':`Stopped at ${timeLabel(history.seconds)}${history.duration?' of '+timeLabel(history.duration):''}`));}
    if(row.updatedAt){const date=node('time',new Date(row.updatedAt).toLocaleDateString());date.dateTime=new Date(row.updatedAt).toISOString();card.appendChild(date);}
    const buttons=node('div','', 'lc-personal-row');const play=node('a',isLive(row.videoId)?(history?.mode==='audio'?'Listen live':'Watch live'):resumeSeconds(history)?'Continue':'Watch','lc-mode-button');play.href=watchUrl(row.videoId,history);buttons.appendChild(play);if(!isLive(row.videoId)&&resumeSeconds(history)){const restart=node('a','Start over','lc-personal-remove');restart.href=watchUrl(row.videoId,history,true);buttons.appendChild(restart);}
    const remove=node('button',pageView==='saved'?'Remove saved':'Remove from history','lc-personal-remove');remove.type='button';remove.onclick=()=>{if(pageView==='saved')personal.save(row.videoId,row.title,false);else personal.removeHistory(row.videoId);void flush();};buttons.appendChild(remove);card.appendChild(buttons);list.appendChild(card);
  }
}
function render() {
  if(!active)return;
  const visible=visibleVideos();
  for(const card of document.querySelectorAll?.('.video-box[data-video-id]') || [])decorate(card,card.dataset.videoId,card.querySelector('lite-youtube')?.getAttribute('title'));
  const featured=document.querySelector?.('.home-featured[data-video-id]');if(featured)decorate(featured,featured.dataset.videoId,featured.querySelector('.home-video-title')?.textContent);
  const watch=document.getElementById?.('watch-personal-actions');const id=new URLSearchParams(location.search).get('v');
  if(watch&&id)decorate(watch,id,document.getElementById('watch-title')?.textContent);
  for(const result of document.querySelectorAll?.('.lc-search-video-result[data-video-id]') || [])decorate(result,result.dataset.videoId,result.querySelector('strong')?.textContent,true);
  renderPage(visible);
}
function boot() {
  const primary=['videotab-container','watch-personal-actions','my-video-list','audio-pilot-page','study-continue-title'].some(id=>document.getElementById?.(id))||!!document.querySelector?.('.home-featured[data-video-id]');
  if(!document.querySelector?.('script[data-lightcity-personal]') || (!primary&&!document.getElementById?.('home-search-results')))return;
  let initialized=primary;
  window.addEventListener('lightcity-search-results',()=>{if(!initialized){initialized=true;refreshPromise=refresh();personal.ready=refreshPromise;}schedule();});
  active=true;
  window.addEventListener('lightcity-video-activity',schedule);window.addEventListener('lightcity-live-status',schedule);
  window.addEventListener('lightcity-members-changed',()=>{if(initialized){refreshPromise=refresh();personal.ready=refreshPromise;}});
  window.addEventListener('online',()=>{if(initialized){refreshPromise=refresh();personal.ready=refreshPromise;}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void flush();else {void refreshLiveStatus();const scope=personal.scope;void loadRemoteReplacements().then(()=>{if(scope===personal.scope)personal.replaceSaved(replacementMap(),id=>titleFor(id));});}});
  window.addEventListener('pagehide',()=>void flush());
  for(const button of document.querySelectorAll('[data-personal-tab]')){button.tabIndex=button.dataset.personalTab===pageView?0:-1;button.onclick=()=>{pageView=button.dataset.personalTab;for(const other of document.querySelectorAll('[data-personal-tab]')){other.setAttribute('aria-selected',String(other===button));other.tabIndex=other===button?0:-1;}render();};button.onkeydown=event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const tabs=[...document.querySelectorAll('[data-personal-tab]')],next=tabs[(tabs.indexOf(button)+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];next.onclick();next.focus();};}
  const signIn=document.getElementById('personal-video-signin');if(signIn)signIn.onclick=async()=>{signIn.disabled=true;try{await globalThis.LightCityMembers.signInForVideos();}catch{syncMessage='Sign-in could not finish. Please try again.';emit();}finally{signIn.disabled=false;}};
  const copy=document.getElementById('import-device-videos');if(copy)copy.onclick=()=>{
    const device=createVideoStore({storage}), visible=visibleVideos();
    for(const row of device.rows('saved'))if(visible.has(row.videoId)&&!personal.saved(row.videoId))personal.save(row.videoId,row.title,true);
    for(const row of device.rows('history'))if(visible.has(row.videoId)&&(!personal.history(row.videoId)||personal.history(row.videoId).updatedAt<row.updatedAt))personal.progress(row);
    window.dispatchEvent(new Event('lc-copy-device-reading'));syncMessage='Device videos copied to this account. Syncing…';emit();void flush();
  };
  const more=document.getElementById('load-more-videos');if(more)more.onclick=async()=>{
    const view=pageView, owner=personal.scope, cursor=cursors[view];if(!cursor)return;more.disabled=true;
    try{const page=await globalThis.LightCityMembers.getVideoActivity({view,cursor,accountUid:owner.slice(5)});if(owner!==personal.scope)return;cursors[view]=page.cursor;personal.mergeRows(view,page.rows);}
    catch{syncMessage='Could not load more videos. Please try again.';emit();}finally{more.disabled=false;}
  };
  const clear=document.getElementById('clear-video-history');if(clear)clear.onclick=()=>{if(window.confirm('Clear your reading, watch and listening history? Saved resources will be kept.')){personal.clearHistory();window.dispatchEvent(new Event('lc-clear-reading-history'));void flush();}};
  const featured=document.querySelector?.('.home-featured[data-video-id]');
  if(featured&&typeof MutationObserver!=='undefined')new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'||r.target===featured.querySelector('.home-video-title')))schedule();}).observe(featured,{attributes:true,attributeFilter:['data-video-id'],childList:true,subtree:true});
  const grid=document.getElementById('videotab-container');
  if(grid&&typeof MutationObserver!=='undefined')new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.video-box, .video-title')||n.querySelector?.('.video-box')))))schedule();}).observe(grid,{childList:true,subtree:true});
  if(initialized){refreshPromise=refresh();personal.ready=refreshPromise;}render();
  const liveTimer=setInterval(()=>{if(document.visibilityState!=='hidden')void refreshLiveStatus();},45000);liveTimer.unref?.();
  const timer=setInterval(()=>void flush(),30000);timer.unref?.();
}
if(browser){globalThis.LightCityVideos=personal;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}
