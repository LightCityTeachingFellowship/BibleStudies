import {setupStudioPublisher} from './studio-publish.mjs?v=studio-removal-1';
import {streamId,watchLink,previewLink,dashboardRows,filterRows} from './admin-core.mjs?v=previews-1';
export function setupAdmin({document,window,navigator,api=()=>globalThis.LightCityMembers}){
 const byId=id=>document.getElementById(id);if(!byId('admin-content'))return;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 let rows=[],tab='All',limit=36,generation=0,owner=null,checks={};
 const status=message=>{byId('admin-status').textContent=message;};
 function clear(){rows=[];owner=null;byId('admin-list').replaceChildren();byId('admin-totals').replaceChildren();byId('admin-content').hidden=true;byId('admin-gate').hidden=false;byId('admin-quick-result').hidden=true;byId('admin-quick-link').value='';byId('admin-quick').value='';}
 async function copy(url,container){
  try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(url);if(owner===api()?.user?.uid)status('LightCity link copied.');}
  catch{if(owner!==api()?.user?.uid)return;let input=container.querySelector('.studio-copy-input');if(!input){input=node('input',null,'studio-copy-input');input.readOnly=true;input.setAttribute('aria-label','LightCity link to copy');container.appendChild(input);}input.value=url;input.focus();input.select();status('Copy the selected LightCity link.');}
 }
 function action(label,fn){const b=node('button',label);b.type='button';b.addEventListener('click',fn);return b;}
 function render(){
  const list=byId('admin-list');list.replaceChildren();const selected=filterRows(rows,tab,byId('admin-search').value);
  byId('admin-results').textContent=selected.length+' items'+(selected.length?' · Showing '+Math.min(limit,selected.length):'');
  byId('admin-more').hidden=selected.length<=limit;
  byId('admin-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
  for(const item of selected.slice(0,limit)){
   const row=node('article',null,'studio-row');
   if(item.id){const image=node('img');image.src='https://i.ytimg.com/vi/'+item.id+'/mqdefault.jpg';image.alt='';image.loading='lazy';row.appendChild(image);}else{row.appendChild(node('span',item.kind,'muted'));}
   const info=node('div',null,'studio-row-info');info.appendChild(node('span',item.visibility==='members'?'Members':'Public','studio-badge'));
   const label=!item.published?(item.replacement?'Replacement pending':'Waiting for publication'):item.live?'LIVE':item.replay?'Audio replay':item.audio?'Audio ready':item.kind==='Video'?(checks.audio===false?'Audio status unavailable':'Published'):item.kind;
   info.appendChild(node('span',label,'studio-badge'+(item.live?' live':!item.published?' pending':'')));info.appendChild(node('h3',item.title));
   if(item.id||item.date)info.appendChild(node('small',item.id||item.date));row.appendChild(info);
   const actions=node('div',null,'studio-row-actions');const url=tab==='Audio'&&item.id?previewLink(item.id,true):item.shareUrl||item.url;
   actions.appendChild(action('Copy link',()=>void copy(url,row)));
   if(item.id)actions.appendChild(action('Remove',async()=>{
    const uid=owner;if(uid!==api()?.user?.uid)return;
    if(!window.confirm('Remove “'+item.title+'” from LightCity and its ID lists? Your YouTube upload and stored audio file are kept.'))return;
    try{status('Removing this video…');await api().removeStudioVideo(item.id);if(uid!==api()?.user?.uid)return;rows=rows.filter(v=>v.id!==item.id);render();status('Removed from LightCity. GitHub and this computer’s lists will sync in the background.');}
    catch(error){if(uid===api()?.user?.uid)status(error?.message||'Removal failed. Please retry.');}
   }));
   if(item.audio&&item.published&&tab!=='Audio')actions.appendChild(action('Copy audio link',()=>void copy(previewLink(item.id,true),row)));
   if(typeof navigator.share==='function')actions.appendChild(action('Share',()=>{void navigator.share({title:item.title,text:item.title,url}).catch(error=>{if(error.name!=='AbortError')status('Use Copy link to share this item.');});}));
   if(item.published){const open=node('a','Open');open.href=tab==='Audio'&&item.id?watchLink(item.id,true):item.url;open.target='_blank';open.rel='noopener';actions.appendChild(open);}row.appendChild(actions);list.appendChild(row);
  }
 }
 async function load(){
  const current=++generation;clear();status('Checking access…');byId('admin-refresh').hidden=true;
  const client=api();try{
   await client?.ready;if(current!==generation)return;
   byId('admin-signin').disabled=!client?.enabled;byId('admin-signout').hidden=!client?.user;byId('admin-account').textContent=client?.user?.email||'';
   if(!client?.enabled){status('Sign-in is not configured yet.');return;}
   if(!client.user||client.user.isAnonymous){status('Sign in to open your admin dashboard.');return;}
   const uid=client.user.uid;const data=await client.getAdminDashboard();if(current!==generation||api()?.user?.uid!==uid)return;
   owner=uid;checks=data.checks||{};rows=dashboardRows(data);byId('admin-gate').hidden=true;byId('admin-content').hidden=false;byId('admin-refresh').hidden=false;
   const totals=byId('admin-totals');for(const [label,count]of [['Recordings',data.videos.length],['Audio available',data.videos.filter(v=>v.audio&&v.published).length],['Articles',data.readings.filter(r=>r.kind==='Article').length],['Summaries',data.readings.filter(r=>r.kind==='Summary').length]]){const box=node('div',null,'studio-total');box.appendChild(node('strong',String(count)));box.appendChild(node('span',label));totals.appendChild(box);}
   const warnings=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
   status(warnings.length?'Some status checks are unavailable: '+warnings.join(', ')+'. Refresh to retry.':'Ready to share. Last checked '+new Date(data.updatedAt).toLocaleTimeString());render();
  }catch(error){if(current!==generation)return;clear();status(error?.code==='functions/permission-denied'?'This account does not have admin access. Sign out and use your admin account.':error?.code==='functions/not-found'?'The admin service needs to be deployed.':error?.code==='functions/unauthenticated'?'Sign in with your admin account.':'The dashboard could not load. Use Refresh to retry.');byId('admin-refresh').hidden=false;}
 }
 for(const [key,label]of [['All','All'],['Live','Live'],['Video','Videos'],['Audio','Audio'],['Article','Articles'],['Summary','Summaries'],['Pending','Pending'],['Page','Site pages']]){const b=action(label,()=>{tab=key;limit=36;render();});b.dataset.tab=key;byId('admin-tabs').appendChild(b);}
 byId('admin-search').addEventListener('input',()=>{limit=36;render();});byId('admin-more').addEventListener('click',()=>{limit+=36;render();});byId('admin-refresh').addEventListener('click',()=>void load());
 byId('admin-signin').addEventListener('click',async()=>{byId('admin-signin').disabled=true;try{await api().signInForVideos();await load();}catch{status('Sign-in did not finish. Please try again.');}finally{byId('admin-signin').disabled=false;}});
 byId('admin-signout').addEventListener('click',async()=>{++generation;clear();status('Signing out…');try{await api().signOut();await load();}catch{status('Sign-out could not finish. Please retry.');}});
 const publishing=setupStudioPublisher({document,window,navigator,api,status});
 if(!publishing){
  byId('admin-quick-form').addEventListener('submit',event=>{event.preventDefault();const id=streamId(byId('admin-quick').value);byId('admin-quick-result').hidden=!id;if(!id){status('Enter a valid YouTube link or 11-character video ID.');return;}byId('admin-quick-link').value=previewLink(id);status('LightCity Watch link prepared.');});
  byId('admin-quick-copy').addEventListener('click',()=>{const url=byId('admin-quick-link').value;if(url)void copy(url,byId('admin-quick-result'));});
 }
 window.addEventListener('lightcity-members-changed',()=>void load());void load();
 return {load};
}
if(typeof document!=='undefined')setupAdmin({document,window,navigator});
