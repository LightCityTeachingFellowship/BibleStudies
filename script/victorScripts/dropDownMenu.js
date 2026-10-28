/* Keep every header's original link order. Only desktop overflow after link five moves. */
(() => {
 const mobile=document.getElementById('myDropdown'),panel=mobile?.querySelector('.mobile-homeHeaderNav'),trigger=document.querySelector('.mobileButton'),header=document.querySelector('.header-container'),headerUL=document.querySelector('.headerUL');
 const script=document.currentScript;
 if(script&&!document.getElementById('lc-navigation-style')){const css=document.createElement('link');css.id='lc-navigation-style';css.rel='stylesheet';css.href=new URL('../../style/navigation.css?v=2',script.src).href;document.head.appendChild(css);}
 const dots='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
 const cross='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
 let more=null,desktop=null,returnFocus=null;const background=new Map();
 const isOpen=el=>!!el?.classList.contains('lc-nav-is-open');
 function closeDesktop(focus=false){if(!desktop)return;desktop.classList.remove('lc-nav-is-open');desktop.inert=true;desktop.setAttribute('aria-hidden','true');more?.setAttribute('aria-expanded','false');if(focus)more?.focus();}
 function closeMobile(focus=true){if(!mobile||!panel)return;mobile.classList.remove('lc-nav-is-open');mobile.inert=true;mobile.setAttribute('aria-hidden','true');trigger?.setAttribute('aria-expanded','false');document.body.classList.remove('lc-nav-open');for(const [el,inert]of background)el.inert=inert;background.clear();if(focus&&returnFocus?.isConnected)returnFocus.focus();}
 window.myFunction=()=>{
  if(!mobile||!panel)return;if(isOpen(mobile)){closeMobile();return;}
  closeDesktop();returnFocus=document.activeElement;
  for(const el of document.body.children)if(el!==mobile&&!['SCRIPT','STYLE','LINK'].includes(el.tagName)){background.set(el,el.inert);el.inert=true;}
  mobile.inert=false;mobile.classList.add('lc-nav-is-open');mobile.setAttribute('aria-hidden','false');trigger?.setAttribute('aria-expanded','true');document.body.classList.add('lc-nav-open');
  requestAnimationFrame(()=>{if(isOpen(mobile))panel.querySelector('a[href]')?.focus({preventScroll:true});});
 };
 if(mobile&&panel){
  mobile.classList.remove('slideOut','slideInFromLeft');mobile.classList.add('lc-nav-overlay');panel.classList.add('lc-nav-drawer');
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Site navigation');
  const top=document.createElement('div');top.className='lc-nav-heading';const identity=document.createElement('div');identity.innerHTML='<span class="lc-nav-brand">LIGHTCITY</span><span class="lc-nav-caption">Explore & connect</span>';top.appendChild(identity);
  const close=panel.querySelector('.closeNavBar')||document.createElement('button');close.className='closeNavBar lc-nav-close';close.type='button';close.innerHTML=cross;close.setAttribute('aria-label','Close navigation');close.onclick=()=>closeMobile();top.appendChild(close);panel.insertBefore(top,panel.firstChild);
  document.body.appendChild(mobile);closeMobile(false);
  if(trigger){trigger.classList.add('lc-nav-trigger');trigger.innerHTML=dots;trigger.setAttribute('aria-label','Open navigation');trigger.setAttribute('aria-controls','myDropdown');trigger.setAttribute('aria-expanded','false');}
  mobile.addEventListener('click',event=>{if(!panel.contains(event.target))closeMobile();else if(event.target.closest('a[href]'))closeMobile(false);});
 }
 function placeDesktop(){if(!desktop||!more)return;const rect=more.getBoundingClientRect();desktop.style.top=(rect.bottom+8)+'px';desktop.style.right=Math.max(12,window.innerWidth-rect.right)+'px';desktop.style.maxHeight=Math.max(120,window.innerHeight-rect.bottom-24)+'px';}
 window.myFunctionDesk=()=>{if(!desktop)return;if(isOpen(desktop)){closeDesktop(true);return;}closeMobile(false);placeDesktop();desktop.inert=false;desktop.setAttribute('aria-hidden','false');desktop.classList.add('lc-nav-is-open');more.setAttribute('aria-expanded','true');};
 const links=[...document.querySelectorAll('.header-links-li')];
 if(header&&headerUL&&links.length>5){
  more=document.createElement('button');more.className='moreButton Button lc-nav-more';more.type='button';more.innerHTML='More <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';more.setAttribute('aria-controls','myDropdownDesk');more.setAttribute('aria-expanded','false');more.onclick=event=>{window.myFunctionDesk();if(isOpen(desktop)&&event.detail===0)desktop.querySelector('a[href]')?.focus();};more.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();if(!isOpen(desktop))window.myFunctionDesk();desktop.querySelector('a[href]')?.focus();}});headerUL.appendChild(more);
  desktop=document.createElement('div');desktop.id='myDropdownDesk';desktop.className='myDropdownDesk lc-nav-desktop';desktop.setAttribute('aria-label','More navigation links');
  const list=document.createElement('div');list.id='header-links2';list.className='header-links2 active-link';for(const link of links.slice(5))list.appendChild(link);desktop.appendChild(list);document.body.appendChild(desktop);closeDesktop();
  desktop.addEventListener('click',event=>{if(event.target.closest('a[href]'))closeDesktop();});
 }
 document.addEventListener('pointerdown',event=>{if(isOpen(desktop)&&!desktop.contains(event.target)&&!more.contains(event.target))closeDesktop();});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){if(isOpen(mobile)){event.preventDefault();closeMobile();}else if(isOpen(desktop)){event.preventDefault();closeDesktop(true);}return;}
  if(event.key==='Tab'&&isOpen(mobile)){
   const items=[...panel.querySelectorAll('a[href],button:not([disabled])')].filter(el=>el.getClientRects().length),first=items[0],last=items.at(-1);
   if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first?.focus();}
  }
 });
 desktop?.addEventListener('focusout',event=>{if(event.relatedTarget&&!desktop.contains(event.relatedTarget)&&event.relatedTarget!==more)closeDesktop();});
 window.addEventListener('resize',()=>{if(window.innerWidth>900)closeMobile(false);if(window.innerWidth<=900)closeDesktop();else if(isOpen(desktop))placeDesktop();});
 window.addEventListener('pagehide',()=>{closeMobile(false);closeDesktop();});
 function markActive(){for(const link of document.querySelectorAll('.active-link a,.lc-nav-drawer a')){try{const url=new URL(link.href,location.href);if(url.origin===location.origin&&url.pathname.replace(/\/$/,'')===location.pathname.replace(/\/$/,'')){link.classList.add('active');link.setAttribute('aria-current','page');}}catch{}}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',markActive,{once:true});else markActive();
})();