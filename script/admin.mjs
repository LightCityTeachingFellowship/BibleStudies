import {archiveRequest} from './audio-archive-api.mjs';
import {setupAdminUsers} from './admin-users.mjs?v=1';
import {setupStudioTests} from './studio-tests.mjs?v=stream-reply-1';
import {setupStudioPublisher} from './studio-publish.mjs?v=replace-1';
import {streamId,watchLink,previewLink,dashboardRows,filterRows} from './admin-core.mjs?v=learning-1';
export function setupAdmin({document,window,navigator,api=()=>globalThis.LightCityMembers,loadArchive=archiveRequest}){
 const byId=id=>document.getElementById(id);if(!byId('admin-content'))return;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 let rows=[],tab='All',limit=36,generation=0,owner=null,checks={},pendingFeedback='';
 const accounts=setupAdminUsers({document,api});
 const status=message=>{byId('admin-status').textContent=message;};
 function clear(){accounts?.clear();rows=[];owner=null;pendingFeedback='';retrying.clear();byId('admin-list').replaceChildren();byId('admin-totals').replaceChildren();byId('admin-audio-pending')?.replaceChildren();byId('admin-content').hidden=true;byId('admin-gate').hidden=false;byId('admin-quick-result').hidden=true;byId('admin-quick-link').value='';byId('admin-quick').value='';}
 async function copy(url,container){
  try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(url);if(owner===api()?.user?.uid)status('LightCity link copied.');}
  catch{if(owner!==api()?.user?.uid)return;let input=container.querySelector('.studio-copy-input');if(!input){input=node('input',null,'studio-copy-input');input.readOnly=true;input.setAttribute('aria-label','LightCity link to copy');container.appendChild(input);}input.value=url;input.focus();input.select();status('Copy the selected LightCity link.');}
 }
 function action(label,fn){const b=node('button',label);b.type='button';b.addEventListener('click',fn);return b;}
 const retrying=new Map();
 function retryButton(id,feedback){
  const key=owner+':'+id;
  const button=action(retrying.has(key)?'Requesting retry…':'Retry audio processing',async()=>{
   const client=api(),uid=owner;if(!uid||uid!==client?.user?.uid||retrying.has(key))return;
   const token=Symbol();retrying.set(key,token);render();
   try{await client.retryPublication(id);if(owner!==uid||api()?.user?.uid!==uid)return;
    const message='Audio retry requested for '+id+'. Keep the streaming computer on with its matching final video in Audio Queue.';
    pendingFeedback=message;status(message);const target=byId('admin-audio-pending-status')||feedback;if(target)target.textContent=message;
   }catch(error){if(owner===uid&&api()?.user?.uid===uid){const message=error.message||'Could not request a retry.';pendingFeedback=message;status(message);const target=byId('admin-audio-pending-status')||feedback;if(target)target.textContent=message;}}
   finally{if(retrying.get(key)===token)retrying.delete(key);if(owner===uid&&api()?.user?.uid===uid)render();}
  });button.disabled=retrying.has(key);return button;
 }
 function renderPendingAudio(){
  const panel=byId('admin-audio-pending');if(!panel)return;
  const pending=rows.filter(r=>r.kind==='Video'&&r.id&&!r.published);panel.hidden=!pending.length;panel.replaceChildren();if(!pending.length)return;
  panel.appendChild(node('h3','Audio processing · '+pending.length+' pending'));
  panel.appendChild(node('p','New videos and replacements appear here until their matching audio is ready.','muted'));
  const feedback=node('p',null,'muted');feedback.id='admin-audio-pending-status';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
  // Keep feedback across quiet dashboard refreshes.
  feedback.textContent=pendingFeedback;panel.appendChild(feedback);
  for(const item of pending.slice(0,10)){
   const row=node('div',null,'studio-pending-audio-row');const info=node('div');info.appendChild(node('strong',item.title||item.id));
   info.appendChild(node('small',item.id+(item.replaceVideoId?' · Replaces '+item.replaceVideoId:''),'muted'));row.appendChild(info);row.appendChild(retryButton(item.id,feedback));panel.appendChild(row);
  }
  if(pending.length>10)panel.appendChild(action('View all pending audio',()=>{tab='Pending';limit=36;byId('admin-search').value='';render();}));
 }
 function render(){
  const feedback=byId('admin-audio-pending-status');if(feedback)pendingFeedback=feedback.textContent;renderPendingAudio();
  const list=byId('admin-list');list.replaceChildren();const selected=filterRows(rows,tab,byId('admin-search').value);
  byId('admin-results').textContent=selected.length+' items'+(selected.length?' · Showing '+Math.min(limit,selected.length):'');
  byId('admin-more').hidden=selected.length<=limit;
  byId('admin-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
  for(const item of selected.slice(0,limit)){
   const row=node('article',null,'studio-row');
   if(item.id){const image=node('img');image.src='https://i.ytimg.com/vi/'+item.id+'/mqdefault.jpg';image.alt='';image.loading='lazy';row.appendChild(image);}else{row.appendChild(node('span',item.kind,'muted'));}
   const info=node('div',null,'studio-row-info');info.appendChild(node('span',item.visibility==='members'?'Members':'Public','studio-badge'));
   const label=item.resourceId?({draft:'Needs approval',approved:'Approved · scheduled','awaiting-draft':'Awaiting draft',published:'Published'}[item.state]||item.state):!item.published?(item.replacement?'Replacement pending':'Waiting for publication'):item.live?'LIVE':item.replay?'Audio replay':item.archive?'Older message':item.audio?'Audio ready':item.kind==='Video'?(checks.audio===false?'Audio status unavailable':'Published'):item.kind;
   info.appendChild(node('span',label,'studio-badge'+(item.live?' live':!item.published?' pending':'')));info.appendChild(node('h3',item.title));
   if(item.live){
    const count=item.concurrentViewers;
    const viewers=Number.isSafeInteger(count)&&count>=0
      ? count.toLocaleString()+' watching on YouTube'
      : 'YouTube viewer count unavailable';
    info.appendChild(node('span',viewers,'studio-badge'));
   }
   if(item.id||item.date)info.appendChild(node('small',item.id||item.date));
   if(item.pendingReplacementId)info.appendChild(node('small','Replacement audio pending: '+item.pendingReplacementId,'muted'));row.appendChild(info);
   const actions=node('div',null,'studio-row-actions');const url=tab==='Audio'&&item.id?previewLink(item.id,true):item.shareUrl||item.url;
    if(!item.resourceId||item.published)actions.appendChild(action('Copy link',()=>void copy(url,row)));
   if(item.id&&item.published)actions.appendChild(action('Change access',()=>window.dispatchEvent(new window.CustomEvent('lightcity-video-privacy',{detail:{videoId:item.id,title:item.title,visibility:item.visibility}}))));
   if(item.resourceId)actions.appendChild(action(item.kind==='Quiz'?'Quiz & scores':'Review summary',()=>window.dispatchEvent(new window.CustomEvent('lightcity-learning-review',{detail:{id:item.resourceId}}))));
   if(item.id&&item.published)actions.appendChild(action('Replace',()=>{
    if(owner!==api()?.user?.uid)return;
    window.dispatchEvent(new window.CustomEvent('lightcity-studio-replace',{detail:{videoId:item.id,title:item.title,visibility:item.visibility}}));
   }));
   const retryId=item.pendingReplacementId||(!item.published&&item.id);if(retryId)actions.appendChild(retryButton(retryId,info));
   if(item.id)actions.appendChild(action('Remove',async()=>{
    const uid=owner;if(uid!==api()?.user?.uid)return;
    if(!window.confirm('Remove “'+item.title+'” from LightCity and its ID lists? Your YouTube upload and stored audio file are kept.'))return;
    try{status('Removing this video…');await api().removeStudioVideo(item.id);if(uid!==api()?.user?.uid)return;rows=rows.filter(v=>v.id!==item.id);render();status('Removed from LightCity. GitHub and this computer’s lists will sync in the background.');}
    catch(error){if(uid===api()?.user?.uid)status(error?.message||'Removal failed. Please retry.');}
   }));
   if(item.id&&item.audio&&item.published&&tab!=='Audio')actions.appendChild(action('Copy audio link',()=>void copy(previewLink(item.id,true),row)));
    if((!item.resourceId||item.published)&&typeof navigator.share==='function')actions.appendChild(action('Share',()=>{void navigator.share({title:item.title,text:item.title,url}).catch(error=>{if(error.name!=='AbortError')status('Use Copy link to share this item.');});}));
   if(item.published){const open=node('a','Open');open.href=tab==='Audio'&&item.id?watchLink(item.id,true):item.url;open.target='_blank';open.rel='noopener';actions.appendChild(open);}row.appendChild(actions);list.appendChild(row);
  }
 }
 async function load({quiet=false}={}){
  const current=++generation;const silent=quiet&&owner===api()?.user?.uid&&!!owner;if(!silent){clear();status('Checking access…');byId('admin-refresh').hidden=true;}
  const client=api();try{
   await client?.ready;if(current!==generation)return;
   byId('admin-signin').disabled=!client?.enabled;byId('admin-signout').hidden=!client?.user;byId('admin-account').textContent=client?.user?.email||'';
   if(!client?.enabled){status('Sign-in is not configured yet.');return;}
   if(!client.user||client.user.isAnonymous){status('Sign in to open your admin dashboard.');return;}
   const uid=client.user.uid;const data=await client.getAdminDashboard();if(current!==generation||api()?.user?.uid!==uid)return;
   owner=uid;if(!silent)void accounts?.load();checks={...data.checks};
   let archive;
   try {
    const result=await loadArchive();
    if(!Array.isArray(result?.recordings))throw Error('Invalid audio archive');
    archive=result.recordings;
   }catch{
    checks['older messages']=false;
   }
   if(current!==generation||api()?.user?.uid!==uid)return;
   const previousArchive=rows.filter(row=>row.archive);
   rows=dashboardRows({...data,archive});
   if(!archive&&silent)rows.push(...previousArchive);byId('admin-gate').hidden=true;byId('admin-content').hidden=false;byId('admin-refresh').hidden=false;
   const totals=byId('admin-totals');totals.replaceChildren();for(const [label,count]of [['Recordings',data.videos.length],['Audio available',filterRows(rows,'Audio').length],['Articles',data.readings.filter(r=>r.kind==='Article').length],['Summaries',data.readings.filter(r=>r.kind==='Summary').length]]){const box=node('div',null,'studio-total');box.appendChild(node('strong',String(count)));box.appendChild(node('span',label));totals.appendChild(box);}
   const warnings=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
   if(!silent)status(warnings.length?'Some status checks are unavailable: '+warnings.join(', ')+'. Refresh to retry.':'Ready to share. Last checked '+new Date(data.updatedAt).toLocaleTimeString());render();
  }catch(error){if(current!==generation)return;if(silent&&!['functions/permission-denied','functions/unauthenticated'].includes(error?.code)){status('Studio could not refresh. Your current view is kept; reconnecting shortly.');return;}clear();status(error?.code==='functions/permission-denied'?'This account does not have admin access. Sign out and use your admin account.':error?.code==='functions/not-found'?'The admin service needs to be deployed.':error?.code==='functions/unauthenticated'?'Sign in with your admin account.':'The dashboard could not load. Use Refresh to retry.');byId('admin-refresh').hidden=false;}
 }
 for(const [key,label]of [['All','All'],['Live','Live'],['Video','Videos'],['Audio','Audio'],['Article','Articles'],['Summary','Summaries'],['Quiz','Quizzes'],['Pending','Pending'],['Page','Site pages']]){const b=action(label,()=>{tab=key;limit=36;render();});b.dataset.tab=key;byId('admin-tabs').appendChild(b);}
 byId('admin-search').addEventListener('input',()=>{limit=36;render();});byId('admin-more').addEventListener('click',()=>{limit+=36;render();});byId('admin-refresh').addEventListener('click',()=>void load());
 byId('admin-signin').addEventListener('click',async()=>{byId('admin-signin').disabled=true;try{await api().signInForVideos();await load();}catch(error){const native=window.LightCityDesktop||/Electron\//.test(navigator.userAgent||'')||new URLSearchParams(window.location?.search||'').get('desktop')==='windows';status(native&&error?.message?error.message:'Sign-in did not finish. Please try again.');}finally{byId('admin-signin').disabled=false;}});
 byId('admin-signout').addEventListener('click',async()=>{++generation;clear();status('Signing out…');try{await api().signOut();await load();}catch{status('Sign-out could not finish. Please retry.');}});
 setupStudioTests({document,window,api,status});
 const publishing=setupStudioPublisher({document,window,navigator,api,status});
 if(!publishing){
  byId('admin-quick-form').addEventListener('submit',event=>{event.preventDefault();const id=streamId(byId('admin-quick').value);byId('admin-quick-result').hidden=!id;if(!id){status('Enter a valid YouTube link or 11-character video ID.');return;}byId('admin-quick-link').value=previewLink(id);status('LightCity Watch link prepared.');});
  byId('admin-quick-copy').addEventListener('click',()=>{const url=byId('admin-quick-link').value;if(url)void copy(url,byId('admin-quick-result'));});
 }
 window.addEventListener('lightcity-members-changed',()=>void load());
 const refreshShared=()=>{if(window.LightCityDesktop||document.visibilityState==='visible')void load({quiet:true});};
 window.addEventListener('lightcity-studio-published',refreshShared);
 const sharedTimer=setInterval(refreshShared,30000);sharedTimer.unref?.();window.addEventListener('focus',refreshShared);document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='visible')refreshShared();});window.addEventListener('pagehide',e=>{if(!e.persisted)clearInterval(sharedTimer);});void load();
 return {load};
}
if(typeof document!=='undefined')setupAdmin({document,window,navigator});
