import {videoShareLink} from './share-links.mjs?v=direct-publish-1';
const bound=new WeakSet();
const icons={share:'<path d="m14 3 8 7-8 7v-5C7 12 4 15 2 20c0-9 4-13 12-13z"/>',copy:'<path d="M9 5V2h13v16h-3M3 6h13v16H3z"/>'};
export function libraryMenu({document,holder,line,save,id,title,audio=false,navigator=globalThis.navigator}){
 const node=(tag,cls)=>{const n=document.createElement(tag);n.className=cls;return n;};
 if(!bound.has(document)){
  bound.add(document);
  document.addEventListener('click',event=>{for(const menu of document.querySelectorAll?.('.lc-library-menu')||[])if(menu.open&&!menu.contains(event.target))menu.open=false;});
 }
 let menu=holder.querySelector('.lc-library-menu');
 if(!menu){
  menu=node('details','lc-library-menu');const toggle=node('summary','lc-library-menu-toggle');toggle.setAttribute('aria-label',audio?'More audio actions':'More video actions');toggle.title=audio?'More audio actions':'More video actions';
  toggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
  const panel=node('div','lc-library-menu-panel');menu.appendChild(toggle);menu.appendChild(panel);line.appendChild(menu);
 }
 if(menu.parentNode!==line)line.appendChild(menu);
 const toggle=menu.querySelector('summary'),panel=menu.querySelector('.lc-library-menu-panel');
 menu.onkeydown=event=>{if(event.key==='Escape'&&menu.open){event.preventDefault();menu.open=false;toggle.focus();}};
 menu.onfocusout=event=>{if(event.relatedTarget&&!menu.contains(event.relatedTarget))menu.open=false;};
 menu.ontoggle=()=>{
  if(!menu.open)return;
  for(const other of document.querySelectorAll?.('.lc-library-menu')||[])if(other!==menu)other.open=false;
  if(panel.style&&panel.getBoundingClientRect){panel.style.transform='';const rect=panel.getBoundingClientRect(),width=document.documentElement?.clientWidth;if(width){const shift=rect.left<8?8-rect.left:rect.right>width-8?width-8-rect.right:0;if(shift)panel.style.transform=`translateX(${shift}px)`;}}
 };
 let label=save.querySelector('.lc-save-label');if(!label){label=node('span','lc-save-label');save.appendChild(label);}
 if(label.textContent!==save.getAttribute('aria-label'))label.textContent=save.getAttribute('aria-label');
 if(save.parentNode!==panel)panel.insertBefore(save,panel.children[0]||null);
 let feedback=holder.querySelector('.lc-library-share-feedback');
 const show=message=>{if(!feedback){feedback=node('div','lc-library-share-feedback');feedback.setAttribute('role','status');holder.appendChild(feedback);}feedback.replaceChildren();feedback.textContent=message;feedback.hidden=false;};
 const close=()=>{menu.open=false;toggle.focus();};
 const shareData=()=>({title:title(),text:title(),url:videoShareLink(id,{audio})});
 const copy=async()=>{
  close();const url=shareData().url;if(!url)return;
  try{await navigator.clipboard.writeText(url);show('LightCity link copied.');}
  catch{show('Copy this link to share.');const input=node('input','lc-library-copy-input');input.readOnly=true;input.value=url;input.setAttribute('aria-label','LightCity share link');feedback.appendChild(input);input.focus();input.select();}
 };
 for(const [key,text]of [['share','Share'],['copy','Copy link']]){
  let button=panel.querySelector('.lc-library-'+key);
  if(!button){button=node('button','lc-library-'+key);button.type='button';button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[key]+'</svg>';const caption=node('span','');caption.textContent=text;button.appendChild(caption);panel.appendChild(button);}
  button.onclick=async event=>{
   event?.preventDefault();event?.stopPropagation();
   if(key==='copy'||typeof navigator?.share!=='function'){await copy();return;}
   close();try{await navigator.share(shareData());}catch(error){if(error.name!=='AbortError')show('Use Copy link to share this item.');}
  };
 }
 return menu;
}