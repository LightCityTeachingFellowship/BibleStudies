import {sameReadingURL,waitForReadingSession} from './reading-navigation.mjs?v=1';
import {createViewLoading} from './view-loading.mjs';
import {mountOriginalReader} from './original-reader.mjs?v=categories-2';
// Only publications in the verified audience's catalogue may be displayed.
export function createReaderView({document,url,services,fetchPage=fetch}){
 const element=document.createElement('section'),title=document.createElement('h1'),status=document.createElement('p'),full=document.createElement('a'),content=document.createElement('div'),controller=new AbortController();
 title.textContent='Reading';status.setAttribute('role','status');status.textContent='Loadingâ€¦';full.textContent='Open full reader';full.hidden=true;element.append(title,status,full,content);const loading=createViewLoading(document,'Opening reading pageâ€¦');element.append(loading);
 let disposed=false,revoked=false,unsubscribeAccess=null,originalReader=null;
 async function load(){try{
  const requested=url.searchParams.get('url');if(!requested)throw Error('Invalid reading link');let target=new URL(requested,document.location.origin);
  if(target.origin!==document.location.origin||!/^https?:$/.test(target.protocol))throw Error('Invalid reading link');
  await waitForReadingSession(services.session,controller.signal);if(disposed)return;let catalogue;try{catalogue=await services.resources.get('publications')}catch(error){if(error?.name!=='AbortError'||controller.signal.aborted)throw error;await waitForReadingSession(services.session,controller.signal);catalogue=await services.resources.get('publications')}if(disposed)return;
  const find=()=>catalogue?.publications?.find(row=>{try{return [row.url,row.previousUrl].filter(Boolean).some(link=>sameReadingURL(link,target.href,document.location.origin))}catch{return false}});
  let publication=find();if(!publication&&catalogue?.memberReady){await catalogue.memberReady;if(disposed)return;publication=find()}
  if(!publication)throw Error('This publication is unavailable');target=new URL(publication.url,document.location.origin);if(['Article','Summary'].includes(publication.kind))services.setSearchScope?.(publication.kind);
  if(publication.visibility==='members'){
   const state=services.session.state;if(state.status!=='member'||!state.user?.uid)throw Error('Member access is required');const owner=state.user.uid;
   unsubscribeAccess=services.session.subscribe(next=>{if(next.status==='member'&&next.user?.uid===owner)return;revoked=true;loading.hidden=true;controller.abort();originalReader?.dispose();originalReader=null;content.replaceChildren();title.hidden=false;title.textContent='Member access required';full.hidden=true;status.textContent='Sign in with an approved member account to continue.'});
  }
  if(revoked||disposed)return;title.textContent=publication.title;const fallback=new URL(target.href);fallback.searchParams.set('lc-legacy','1');full.href=fallback.href;full.hidden=false;
  const response=await fetchPage(target.href,{signal:controller.signal});if(!response.ok)throw Error('Unable to load this publication');const html=await response.text();if(disposed||revoked)return;
  const parsed=new DOMParser().parseFromString(html,'text/html'),source=parsed.querySelector('[data-study-body]');if(!source)throw Error('This publication requires the full reader');
  const generated=source.querySelector('[data-generated-summary]');if(generated){if(publication.visibility!=='members'||services.session.state.status!=='member')throw Error('Member access is required');const id=generated.getAttribute('data-generated-summary');if(!id||!services.api?.learning)throw Error('This summary is unavailable');const result=await services.api.learning({id});if(disposed||revoked)return;if(result?.resource?.kind!=='Summary'||!Array.isArray(result.resource.sections))throw Error('This summary is unavailable')}
  title.hidden=true;full.hidden=true;status.textContent='Opening readerâ€¦';const readerTarget=new URL(target.href);readerTarget.searchParams.set('lc-preview-reader','1');readerTarget.hash=url.hash;if(url.searchParams.get('continue')==='reading')readerTarget.searchParams.set('continue','reading');
  originalReader=mountOriginalReader({document,target:readerTarget,container:content,services,catalogue,onReady:(_frame,bibleLoading)=>{if(!disposed&&!revoked){loading.hidden=true;status.textContent=bibleLoading?'Loading Bible toolsâ€¦':''}},onBibleReady:ok=>{if(!disposed&&!revoked)status.textContent=ok?'':'Bible tools could not load. Refresh to try again.'},onError:()=>{if(!disposed&&!revoked){loading.hidden=true;title.hidden=false;full.hidden=false;status.textContent='The original reader could not be opened. Use Open full reader to try again.'}}});
 }catch(error){if(!disposed&&!revoked){loading.hidden=true;status.textContent=error?.name==='AbortError'?'Unable to restore your session. Refresh and try again.':error?.message||'Unable to load this publication.'}}}
 return {element,activate(){document.body.classList.remove('desktop-rail-expanded');document.body.classList.add('lc-v2-reader-active');const toggle=document.getElementById('desktop-menu');if(toggle){toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Expand navigation')}void load()},dispose(){document.body.classList.remove('lc-v2-reader-active','desktop-rail-expanded');disposed=true;originalReader?.dispose();unsubscribeAccess?.();controller.abort()}};
}
