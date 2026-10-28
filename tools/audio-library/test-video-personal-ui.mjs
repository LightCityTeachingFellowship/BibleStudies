import assert from 'node:assert/strict';
class Element {
 constructor(tag='div'){this.tagName=tag;this.nodeType=1;this.children=[];this.dataset={};this.attrs={};this.hidden=false;this.textContent='';}
 appendChild(n){n.remove?.();n.parentNode=this;this.children.push(n);return n;}
 insertBefore(n,before){n.remove?.();n.parentNode=this;const i=this.children.indexOf(before);if(i<0)this.children.push(n);else this.children.splice(i,0,n);return n;}
 append(...nodes){nodes.forEach(n=>this.appendChild(n));}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
 setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 querySelectorAll(selector){const found=[];for(const n of this.children){if(selector.startsWith('.')?n.className?.split(' ').includes(selector.slice(1)):n.tagName===selector)found.push(n);found.push(...n.querySelectorAll(selector));}return found;}
}
const id='abcdefghijk', secret='ABCDEFGHIJK', nodes=new Map();
const add=(id,tag='div')=>{const n=new Element(tag);nodes.set(id,n);return n;};
add('lc-public-video-data').textContent=JSON.stringify({[id]:'Public teaching'});
for(const name of ['my-video-list','my-video-status','my-video-empty','clear-video-history','load-more-videos'])add(name);
const grid=add('videotab-container'), card=new Element();card.dataset.videoId=id;card.setAttribute('video-title','Public teaching');grid.appendChild(card);
const title=new Element('h3');title.className='video-title';title.textContent='Public teaching';card.appendChild(title);
const search=add('home-search-results'), result=new Element('li');result.dataset.videoId=id;result.className='lc-search-video-result';const resultLink=new Element('a');resultLink.href='https://example.com/Watch/?v='+id;const resultTitle=new Element('strong');resultTitle.textContent='Public teaching';resultLink.appendChild(resultTitle);result.appendChild(resultLink);search.appendChild(result);
const tabs=['saved','history'].map(view=>{const n=new Element('button');n.dataset.personalTab=view;return n;});
const settings=new Element('script');settings.dataset.base='/';
const document=Object.assign(new EventTarget(),{readyState:'complete',visibilityState:'visible',createElement:tag=>new Element(tag),getElementById:id=>nodes.get(id)||null,
 querySelector:selector=>selector.startsWith('script[data-lightcity-personal]')?settings:null,
 querySelectorAll:selector=>selector==='[data-personal-tab]'?tabs:selector==='.video-box[data-video-id]'?[card]:selector==='.lc-search-video-result[data-video-id]'?[result]:[]});
