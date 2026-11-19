// Mount a lightweight section immediately, then load its implementation.
// If the user navigates away, late imports never update the new page.
import {createViewLoading} from './view-loading.mjs';
export function createLazyView({document,title,load,loadingScreen=false}){
 const element=document.createElement('section'),heading=document.createElement('h1'),status=document.createElement('p');heading.textContent=title;status.setAttribute('role','status');status.textContent='Loading…';element.append(heading,status);const loading=loadingScreen?createViewLoading(document):null;if(loading){heading.hidden=true;status.hidden=true;element.append(loading)}
 let disposed=false,child=null,options={},sequence=0;
 async function start(){const ticket=++sequence;status.textContent='Loading…';if(loading){loading.hidden=false;heading.hidden=true;status.hidden=true}try{const view=await load();if(disposed||ticket!==sequence){view.dispose?.();return}await view.prepare?.();if(disposed||ticket!==sequence){view.dispose?.();return}child=view;element.replaceChildren(view.element);view.activate?.(options)}catch{if(!disposed&&ticket===sequence){if(loading){loading.hidden=true;heading.hidden=false;status.hidden=false}status.textContent='Unable to open this section.';const retry=document.createElement('button');retry.type='button';retry.textContent='Retry';retry.onclick=()=>{retry.remove();void start()};element.append(retry)}}}
 return {element,activate(context={}){options=context;void start()},dispose(){disposed=true;++sequence;child?.dispose?.()}};
}
