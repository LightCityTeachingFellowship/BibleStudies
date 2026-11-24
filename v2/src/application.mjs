import {createRouter,isOrdinaryLink} from './router.mjs?v=app-v2-1';
import {createSessionService} from './session.mjs?v=app-v2-1';
import {createPlayerService} from './player.mjs?v=app-v2-1';
import {createResourceStore} from './resource-store.mjs?v=app-v2-1';
// Application services are created once, above the route outlet. A view may
// use them but cannot destroy them when navigation occurs.
export function createApplication({window,document,outlet,playerMount,routes,sessionAdapter,playerAdapter,loadResource,onError}){
 const session=createSessionService(sessionAdapter);
 const player=createPlayerService({mount:playerMount,...playerAdapter});
 const resources=createResourceStore({load:loadResource});
 let lastIdentity='public',lastAccess='public';const viewState=new Map();
 const unsubscribe=session.subscribe(state=>{
  const identity=state.user&&!state.user.isAnonymous?'user:'+state.user.uid:'public';
  const access=state.status==='member'?'member:'+state.user.uid:identity;
  const lostMembership=lastAccess.startsWith('member:')&&access!==lastAccess;
  if(access!==lastAccess){lastAccess=access;resources.setScope(access)}
  if(identity!==lastIdentity||lostMembership){lastIdentity=identity;viewState.clear();player.close()}
 });
 const services={session,player,resources,viewState};
 const boundRoutes=routes.map(route=>({...route,load:context=>route.load({...context,services})}));
 const names={video:'videos',audio:'audio',Article:'articles',Summary:'summaries',all:'all resources'};
 services.searchScope='all';services.setSearchScope=scope=>{if(!Object.hasOwn(names,scope))scope='all';services.searchScope=scope;const desktop=document.querySelector('#desktop-search');if(desktop){desktop.setAttribute('aria-label','Search '+names[scope]);const label=desktop.querySelector('span');if(label){const home=window.location.pathname.replace(/\/+$/,'').toLowerCase()==='/v2';label.textContent=home&&scope==='all'?'Search...':'Search '+names[scope]+'...'}}const mobile=document.querySelector('#search-open');if(mobile)mobile.setAttribute('aria-label','Search '+names[scope]);window.dispatchEvent(new Event('lightcity-search-scope-changed'))};
 const onChange=url=>{document.body.classList.toggle('lc-v2-watch-pending',url.pathname.replace(/\/+$/,'')==='/v2/watch');const key=url.pathname.replace(/\/+$/,'').toLowerCase();if(key==='/v2'||key===''){document.body.classList.remove('desktop-rail-expanded');const toggle=document.getElementById('desktop-menu');if(toggle){toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Expand navigation')}}services.setSearchScope(key==='/v2/categories'?(url.searchParams.get('kind')==='Summary'?'Summary':'Article'):({'/v2/videos':'video','/v2/watch':'video','/v2/audio':'audio','/v2/articles':'Article','/v2/summaries':'Summary'})[key]||'all');for(const link of document.querySelectorAll('nav a[href]')){const selected=new URL(link.href,window.location.href).pathname===url.pathname;if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')}window.dispatchEvent(new Event('lightcity-route-changed'))};
 const router=createRouter({outlet,routes:boundRoutes,history:window.history,location:window.location,onError,onChange});services.router=router;
 services.openWatch=({id,mode='video',kind='video',startSeconds=null})=>{const url=new URL('/v2/watch/',window.location.href);url.searchParams.set('v',id);url.searchParams.set('mode',mode);if(kind==='archive')url.searchParams.set('kind','archive');if(Number.isFinite(startSeconds)&&startSeconds>=0&&startSeconds<=172800)url.searchParams.set('t',String(startSeconds));return router.navigate(url.href)};
 const click=event=>{
  const anchor=event.target?.closest?.('a[href]');if(!isOrdinaryLink(event,anchor))return;
  let url;try{url=new URL(anchor.href,window.location.href)}catch{return}
  const current=new URL(window.location.href);
  if(url.origin===current.origin&&url.pathname===current.pathname&&url.search===current.search&&url.hash)return;
  if(!router.matches(url)){if(services.openURL?.(url.href))event.preventDefault();return}
  event.preventDefault();void router.navigate(url);
 };
 const pop=()=>{void router.navigate(window.location.href,{pop:true})};
 const nativeBridge={back:()=>router.back(),refresh:()=>{if(outlet.scrollTop>0)return false;resources.clear();void router.navigate(window.location.href,{replace:true});return true}};
 return {services,router,async start({initialURL=window.location.href,skipInitialRoute=false}={}){document.addEventListener('click',click);window.addEventListener('popstate',pop);window.LightCityNavigationShell=nativeBridge;session.start();return skipInitialRoute?true:router.navigate(initialURL,{replace:true});},destroy(){document.removeEventListener('click',click);window.removeEventListener('popstate',pop);unsubscribe();if(window.LightCityNavigationShell===nativeBridge)delete window.LightCityNavigationShell;router.destroy();player.destroy();session.destroy();resources.clear();}};
}