globalThis.document=document;globalThis.window=Object.assign(new EventTarget(),{confirm:()=>true});
globalThis.location={href:'https://example.com/Videos/',search:''};
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
globalThis.LightCityMembers={ready:Promise.resolve(),loading:false,user:null,library:null};
const {personal}=await import('../../script/video-personal.js');
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};await settle();
const save=card.querySelector('.lc-save-video');assert.ok(save);assert.equal(save.getAttribute('aria-pressed'),'false');assert.match(save.innerHTML,/<svg/);assert.equal(save.parentNode.className,'lc-library-menu-panel');assert.equal(card.querySelector('.lc-library-menu').parentNode,title.parentNode);assert.equal(title.parentNode.className,'lc-video-title-row');save.onclick();await settle();
assert.equal(save.getAttribute('aria-pressed'),'true');assert.equal(nodes.get('my-video-list').children.length,1);
const searchSave=result.querySelector('.lc-save-video');assert.ok(searchSave);assert.equal(searchSave.parentNode,result);assert.equal(searchSave.getAttribute('aria-pressed'),'true');
let prevented=false;searchSave.onclick({preventDefault(){prevented=true;},stopPropagation(){}});await settle();assert.ok(prevented);assert.equal(save.getAttribute('aria-pressed'),'false');assert.equal(resultLink.href,'https://example.com/Watch/?v='+id);searchSave.onclick();await settle();assert.equal(save.getAttribute('aria-pressed'),'true');
title.remove();const replacement=new Element('h3');replacement.className='video-title';replacement.textContent='Updated teaching';card.appendChild(replacement);window.dispatchEvent(new Event('lightcity-video-activity'));await settle();assert.equal(replacement.parentNode,card.querySelector('.lc-library-menu').parentNode);assert.equal(card.querySelectorAll('.lc-save-video').length,1);
personal.record({videoId:id,seconds:75.25,duration:600,mode:'audio',rate:1.25});await settle();
assert.match(card.querySelector('.lc-video-resume').href,/mode=audio/);assert.match(card.querySelector('.lc-video-resume').href,/t=75/);
tabs[1].onclick();assert.equal(nodes.get('my-video-list').children.length,1);assert.equal(nodes.get('clear-video-history').hidden,false);
const row=nodes.get('my-video-list').children[0];assert.equal(row.querySelector('progress').value,75.25);
assert.ok(row.querySelectorAll('a').some(n=>n.textContent==='Start over'&&n.href.includes('t=0')));
nodes.get('clear-video-history').onclick();await settle();assert.equal(nodes.get('my-video-list').children.length,0);assert.ok(personal.saved(id));
personal.setIdentity('alice');globalThis.LightCityMembers.library=[{id:secret,title:'Private title'}];personal.save(secret,'Private title',true);await settle();
tabs[0].onclick();assert.equal(nodes.get('my-video-list').children.length,1);
globalThis.LightCityMembers.library=null;personal.setIdentity(null);await settle();assert.ok(nodes.get('my-video-list').children.every(n=>n.querySelector('h2').textContent!=='Private title'));
console.log('PASS: bookmark icons beside updated titles and search results without navigation, saved/history views, audio continuation links, progress bars, start-over links, clear-history behavior, and member history hidden after sign-out.');
const {libraryMenu}=await import('../../script/library-menu.mjs');
Element.prototype.contains=function(target){return target===this||this.children.some(n=>n.contains(target));};
Element.prototype.focus=function(){this.focused=true;};Element.prototype.select=function(){this.selected=true;};
const audioHolder=new Element();audioHolder.className='video-box lc-audio-card';const line=new Element();audioHolder.appendChild(line);const bookmark=new Element('button');bookmark.className='lc-save-video';bookmark.setAttribute('aria-label','Save video for later');
let shared,copied;const nav={share:async data=>{shared=data;},clipboard:{writeText:async url=>{copied=url;}}};
const menu=libraryMenu({document,holder:audioHolder,line,save:bookmark,id,title:()=> 'Prayer meeting',audio:true,navigator:nav});
const videoMenu=card.querySelector('.lc-library-menu'),oldQuery=document.querySelectorAll;
document.querySelectorAll=selector=>selector==='.lc-library-menu'?[videoMenu,menu]:oldQuery(selector);
videoMenu.open=true;menu.open=true;menu.ontoggle();assert.equal(videoMenu.open,false,'opening one menu closes the other');
await menu.querySelector('.lc-library-share').onclick();assert.equal(menu.open,false);assert.equal(shared.url,'https://auth.lightcityfellowship.com/Share/Audio/'+id+'/');assert.equal(shared.title,'Prayer meeting');
await menu.querySelector('.lc-library-copy').onclick();assert.equal(copied,shared.url);assert.equal(audioHolder.querySelector('.lc-library-share-feedback').textContent,'LightCity link copied.');
menu.open=true;let escaped=false;menu.onkeydown({key:'Escape',preventDefault(){escaped=true;}});assert.equal(menu.open,false);assert.equal(escaped,true);assert.equal(menu.querySelector('summary').focused,true);
menu.open=true;document.dispatchEvent(new Event('click'));assert.equal(menu.open,false,'outside click closes menu');
menu.open=true;menu.onfocusout({relatedTarget:new Element()});assert.equal(menu.open,false,'Tab to outside closes menu');
libraryMenu({document,holder:audioHolder,line,save:bookmark,id,title:()=> 'Updated title',audio:true,navigator:{}});
await menu.querySelector('.lc-library-copy').onclick();assert.equal(audioHolder.querySelector('input').value,shared.url);assert.equal(audioHolder.querySelector('input').selected,true,'manual-copy fallback selects usable link');
assert.equal(audioHolder.querySelectorAll('.lc-library-menu').length,1);assert.equal(menu.querySelectorAll('.lc-save-video').length,1);
console.log('PASS: library menus preserve bookmarks, use audio share links, close on outside click/Escape/Tab, focus the trigger, avoid duplicate menus and provide manual copy fallback.');const home=new Element();home.className='home-featured';home.dataset.videoId=id;const copyBox=new Element();copyBox.className='home-featured-copy';home.appendChild(copyBox);const featuredTitle=new Element('a');featuredTitle.className='home-video-title';featuredTitle.textContent='Homepage video';copyBox.appendChild(featuredTitle);
const previousQuery=document.querySelector;document.querySelector=selector=>selector==='.home-featured[data-video-id]'?home:previousQuery(selector);
window.dispatchEvent(new Event('lightcity-video-activity'));await settle();
assert.ok(home.querySelector('.lc-library-menu'));assert.equal(home.querySelector('.lc-library-menu').parentNode,featuredTitle.parentNode);assert.equal(home.querySelector('.lc-personal-actions'),null,'homepage gains only menu, no inline playback or resume row');
home.dataset.videoId=secret;globalThis.LightCityMembers.library=[{id:secret,title:'New featured video'}];featuredTitle.textContent='New featured video';home.querySelector('.lc-library-menu').open=true;window.dispatchEvent(new Event('lightcity-video-activity'));await settle();assert.equal(home.querySelector('.lc-library-menu').open,false,'changed featured ID closes stale menu');assert.equal(home.querySelectorAll('.lc-library-menu').length,1);assert.equal(home.querySelector('.lc-library-menu').dataset.videoId,secret);
console.log('PASS: homepage title menu, current featured ID, unchanged Watch flow and safe rebinding after audience/video changes.');