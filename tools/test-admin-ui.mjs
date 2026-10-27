import assert from 'node:assert/strict';
import {setupAdmin} from '../script/admin.mjs';
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.handlers={};this.dataset={};this.attrs={};this.textContent='';this.value='';this.hidden=false;}
 addEventListener(event,fn){this.handlers[event]=fn;}appendChild(n){this.children.push(n);n.parentNode=this;return n;}
 replaceChildren(...nodes){this.children=[];nodes.forEach(n=>this.appendChild(n));}setAttribute(k,v){this.attrs[k]=v;}
 querySelectorAll(selector){return this.children.flatMap(n=>[...(selector[0]==='.'?n.className===selector.slice(1)?[n]:[]:n.tagName===selector?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}focus(){this.focused=true;}select(){this.selected=true;}
}
const ids=['content','account','gate','signin','signout','refresh','status','totals','quick','quick-result','quick-link','quick-copy','quick-form','search','tabs','results','list','more'];
const nodes=Object.fromEntries(ids.map(id=>['admin-'+id,new Element()]));
const document={getElementById:id=>nodes[id],createElement:tag=>new Element(tag)};const window={handlers:{},addEventListener(event,fn){this.handlers[event]=fn;}};
const videoId='abcdefghijk';const data={account:'owner@example.com',videos:[{id:videoId,title:'Live prayer',live:true,audio:true,published:true,visibility:'members'}],readings:[{title:'Public article',url:'/article/',kind:'Article',visibility:'public'}],checks:{audio:true,live:true,readings:true},updatedAt:Date.now()};
let copied,shared;const navigator={clipboard:{writeText:async url=>{copied=url;}},share:async item=>{shared=item;}};
const client={enabled:true,user:{uid:'owner',email:data.account},ready:Promise.resolve(),getAdminDashboard:async()=>data,signOut:async()=>{client.user=null;}};
const ui=setupAdmin({document,window,navigator,api:()=>client});const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};await settle();
assert.equal(nodes['admin-content'].hidden,false);assert.equal(nodes['admin-gate'].hidden,true);assert.equal(nodes['admin-totals'].children.length,4);
let row=nodes['admin-list'].children[0];await row.querySelectorAll('button')[0].handlers.click();await settle();assert.equal(copied,'https://lightcityfellowship.com/Watch/?v='+videoId);
await row.querySelectorAll('button').find(b=>b.textContent==='Copy audio link').handlers.click();await settle();assert.equal(copied,'https://lightcityfellowship.com/Listen/?v='+videoId);
await row.querySelectorAll('button').find(b=>b.textContent==='Share').handlers.click();assert.equal(shared.url,'https://lightcityfellowship.com/Watch/?v='+videoId);
nodes['admin-search'].value='article';nodes['admin-search'].handlers.input();assert.ok(nodes['admin-list'].children.some(row=>row.querySelector('h3').textContent==='Public article'));
nodes['admin-quick'].value='https://youtube.com/live/'+videoId;nodes['admin-quick-form'].handlers.submit({preventDefault(){}});assert.equal(nodes['admin-quick-link'].value,'https://lightcityfellowship.com/Watch/?v='+videoId);
nodes['admin-search'].value='';
data.videos=Array.from({length:70},(_,i)=>({id:String(i).padStart(11,'0'),title:'Recording '+i,published:true,visibility:'public'}));await ui.load();assert.equal(nodes['admin-list'].children.length,36);nodes['admin-more'].handlers.click();assert.equal(nodes['admin-list'].children.length,72,'large catalogues paginate without opening content pages');
await nodes['admin-signout'].handlers.click();assert.equal(nodes['admin-content'].hidden,true);assert.equal(nodes['admin-list'].children.length,0);assert.equal(nodes['admin-quick-link'].value,'');
// An in-flight admin response cannot repaint private content after account change.
client.user={uid:'owner',email:data.account};let resolveOld;client.getAdminDashboard=()=>new Promise(resolve=>{resolveOld=resolve;});const loading=ui.load();await settle();
client.user=null;await ui.load();resolveOld(data);await loading;assert.equal(nodes['admin-content'].hidden,true);assert.equal(nodes['admin-list'].children.length,0);
client.user={uid:'ordinary'};client.getAdminDashboard=async()=>{throw {code:'functions/permission-denied'};};await ui.load();assert.equal(nodes['admin-content'].hidden,true);assert.ok(nodes['admin-status'].textContent.includes('does not have admin access'));
console.log('PASS: dashboard rendering, video/audio copying, native sharing, search, quick links, sign-out cleanup, denied accounts and stale-response protection.');
