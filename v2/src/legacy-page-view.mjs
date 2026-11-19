// Keep the original interactive Bible study pages and their scripts intact.
export function createLegacyPageView({document,url}){
 const root=document.createElement('section'),status=document.createElement('p'),frame=document.createElement('iframe'),controller=new AbortController();
 root.className='lc-v2-legacy-page';status.setAttribute('role','status');status.textContent='Opening Bible study…';frame.className='lc-v2-legacy-frame';frame.title='Bible study';frame.hidden=true;root.append(status,frame);let disposed=false;
 async function load(){try{
  const value=url.searchParams.get('url');if(!value)throw Error('This page is unavailable.');const target=new URL(value,document.location.origin);
  if(target.origin!==document.location.origin||!['http:','https:'].includes(target.protocol)||target.username||target.password)throw Error('This page is unavailable.');
  const response=await fetch('/legacy-app-pages.json',{signal:controller.signal});if(!response.ok)throw Error('This page is unavailable.');const data=await response.json();
  if(disposed)return;const entry=Array.isArray(data.pages)&&data.pages.find(item=>{try{return new URL(item.url,document.location.origin).pathname===target.pathname}catch{return false}});
  if(!entry)throw Error('This page is unavailable.');frame.title=entry.title||'Bible study';frame.addEventListener('load',()=>{if(!disposed){frame.hidden=false;status.textContent=''}},{once:true});frame.src=target.href;
 }catch(error){if(!disposed&&error.name!=='AbortError')status.textContent='Unable to open this Bible study. Please try again.'}}
 return {element:root,activate(){void load()},dispose(){disposed=true;controller.abort();frame.remove()}};
}
