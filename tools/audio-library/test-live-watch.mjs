import assert from 'node:assert/strict';
class Element extends EventTarget{
 constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.hidden=false;this.textContent='';this.nodeType=1;this.classList={remove:(...names)=>{this.className=(this.className||'').split(' ').filter(c=>!names.includes(c)).join(' ');}};}
 appendChild(n){n.remove?.();this.children.push(n);n.parentNode=this;n.parentElement=this;return n;}append(...nodes){nodes.forEach(n=>this.appendChild(n));}
 insertBefore(n,b){n.remove?.();let i=this.children.indexOf(b);if(i<0)i=this.children.length;this.children.splice(i,0,n);n.parentNode=this;n.parentElement=this;}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;this.parentElement=null;}
 replaceChildren(...nodes){for(const n of this.children){n.parentNode=null;n.parentElement=null;}this.children=[];this.append(...nodes);}
 setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}
 matches(selector){return selector.split(',').some(s=>{s=s.trim();if(s.startsWith('#'))return this.id===s.slice(1);if(s.startsWith('.'))return this.className?.split(' ').includes(s.slice(1));if(s.startsWith('[data-'))return Object.hasOwn(this.dataset,s.slice(6,-1).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()));return this.tagName.toLowerCase()===s;});}
 querySelectorAll(s){return this.children.flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)]);}querySelector(s){return this.querySelectorAll(s)[0]||null;}
 getClientRects(){return[{}];}getBoundingClientRect(){return this.rect||{top:0,bottom:3000};}scrollIntoView(){this.scrolled=true;}focus(){this.focused=true;}
}
const root=new Element(),actions=new Element(),title=new Element('h3'),settings=new Element('script');root.appendChild(title);root.appendChild(actions);settings.dataset={base:'/'};
const id='abcdefghijk',data=new Element('script');data.textContent=JSON.stringify({[id]:'Live event'});let replay=false;
globalThis.document=Object.assign(new EventTarget(),{readyState:'complete',visibilityState:'visible',createElement:t=>new Element(t),getElementById:name=>({'watch-personal-actions':actions,'watch-title':title,'lc-public-video-data':data}[name]||null),querySelector:s=>s==='script[data-lightcity-personal]'?settings:null,querySelectorAll:()=>[]});
globalThis.window=new EventTarget();globalThis.location={href:'https://example.com/Watch/?v='+id,origin:'https://example.com',search:'?v='+id};
globalThis.localStorage={getItem(){},setItem(){}};globalThis.LightCityMembers={ready:Promise.resolve(),library:null,user:null,loading:false,getLiveAudio:async()=>({recordings:[{videoId:id,kind:'live',session:'session-1792873903632',expiresAt:Date.now()+3600000,replay}]})};
const {personal}=await import('../../script/video-personal.js?v=live-navigation-1');const {getLiveRecordings}=await import('../../script/live-status.mjs');const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setTimeout(r,5));};
personal.record({videoId:id,title:'Live event',seconds:200,duration:300,mode:'audio'});await settle();assert.equal(actions.querySelector('.lc-video-resume').textContent,'LIVE','Watch displays live status instead of a saved timestamp');
replay=true;await getLiveRecordings({force:true});await settle();assert.equal(actions.querySelector('.lc-video-resume').textContent,'Continue from 3:20','ended broadcasts resume normal progress');
console.log('PASS: actual Watch personal controls show LIVE for active events and Continue from for ended recordings.');
