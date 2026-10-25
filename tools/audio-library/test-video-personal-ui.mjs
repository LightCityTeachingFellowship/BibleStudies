import assert from 'node:assert/strict';
class Element {
 constructor(tag='div'){this.tagName=tag;this.nodeType=1;this.children=[];this.dataset={};this.attrs={};this.hidden=false;this.textContent='';}
 appendChild(n){n.remove?.();n.parentNode=this;this.children.push(n);return n;}
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
const tabs=['saved','history'].map(view=>{const n=new Element('button');n.dataset.personalTab=view;return n;});
const settings=new Element('script');settings.dataset.base='/';
const document=Object.assign(new EventTarget(),{readyState:'complete',visibilityState:'visible',createElement:tag=>new Element(tag),getElementById:id=>nodes.get(id)||null,
 querySelector:selector=>selector.startsWith('script[data-lightcity-personal]')?settings:null,
 querySelectorAll:selector=>selector==='[data-personal-tab]'?tabs:selector==='.video-box[data-video-id]'?[card]:[]});
globalThis.document=document;globalThis.window=Object.assign(new EventTarget(),{confirm:()=>true});
globalThis.location={href:'https://example.com/Videos/',search:''};
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
globalThis.LightCityMembers={ready:Promise.resolve(),loading:false,user:null,library:null};
const {personal}=await import('../../script/video-personal.js');
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};await settle();
const save=card.querySelector('.lc-save-video');assert.ok(save);assert.equal(save.textContent,'Save');save.onclick();await settle();
assert.equal(save.textContent,'✓ Saved');assert.equal(nodes.get('my-video-list').children.length,1);
personal.record({videoId:id,seconds:75.25,duration:600,mode:'audio',rate:1.25});await settle();
assert.match(card.querySelector('.lc-video-resume').href,/mode=audio/);assert.match(card.querySelector('.lc-video-resume').href,/t=75/);
tabs[1].onclick();assert.equal(nodes.get('my-video-list').children.length,1);assert.equal(nodes.get('clear-video-history').hidden,false);
const row=nodes.get('my-video-list').children[0];assert.equal(row.querySelector('progress').value,75.25);
assert.ok(row.querySelectorAll('a').some(n=>n.textContent==='Start over'&&n.href.includes('t=0')));
nodes.get('clear-video-history').onclick();await settle();assert.equal(nodes.get('my-video-list').children.length,0);assert.ok(personal.saved(id));
personal.setIdentity('alice');globalThis.LightCityMembers.library=[{id:secret,title:'Private title'}];personal.save(secret,'Private title',true);await settle();
tabs[0].onclick();assert.equal(nodes.get('my-video-list').children.length,1);
globalThis.LightCityMembers.library=null;personal.setIdentity(null);await settle();assert.ok(nodes.get('my-video-list').children.every(n=>n.querySelector('h2').textContent!=='Private title'));
console.log('PASS: rendered Save buttons, saved/history views, audio continuation links, progress bars, start-over links, clear-history behavior, and member history hidden after sign-out.');
