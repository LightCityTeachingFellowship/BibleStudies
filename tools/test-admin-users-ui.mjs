import assert from 'node:assert/strict';
import {setupAdminUsers} from '../script/admin-users.mjs';
class Element{constructor(){this.children=[];this.handlers={};this.value='';this.open=true;this.textContent='';this.hidden=false;}appendChild(n){this.children.push(n);return n;}replaceChildren(...n){this.children=n;}addEventListener(k,v){this.handlers[k]=v;}}
const names=['panel','list','status','search','filter','refresh','more'],nodes=Object.fromEntries(names.map(n=>['admin-users-'+n,new Element()]));
const document={getElementById:id=>nodes[id],createElement:()=>new Element()},allText=n=>[n.textContent,...n.children.map(allText)].join(' ');
const row=(uid,name,lastSignInAt,membership='none')=>({uid,name,email:uid+'@example.com',emailVerified:true,membership,lastSignInAt,createdAt:1});
let pages=[],calls=[];const client={user:{uid:'admin'},getAdminUsers:async options=>{calls.push(options);return pages.shift();}};
const ui=setupAdminUsers({document,api:()=>client});
pages=[{users:[row('a','<img onerror=alert(1)>',1,'active')],nextPageToken:'two'},{users:[row('b','Bob',2)],nextPageToken:null}];await ui.load();assert.equal(calls.length,2);assert.deepEqual(calls[1],{pageToken:'two'});assert.ok(nodes['admin-users-status'].textContent.includes('2 signed-in accounts'));assert.ok(allText(nodes['admin-users-list'].children[0]).includes('Bob'),'newest sign-in is first');assert.ok(allText(nodes['admin-users-list']).includes('<img onerror=alert(1)>'),'names are plain text');
nodes['admin-users-search'].value='a@example.com';nodes['admin-users-search'].handlers.input();assert.equal(nodes['admin-users-list'].children.length,1);assert.ok(allText(nodes['admin-users-list']).includes('Church member'));
nodes['admin-users-search'].value='';nodes['admin-users-filter'].value='others';nodes['admin-users-filter'].handlers.change();assert.ok(allText(nodes['admin-users-list']).includes('Bob'));assert.ok(!allText(nodes['admin-users-list']).includes('a@example.com'));
nodes['admin-users-filter'].value='all';pages=[{users:Array.from({length:120},(_,i)=>row(String(i),'Person '+i,i)),nextPageToken:null}];await ui.load();assert.equal(nodes['admin-users-list'].children.length,50);nodes['admin-users-more'].handlers.click();assert.equal(nodes['admin-users-list'].children.length,100);
ui.clear();assert.equal(nodes['admin-users-list'].children.length,0);assert.equal(nodes['admin-users-search'].value,'');
let resolveOld;client.getAdminUsers=()=>new Promise(resolve=>{resolveOld=resolve;});const pending=ui.load();client.user=null;ui.clear();resolveOld({users:[row('private','Private name',1)],nextPageToken:null});await pending;assert.equal(nodes['admin-users-list'].children.length,0,'old responses cannot restore private details after sign-out');
client.user={uid:'admin'};nodes['admin-users-panel'].open=false;let closedCalls=0;client.getAdminUsers=async()=>{closedCalls++;};await ui.load();assert.equal(closedCalls,0,'closed section does not fetch the directory');
console.log('PASS: automatic full pagination, search across pages, member filters, latest sign-in ordering, text-only names, display limits, lazy loading and stale-account cleanup.');
