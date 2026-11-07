import assert from 'node:assert/strict';
import {setupAdmin} from '../script/admin.mjs';
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.handlers={};this.dataset={};this.attrs={};this.textContent='';this.value='';this.hidden=false;}
 addEventListener(event,fn){this.handlers[event]=fn;}appendChild(n){this.children.push(n);n.parentNode=this;return n;}
 replaceChildren(...nodes){this.children=[];nodes.forEach(n=>this.appendChild(n));}setAttribute(k,v){this.attrs[k]=v;}
 querySelectorAll(selector){return this.children.flatMap(n=>[...(selector[0]==='.'?n.className===selector.slice(1)?[n]:[]:n.tagName===selector?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}focus(){this.focused=true;}select(){this.selected=true;}
}
const ids=['content','account','gate','signin','signout','refresh','status','totals','quick','quick-result','quick-link','quick-copy','quick-form','search','tabs','results','list','more','audio-pending'];
const nodes=Object.fromEntries(ids.map(id=>['admin-'+id,new Element()]));
const descendants=element=>element.children.flatMap(child=>[child,...descendants(child)]);
const document={getElementById:id=>nodes[id]||Object.values(nodes).flatMap(descendants).find(element=>element.id===id),createElement:tag=>new Element(tag)};let replacement;
const window={handlers:{},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent(event){replacement=event.detail;},addEventListener(event,fn){this.handlers[event]=fn;}};
const videoId='abcdefghijk';const data={account:'owner@example.com',videos:[{id:videoId,title:'Live prayer',live:true,concurrentViewers:0,audio:true,published:true,visibility:'members'}],readings:[{title:'Public article',url:'/article/',kind:'Article',visibility:'public'}],checks:{audio:true,live:true,readings:true},updatedAt:Date.now()};
let copied,shared,confirmed=false,removed=[];window.confirm=()=>confirmed;const navigator={clipboard:{writeText:async url=>{copied=url;}},share:async item=>{shared=item;}};
const client={enabled:true,user:{uid:'owner',email:data.account},ready:Promise.resolve(),getAdminDashboard:async()=>data,removeStudioVideo:async id=>{removed.push(id);data.videos=data.videos.filter(v=>v.id!==id);},signOut:async()=>{client.user=null;}};
const ui=setupAdmin({document,window,navigator,api:()=>client,loadArchive:async()=>({recordings:[{id:'a'.repeat(32),title:'Old fellowship message',group:'Fellowship Days',year:'2018'}]})});const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};await settle();
assert.equal(nodes['admin-content'].hidden,false);assert.equal(nodes['admin-gate'].hidden,true);assert.equal(nodes['admin-totals'].children.length,4);
assert.equal(nodes['admin-totals'].children[1].children[0].textContent,'2');
const audioTab=nodes['admin-tabs'].children.find(button=>button.dataset.tab==='Audio');
audioTab.handlers.click();
assert.match(nodes['admin-results'].textContent,/^2 items/);
const archiveRow=nodes['admin-list'].children.find(row=>row.querySelector('h3').textContent==='Old fellowship message');
assert.equal(archiveRow.querySelector('a').href,'https://lightcityfellowship.com/Listen/?archive='+'a'.repeat(32));
assert.ok(!archiveRow.querySelectorAll('button').some(button=>button.textContent==='Remove'));
nodes['admin-tabs'].children.find(button=>button.dataset.tab==='All').handlers.click();
let row=nodes['admin-list'].children[0];assert.ok(row.querySelectorAll('span').some(badge=>badge.textContent==='0 watching on YouTube'));await row.querySelectorAll('button')[0].handlers.click();await settle();assert.equal(copied,'https://auth.lightcityfellowship.com/Share/Video/'+videoId+'/');
row.querySelectorAll('button').find(b=>b.textContent==='Replace').handlers.click();assert.deepEqual(replacement,{videoId,title:'Live prayer',visibility:'members'});
assert.ok(!archiveRow.querySelectorAll('button').some(button=>button.textContent==='Replace'));
await row.querySelectorAll('button').find(b=>b.textContent==='Copy audio link').handlers.click();await settle();assert.equal(copied,'https://auth.lightcityfellowship.com/Share/Audio/'+videoId+'/');
await row.querySelectorAll('button').find(b=>b.textContent==='Share').handlers.click();assert.equal(shared.url,'https://auth.lightcityfellowship.com/Share/Video/'+videoId+'/');
await row.querySelectorAll('button').find(b=>b.textContent==='Remove').handlers.click();assert.equal(removed.length,0,'cancel keeps video');confirmed=true;
await row.querySelectorAll('button').find(b=>b.textContent==='Remove').handlers.click();assert.deepEqual(removed,[videoId]);assert.ok(!nodes['admin-list'].children.some(r=>r.querySelector('h3').textContent==='Live prayer'));
nodes['admin-search'].value='article';nodes['admin-search'].handlers.input();assert.ok(nodes['admin-list'].children.some(row=>row.querySelector('h3').textContent==='Public article'));
nodes['admin-quick'].value='https://youtube.com/live/'+videoId;nodes['admin-quick-form'].handlers.submit({preventDefault(){}});assert.equal(nodes['admin-quick-link'].value,'https://auth.lightcityfellowship.com/Share/Video/'+videoId+'/');
// A shared background refresh preserves the current form, results filter and totals.
nodes['admin-quick'].value='typed unpublished link';
await ui.load({quiet:true});assert.equal(nodes['admin-search'].value,'article');assert.equal(nodes['admin-quick'].value,'typed unpublished link');assert.equal(nodes['admin-totals'].children.length,4);
assert.ok(nodes['admin-list'].children.some(row=>row.querySelector('h3').textContent==='Public article'));
nodes['admin-search'].value='';
data.videos=Array.from({length:70},(_,i)=>({id:String(i).padStart(11,'0'),title:'Recording '+i,published:true,visibility:'public'}));await ui.load();assert.equal(nodes['admin-list'].children.length,36);nodes['admin-more'].handlers.click();assert.equal(nodes['admin-list'].children.length,72,'large catalogues paginate without opening content pages');
// Pending audio remains reachable even below the first page of published videos,
// and while the main catalogue is filtered to audio or an unrelated search.
const oldId=data.videos[0].id,newId='newaudio123';
data.videos[0].audio=true;data.videos[0].pendingReplacementId=newId;
data.videos.push({id:newId,title:'Replacement recording',published:false,replacement:true,replaceVideoId:oldId,visibility:'public'});
await ui.load();
nodes['admin-tabs'].children.find(button=>button.dataset.tab==='All').handlers.click();
const pendingPanel=nodes['admin-audio-pending'];
assert.equal(pendingPanel.hidden,false);
assert.equal(nodes['admin-list'].children.length,36);
assert.ok(!nodes['admin-list'].children.some(row=>row.querySelector('h3').textContent==='Replacement recording'),'pending ID really is beyond catalogue pagination');
assert.ok(pendingPanel.querySelectorAll('strong').some(title=>title.textContent==='Replacement recording'));
const retryButtons=container=>container.querySelectorAll('button').filter(button=>/Retry audio processing|Requesting retry/.test(button.textContent));
let resolveRetry,retryIds=[];
client.retryPublication=id=>{retryIds.push(id);return new Promise(resolve=>{resolveRetry=resolve;});};
const originalRow=nodes['admin-list'].children[0];
const originalRetry=retryButtons(originalRow)[0];assert.ok(originalRetry,'published original exposes its pending replacement retry');
const retrying=originalRetry.handlers.click();
assert.deepEqual(retryIds,[newId],'retry targets the NEW replacement ID, never the published original');
assert.ok(retryButtons(pendingPanel).every(button=>button.disabled),'every copy of the retry button is disabled while requesting');
assert.ok(retryButtons(nodes['admin-list']).every(button=>button.disabled));
await originalRetry.handlers.click();assert.equal(retryIds.length,1,'a duplicate click cannot send another request');
resolveRetry();await retrying;
assert.equal(retryButtons(pendingPanel)[0].disabled,false);
assert.match(document.getElementById('admin-audio-pending-status').textContent,new RegExp(newId));
audioTab.handlers.click();assert.equal(pendingPanel.hidden,false,'pending audio remains visible in Audio tab');
nodes['admin-search'].value='no matching recordings';nodes['admin-search'].handlers.input();
assert.equal(nodes['admin-list'].children.length,0);assert.equal(pendingPanel.hidden,false,'catalogue search cannot hide pending audio controls');
assert.equal(retryButtons(pendingPanel).length,1);
client.retryPublication=async()=>{throw Error('Connection unavailable; retry again.');};
await retryButtons(pendingPanel)[0].handlers.click();
assert.equal(retryButtons(pendingPanel)[0].disabled,false,'a failed request re-enables retry');
assert.match(document.getElementById('admin-audio-pending-status').textContent,/Connection unavailable/);
// A completed request from the previous account must not repaint this account.
client.retryPublication=()=>new Promise(resolve=>{resolveRetry=resolve;});
const oldAccountRetry=retryButtons(pendingPanel)[0].handlers.click();
client.user={uid:'other-owner',email:'other@example.com'};await ui.load();
const newAccountStatus=nodes['admin-status'].textContent;
assert.equal(retryButtons(pendingPanel)[0].disabled,false,'an account change cannot inherit another account’s retry lock');
resolveRetry();await oldAccountRetry;
assert.equal(nodes['admin-status'].textContent,newAccountStatus,'stale retry completion cannot change status for another account');
assert.equal(document.getElementById('admin-audio-pending-status').textContent,'');
nodes['admin-search'].value='';nodes['admin-tabs'].children.find(button=>button.dataset.tab==='All').handlers.click();
await nodes['admin-signout'].handlers.click();assert.equal(nodes['admin-content'].hidden,true);assert.equal(nodes['admin-list'].children.length,0);assert.equal(nodes['admin-quick-link'].value,'');
// An in-flight admin response cannot repaint private content after account change.
client.user={uid:'owner',email:data.account};let resolveOld;client.getAdminDashboard=()=>new Promise(resolve=>{resolveOld=resolve;});const loading=ui.load();await settle();
client.user=null;await ui.load();resolveOld(data);await loading;assert.equal(nodes['admin-content'].hidden,true);assert.equal(nodes['admin-list'].children.length,0);
client.user={uid:'ordinary'};client.getAdminDashboard=async()=>{throw {code:'functions/permission-denied'};};await ui.load();assert.equal(nodes['admin-content'].hidden,true);assert.ok(nodes['admin-status'].textContent.includes('does not have admin access'));
console.log('PASS: dashboard rendering, video/audio copying, sharing, search, quick links, discoverable pending audio, replacement retry target, duplicate/error handling, sign-out cleanup, denied accounts and stale-response protection.');
