export function setupStudioShell({document,window,api=()=>globalThis.LightCityMembers}={}){
 const get=id=>document.getElementById(id),content=get('admin-content'),sidebar=get('studio-sidebar');if(!content||!sidebar)return;
 const views=[...content.querySelectorAll('[data-studio-view]')],routes=new Set(views.map(v=>v.dataset.studioView)),labels={overview:'Overview',publishing:'Publish',reports:'Stream reports',countdown:'Service countdown',library:'Content library',people:'People',devices:'My devices',preview:'Private test preview'};
 const media=window.matchMedia('(max-width: 1050px)'),workspace=get('studio-workspace'),menu=get('studio-menu');let active=new URLSearchParams(window.location.search).get('reports')==='1'?'reports':'overview',drawer=false,lastFocus=null,previewOpened=false,lastAllowed=null;
 const allowed=()=>!content.hidden,fromHash=()=>window.location.hash.slice(1),previewReady=()=>!get('admin-test-preview').hidden;
 function closeMenu({restore=true}={}){drawer=false;sidebar.removeAttribute('role');sidebar.removeAttribute('aria-modal');document.body.classList.remove('studio-menu-open');workspace.inert=false;get('studio-menu-backdrop').hidden=true;menu.setAttribute('aria-expanded','false');sidebar.inert=media.matches;if(restore&&lastFocus?.isConnected&&!lastFocus.hidden)lastFocus.focus();lastFocus=null;}
 function openMenu(){if(!allowed()||!media.matches)return;lastFocus=document.activeElement;drawer=true;sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-modal','true');sidebar.inert=false;document.body.classList.add('studio-menu-open');workspace.inert=true;get('studio-menu-backdrop').hidden=false;menu.setAttribute('aria-expanded','true');get('studio-menu-close').focus();}
 function show(route,{focus=false,history=false}={}){
  if(!allowed())return;route=routes.has(route)&&!(route==='preview'&&!previewReady())?route:'overview';active=route;
  for(const view of views)view.hidden=view.dataset.studioView!==route;
  document.querySelectorAll('[data-studio-route]').forEach(link=>{if(link.closest('nav')){if(link.dataset.studioRoute===route)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}});
  get('studio-section-label').textContent=labels[route];document.title=labels[route]+' | LightCity Studio';
  for(const [key,id]of [['countdown','admin-service-panel'],['people','admin-users-panel'],['devices','admin-devices-panel']])if(route===key)get(id).open=true;
  if(history&&fromHash()!==route)window.history.pushState(null,'','#'+route);
  closeMenu({restore:false});
  if(focus){const heading=views.find(v=>v.dataset.studioView===route)?.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}window.scrollTo({top:0,behavior:'instant'});}
 }
 function profile(){
  const user=api()?.user;get('studio-user-name').textContent=user?.displayName||'LightCity Studio';const avatar=get('studio-avatar');avatar.replaceChildren();
  const initials=(user?.displayName||'LightCity').split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();avatar.textContent=initials;
  if(user?.photoURL){try{const url=new URL(user.photoURL);if(url.protocol==='https:'){const image=document.createElement('img');image.alt='';image.referrerPolicy='no-referrer';image.src=url.href;image.addEventListener('error',()=>{avatar.textContent=initials;},{once:true});avatar.replaceChildren(image);}}catch{}}
 }
 function access(){const ready=allowed(),changed=ready!==lastAllowed;lastAllowed=ready;sidebar.hidden=!ready;menu.hidden=!ready;get('admin-search').disabled=!ready;document.body.classList.toggle('studio-authenticated',ready);profile();
  if(!ready){closeMenu({restore:false});for(const view of views)view.hidden=true;previewOpened=false;document.title='LightCity Studio';return;}
  if(changed)show(fromHash()||active);syncPreview();
 }
 function syncPreview(){get('studio-preview-link').hidden=!previewReady();if(allowed()&&previewReady()&&!previewOpened&&new URLSearchParams(window.location.search).has('test')){previewOpened=true;show('preview',{history:true});}else if(allowed()&&active==='preview'&&!previewReady())show('overview',{history:true});}
 function reports(){const count=get('admin-stream-reports').querySelectorAll('.studio-stream-report').length,badge=get('studio-report-badge'),alert=get('admin-stream-report-panel').getAttribute('data-report-alert')==='true';badge.textContent=String(count);badge.hidden=!count;const link=sidebar.querySelector('[data-studio-route="reports"]');link.classList.toggle('has-reports',alert);link.setAttribute('aria-label',count?'Stream reports, '+count+' unresolved':'Stream reports');const overview=get('studio-report-overview');overview.classList.toggle('has-reports',alert);get('studio-report-overview-text').textContent=count?count+' unresolved report'+(count===1?'':'s')+' need'+(count===1?'s':'')+' your attention.':get('admin-stream-report-status').textContent||'Checking viewer feedback…';}
 function totalIcons(){const names=['library','audio','article','summary'];[...get('admin-totals').children].forEach((box,index)=>{if(box.querySelector('svg'))return;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS(svg.namespaceURI,'use');svg.setAttribute('class','studio-total-icon studio-icon');svg.setAttribute('aria-hidden','true');use.setAttribute('href','#studio-icon-'+names[index]);svg.append(use);box.prepend(svg);});}
 document.addEventListener('click',event=>{const link=event.target.closest?.('[data-studio-route]');if(!link||event.defaultPrevented||event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();show(link.dataset.studioRoute,{focus:true,history:true});});
 menu.addEventListener('click',()=>drawer?closeMenu():openMenu());get('studio-menu-close').addEventListener('click',()=>closeMenu());get('studio-menu-backdrop').addEventListener('click',()=>closeMenu());
 document.addEventListener('keydown',event=>{if(drawer&&event.key==='Escape'){event.preventDefault();closeMenu();return;}if(drawer&&event.key==='Tab'){const items=[...sidebar.querySelectorAll('a[href],button')].filter(el=>!el.hidden&&!el.closest('[hidden]')),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  if(event.key==='/'&&!drawer&&allowed()&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest?.('input,textarea,select,[contenteditable="true"]')){event.preventDefault();get('admin-search').focus();}
 });
 get('admin-search').addEventListener('input',()=>{if(allowed()&&active!=='library')show('library',{history:true});});
 window.addEventListener('lightcity-stream-reply',()=>{if(allowed()&&active!=='reports'){show('reports',{history:true});get('admin-stream-message-text').focus();}});
 window.addEventListener('hashchange',()=>show(fromHash(),{focus:true}));window.addEventListener('lightcity-members-changed',()=>{profile();});media.addEventListener('change',()=>closeMenu({restore:false}));
 const accessObserver=new window.MutationObserver(access);accessObserver.observe(content,{attributes:true,attributeFilter:['hidden']});
 const previewObserver=new window.MutationObserver(syncPreview);previewObserver.observe(get('admin-test-preview'),{attributes:true,attributeFilter:['hidden']});
 const reportsObserver=new window.MutationObserver(reports);reportsObserver.observe(get('admin-stream-reports'),{childList:true});reportsObserver.observe(get('admin-stream-report-status'),{childList:true,subtree:true,characterData:true});reportsObserver.observe(get('admin-stream-report-panel'),{attributes:true,attributeFilter:['data-report-alert']});
 const totalsObserver=new window.MutationObserver(totalIcons);totalsObserver.observe(get('admin-totals'),{childList:true});
 get('studio-today').textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(new Date()).toUpperCase();access();reports();totalIcons();
 return {show,closeMenu,openMenu};
}
if(typeof document!=='undefined')setupStudioShell({document,window});
