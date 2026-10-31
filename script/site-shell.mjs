import {hub} from './account-hub.mjs?v=auth-restore-2';
import {element as el,icon,sitePath} from './hub-core.mjs';
import {orderedLinks,latestReadings} from './site-shell-core.mjs';
const configNode=document.getElementById('lc-shell-config');
let config;try{config=JSON.parse(configNode?.textContent||'null');}catch{}
const shapes={home:'<path d="m3 10 9-8 9 8v11h-6v-7H9v7H3z"/>',categories:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>',bible:'<path d="M12 5C8 2 4 2 2 3v17c4-1 7 0 10 2 3-2 6-3 10-2V3c-2-1-6-1-10 2v17M7 6v8M4 9h6"/>',quiz:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01"/>',doctrine:'<path d="M4 3h16v18H4zM8 7h8M8 11h8M8 15h6"/>',meeting:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 11h18M7 15h3M14 15h3"/>',about:'<circle cx="12" cy="12" r="10"/><path d="M12 10v7M12 6h.01"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>'};
const draw=name=>shapes[name]?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+shapes[name]+'</svg>':icon(name);
const api=()=>globalThis.LightCityMembers;
const owner=()=>hub.canUseCollections?api().user.uid:'public';
function button(label,name){const b=el('button','','lc-shell-icon');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.innerHTML=draw(name);return b;}
function prepareBottom(){
 const bottom=document.querySelector('.home-bottom-nav');if(!bottom)return;document.body.append(bottom);
 for(const a of bottom.querySelectorAll('a')){const label=a.getAttribute('aria-label')||a.textContent.trim()||a.title;a.setAttribute('aria-label',label);a.title=label;}
}
function pill(form){if(!form)return;form.classList.add('lc-shell-search-form');const leading=form.querySelector(':scope>svg');leading?.classList.add('lc-shell-leading-search');if(!form.querySelector('button')){const b=button('Search','search');b.type='submit';form.append(b);}}
function setupHomepage(){
 document.body.classList.add('lc-shell-ready','lc-shell-home');
 const controls=document.querySelector('.home-header-controls');if(controls){const tools=el('div','','lc-shell-tools'),bar=controls.querySelector('.lc-hub-header-tools');if(bar)tools.append(bar);controls.append(tools);}
 pill(document.getElementById('home-search-desktop')?.closest('form'));prepareBottom();hub.refreshChrome();window.dispatchEvent(new Event('lightcity-shell-ready'));
}
export function setupShell(){if(!config||document.body.classList.contains('lc-shell-ready'))return;
 if(document.querySelector('.home-brand-row')){setupHomepage();return;}
 const watch=!!document.querySelector('.watch-main'),reading=!!document.querySelector('[data-study-body]');
 if(watch)document.body.classList.add('lc-shell-watch');
 if(reading)document.body.classList.add('lc-shell-reading');
 if(watch||reading)document.body.classList.add('lc-shell-drawer');
 const from=selector=>[...document.querySelectorAll(selector)].map(a=>({label:a.textContent,url:a.href,active:a.classList.contains('active')||a.getAttribute('aria-current')==='page'}));
 const desktop=orderedLinks(from('.header-links-li>a[href]'),location.origin),mobile=orderedLinks(from('.mobile-headerLinks>a[href]'),location.origin);
 const fallback=orderedLinks(config.links||[],location.origin),deskLinks=desktop.length?desktop:fallback,mobileLinks=mobile.length?mobile:deskLinks;
 const legacyHeaders=[...document.querySelectorAll('.header-container,.home-brand-row,#homeHeader')].map(n=>n.id==='homeHeader'?(n.closest('header')||n):n);
 const header=el('header','','lc-shell-header'),top=el('div','','lc-shell-top'),start=el('div','','lc-shell-start'),toggle=button('Expand navigation','menu'),brand=el('a','','lc-shell-brand');toggle.setAttribute('aria-controls','lc-shell-rail');toggle.setAttribute('aria-expanded','false');brand.href=sitePath('/Home/');brand.setAttribute('aria-label','LightCity home');const logo=el('img');logo.src=new URL('images/LightCityLOGO.jpg',new URL(config.base||'/',location.origin)).href;logo.alt='LightCity Teaching Fellowship';logo.width=166;logo.height=47;brand.append(logo);start.append(toggle,brand);
 const searchSlot=el('div','','lc-shell-search'),tools=el('div','','lc-shell-tools'),searchButton=button('Search','search');top.append(start,searchSlot,tools,searchButton);header.append(top);document.body.prepend(header);
 const searchInput=document.getElementById('home-search-desktop')||document.getElementById('audio-library-search'),form=searchInput?.closest('form'),searchDialog=document.getElementById('home-search-dialog'),oldSearchButton=form?.querySelector('.home-search-mobile');
 const audio=searchInput?.id==='audio-library-search',audioRow=el('div','','lc-shell-audio-search');audioRow.hidden=true;
 const query=matchMedia('(max-width: 900px)');let moreOpen=false;
 if(form){searchSlot.append(form);form.classList.add('lc-shell-search-form');form.querySelectorAll('svg').forEach((s,i)=>{if(i===0&&s.parentNode===form)s.classList.add('lc-shell-leading-search');});const label=searchInput.getAttribute('aria-label')||searchInput.placeholder||'Search';searchButton.setAttribute('aria-label',label);searchButton.title=label;
  if(!oldSearchButton){const submit=button(label,'search');submit.type='submit';form.append(submit);form.addEventListener('submit',e=>{e.preventDefault();searchInput.focus();});}
 }else searchButton.hidden=true;
 function closeAudio(){audioRow.hidden=true;searchButton.setAttribute('aria-expanded','false');}
 searchButton.onclick=()=>{setMore(false);if(audio){audioRow.hidden=!audioRow.hidden;searchButton.setAttribute('aria-expanded',String(!audioRow.hidden));if(!audioRow.hidden)searchInput.focus();}else oldSearchButton?.click();};
 header.append(audioRow);
 const backdrop=el('div','','lc-shell-more-backdrop');backdrop.hidden=true;const more=el('nav','','lc-shell-more');more.id='lc-shell-more';more.setAttribute('aria-label','Site navigation');const menuHead=el('div','','lc-shell-menu-heading'),menuClose=button('Close navigation','close');menuHead.append(el('strong','Navigation'),menuClose);more.append(menuHead,...mobileLinks.map(r=>link(r,true)));more.append(libraryLink());backdrop.append(more);document.body.append(backdrop);
 function setMore(open,focus=false){moreOpen=open;backdrop.hidden=!open;document.body.classList.toggle('lc-shell-mobile-menu-open',open);if(query.matches){toggle.setAttribute('aria-controls','lc-shell-more');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');toggle.title=open?'Close navigation':'Open navigation';}if(open)closeAudio();if(focus)toggle.focus();}
 menuClose.onclick=()=>setMore(false,true);backdrop.onclick=e=>{if(e.target===backdrop||e.target.closest('a'))setMore(false);};
 const drawerBackdrop=el('div','','lc-shell-rail-backdrop');drawerBackdrop.hidden=true;document.body.append(drawerBackdrop);
 const rail=el('nav','','lc-shell-rail');rail.id='lc-shell-rail';rail.setAttribute('aria-label','Main pages');for(const r of deskLinks){const group=el('div','','lc-shell-group');group.append(link(r,true));if(['Article','Summary','video','audio'].includes(r.kind))group.dataset.recent=r.kind;rail.append(group);}rail.append(libraryLink());document.body.append(rail);
 function libraryLink(){return link({label:'My library',url:sitePath('/MyLibrary/'),kind:'bookmark'},true);}
 function link(row,withIcon){const a=el('a','','lc-shell-link');a.href=row.url;a.title=row.label;if(withIcon){const i=el('span','','lc-shell-link-icon');i.innerHTML=draw(row.kind);a.append(i);}a.append(el('span',row.label,'lc-shell-link-label'));try{const u=new URL(row.url,location.origin);if(row.active||u.origin===location.origin&&u.pathname.replace(/\/$/,'').toLowerCase()===location.pathname.replace(/\/$/,'').toLowerCase())a.setAttribute('aria-current','page');}catch{}return a;}
 const popup=el('nav','','lc-shell-recent-popup');popup.hidden=true;popup.setAttribute('aria-label','Latest resources');document.body.append(popup);
 let hovered=null,hoverTimer=null,expanded=false,version=0,recentFlight=null,recentOwner='',recentData=null;
 function closeRecent(){clearTimeout(hoverTimer);hovered?.firstElementChild?.setAttribute('aria-expanded','false');hovered=null;popup.hidden=true;popup.replaceChildren();}
 function placeRecent(){if(!hovered||popup.hidden)return;const r=hovered.getBoundingClientRect(),width=Math.min(340,innerWidth-24);popup.style.width=width+'px';popup.style.left=Math.min(innerWidth-width-12,rail.getBoundingClientRect().right+8)+'px';popup.style.top=Math.max(74,Math.min(r.top,innerHeight-popup.offsetHeight-16))+'px';}
 function paintRecent(data){if(!hovered)return;const kind=hovered.dataset.recent,rows=data?.[kind]||[];popup.replaceChildren(el('strong','Latest '+hovered.firstElementChild.textContent.trim().toLowerCase(),'lc-shell-popup-heading'));if(!rows.length)popup.append(el('p',data?'No recent items available.':'Loading recent items…','lc-shell-popup-empty'));for(const row of rows){const a=el('a',row.title,'lc-shell-recent-link');a.href=row.url;a.title=row.title;popup.append(a);}popup.hidden=false;placeRecent();}
 function openRecent(group){if(query.matches)return;clearTimeout(hoverTimer);if(hovered!==group)closeRecent();hovered=group;group.firstElementChild.setAttribute('aria-expanded','true');paintRecent(recentOwner===owner()?recentData:null);void recent();}
 function leaveRecent(){clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>{if(!hovered?.contains(document.activeElement)&&!popup.contains(document.activeElement))closeRecent();},160);}
 for(const group of rail.querySelectorAll('[data-recent]')){group.firstElementChild.setAttribute('aria-haspopup','true');group.firstElementChild.setAttribute('aria-expanded','false');group.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')openRecent(group);});group.addEventListener('pointerleave',leaveRecent);group.addEventListener('focusin',()=>openRecent(group));group.addEventListener('focusout',leaveRecent);}
 popup.addEventListener('pointerenter',()=>clearTimeout(hoverTimer));popup.addEventListener('pointerleave',leaveRecent);popup.addEventListener('focusout',leaveRecent);rail.addEventListener('scroll',placeRecent);window.addEventListener('resize',closeRecent);
 async function recent(){const current=owner(),ticket=version;if(recentData&&recentOwner===current){paintRecent(recentData);return;}if(recentFlight)return;
  recentFlight=(async()=>{let readings=[],audioRows=[];const cached=globalThis.LightCityStudy?.catalog?.();const currentScope=current==='public'?'device':'user:'+current;
   try{if(cached?.length&&globalThis.LightCityStudy.scope===currentScope)readings=cached;else{const response=await fetch(config.readings,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const value=await response.json();readings=(value.publications||[]).filter(r=>r.visibility!=='members');if(hub.canUseCollections){const result=await api().getReadingActivity({view:'catalog',accountUid:current});readings=[...readings,...(result.publications||[])];}}}catch{}
   try{if(api()?.getAudio){const result=await api().getAudio();audioRows=result.recordings||[];}}catch{}
   if(ticket!==version||current!==owner())return;const videoRows=[];const seen=new Set();let published=[];try{const raw=JSON.parse(document.getElementById('lc-public-video-data')?.textContent||'{}');published=Object.entries(raw).map(([id,title])=>({id,title}));}catch{}
   for(const row of [...(api()?.library||api()?.publicLibrary||[]),...published])if(/^[\w-]{11}$/.test(row.id)&&!seen.has(row.id)){seen.add(row.id);videoRows.push({title:row.title&&row.title!==row.id?row.title:'LightCity video',url:sitePath('/Watch/?v=')+row.id,id:row.id});}
   const audioIds=new Map(audioRows.map(r=>[r.videoId,r]));const data={Article:latestReadings(readings,'Article',location.origin),Summary:latestReadings(readings,'Summary',location.origin),video:videoRows.slice(0,5),audio:videoRows.filter(r=>audioIds.has(r.id)).slice(0,5).map(r=>({...r,title:audioIds.get(r.id).title||r.title,url:r.url+'&mode=audio'}))};recentOwner=current;recentData=data;paintRecent(data);
  })();const flight=recentFlight;try{await flight;}finally{if(recentFlight===flight)recentFlight=null;}}
 function setExpanded(open,focus=false){expanded=open;closeRecent();document.body.classList.toggle('lc-shell-expanded',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Collapse navigation':'Expand navigation');drawerBackdrop.hidden=!(document.body.classList.contains('lc-shell-drawer')&&open&&!query.matches);if(focus)toggle.focus();}
 toggle.onclick=e=>{if(query.matches){setMore(!moreOpen);if(moreOpen&&e.detail===0)more.querySelector('a')?.focus();}else setExpanded(!expanded);};
 document.addEventListener('pointerdown',e=>{if(moreOpen&&!more.contains(e.target)&&!toggle.contains(e.target))setMore(false);if(hovered&&!rail.contains(e.target)&&!popup.contains(e.target))closeRecent();if(expanded&&!rail.contains(e.target)&&!popup.contains(e.target)&&!toggle.contains(e.target)&&!e.target.closest('dialog'))setExpanded(false);if(audio&&!audioRow.hidden&&!header.contains(e.target))closeAudio();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(hovered){e.preventDefault();const focus=hovered.firstElementChild;focus.focus();closeRecent();}else if(moreOpen){e.preventDefault();setMore(false,true);}else if(expanded){e.preventDefault();setExpanded(false,true);}else closeAudio();}});
 const theme=document.querySelector('.theme-control');let themeWrap;if(theme){themeWrap=el('div','','lc-shell-theme');theme.classList.remove('home-theme-control');themeWrap.append(el('span','Appearance'),theme);rail.append(themeWrap);}
 if(!document.querySelector('.home-bottom-nav')){const bottom=el('nav','','home-bottom-nav');bottom.setAttribute('aria-label','Main navigation');for(const r of fallback.slice(0,5)){const a=link(r,false);a.prepend(el('span','','lc-shell-bottom-icon'));a.firstChild.innerHTML=draw(r.kind);bottom.append(a);}document.body.append(bottom);}
 function responsive(){if(themeWrap)(query.matches?more:rail).append(themeWrap);setMore(false);closeAudio();if(form){if(audio&&query.matches)audioRow.append(form);else searchSlot.append(form);}if(!query.matches){toggle.setAttribute('aria-controls','lc-shell-rail');toggle.setAttribute('aria-label','Expand navigation');toggle.title='Expand navigation';}}
 query.addEventListener('change',()=>{setExpanded(false);responsive();});responsive();prepareBottom();
 function audience(){version++;recentData=null;recentFlight=null;recentOwner='';closeRecent();}
 window.addEventListener('lightcity-members-changed',audience);window.addEventListener('lightcity-study-catalog',()=>{recentData=null;if(hovered)void recent();});
 for(const n of legacyHeaders)n.dataset.shellLegacy='';document.querySelectorAll('.browse-search').forEach(n=>n.dataset.shellLegacy='');document.querySelectorAll('.lc-nav-overlay,.lc-nav-desktop').forEach(n=>{n.classList.remove('lc-nav-is-open');n.dataset.shellLegacy='';});document.body.classList.remove('lc-nav-open');document.body.classList.add('lc-shell-ready');
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{document.body.style.setProperty('--shell-top',header.getBoundingClientRect().height+'px');}).observe(header);
 hub.refreshChrome();const bar=tools.querySelector('.lc-hub-header-tools');if(bar)bar.append(searchButton);else tools.append(searchButton);
 window.dispatchEvent(new Event('lightcity-shell-ready'));
}
setupShell();
