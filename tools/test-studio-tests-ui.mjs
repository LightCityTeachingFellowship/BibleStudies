import assert from 'node:assert/strict';
import {setupStudioTests} from '../script/studio-tests.mjs';
class Element{constructor(){this.handlers={};this.children=[];this.hidden=false;}addEventListener(k,fn){this.handlers[k]=fn;}replaceChildren(){this.children=[];}appendChild(n){this.children.push(n);}}
const ids=['preview','frame','title','register','unregister'],nodes=Object.fromEntries(ids.map(id=>['admin-test-'+id,new Element()]));
const document={getElementById:id=>nodes[id],createElement:()=>new Element()},events={},window={location:{href:'https://lightcityfellowship.com/Admin/?test=abcdefghijk'},addEventListener:(k,fn)=>events[k]=fn};
let message='',calls=[],release,wait=false;
const client={user:{uid:'admin'},ready:Promise.resolve(),getStudioPublication:async data=>{calls.push(data);return wait?new Promise(resolve=>release=resolve):{title:'Private test'};},manageStudioTest:async action=>calls.push(action)};
setupStudioTests({document,window,api:()=>client,status:text=>message=text});
const settle=()=>new Promise(r=>setTimeout(r,5));await settle();
assert.equal(nodes['admin-test-preview'].hidden,false);assert.equal(nodes['admin-test-frame'].children[0].src,'https://www.youtube-nocookie.com/embed/abcdefghijk?playsinline=1&rel=0');
assert.equal(calls[0].visibility,'test');
await nodes['admin-test-register'].handlers.click({currentTarget:nodes['admin-test-register']});assert.ok(calls.includes('register'));assert.match(message,/registered/);
await nodes['admin-test-unregister'].handlers.click({currentTarget:nodes['admin-test-unregister']});assert.ok(calls.includes('unregister'));
wait=true;events['lightcity-members-changed']();client.user=null;events['lightcity-members-changed']();release({title:'Private'});await settle();assert.equal(nodes['admin-test-preview'].hidden,true);assert.equal(nodes['admin-test-frame'].children.length,0,'sign-out clears private player and blocks late response');
console.log('PASS: private Studio preview, register/remove actions and account-change cleanup.');
