import assert from 'node:assert/strict';
import {setupStudioPublisher} from '../script/studio-publish.mjs';
class Element{constructor(){this.handlers={};this.hidden=true;this.value='';this.disabled=false;this.textContent='';this.open=false;}addEventListener(k,fn){this.handlers[k]=fn;}focus(){this.focused=true;}select(){this.selected=true;}showModal(){this.open=true;}close(){this.open=false;}}
const ids=['quick-form','audience','quick','publish','quick-result','quick-link','quick-copy','ready-dialog','ready-title','ready-url','ready-copy','ready-close'];
const nodes=Object.fromEntries(ids.map(id=>['admin-'+id,new Element()]));
const doc={getElementById:id=>nodes[id],addEventListener(){}};const store=new Map(),events={};
const window={localStorage:{setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k),removeItem:k=>store.delete(k)},addEventListener:(k,fn)=>events[k]=fn};
let calls=[],checks=0,message='',copied='',release;
const api={user:{uid:'owner'},ready:Promise.resolve(),publishStudioVideo:async data=>{calls.push(data);},getStudioPublication:async()=>{checks++;return new Promise(resolve=>release=resolve);}};
assert.equal(setupStudioPublisher({document:doc,window,navigator:{clipboard:{writeText:async value=>copied=value}},api:()=>api,status:value=>message=value}),true);
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setTimeout(resolve,1));};await settle();
nodes['admin-quick'].value='https://youtu.be/abcdefghijk';nodes['admin-audience'].value='members';
await nodes['admin-quick-form'].handlers.submit({preventDefault(){}});await settle();
assert.equal(calls.length,1);assert.deepEqual(calls[0],{videoId:'abcdefghijk',visibility:'members',direct:true});
assert.equal(nodes['admin-quick-result'].hidden,true,'no premature link is displayed');
assert.equal(nodes['admin-publish'].disabled,true);assert.equal(checks,1);
release({state:'ready',title:'Prayer meeting',url:'https://lightcityfellowship.com/Share/Video/abcdefghijk/'});await settle();
assert.equal(nodes['admin-ready-dialog'].open,true);assert.equal(nodes['admin-quick-result'].hidden,false);assert.equal(nodes['admin-publish'].disabled,false);assert.equal(store.size,0);
await nodes['admin-ready-copy'].handlers.click();await settle();assert.ok(copied.endsWith('/abcdefghijk/'));
nodes['admin-ready-close'].handlers.click();assert.equal(nodes['admin-ready-dialog'].open,false);
// An old account's in-flight status cannot display or copy a private link after sign-out.
await nodes['admin-quick-form'].handlers.submit({preventDefault(){}});await settle();api.user=null;events['lightcity-members-changed']();
release({state:'ready',title:'Private',url:'https://lightcityfellowship.com/Share/Video/abcdefghijk/'});await settle();assert.equal(nodes['admin-ready-dialog'].open,false);
console.log('PASS: Studio publish form, audience submission, duplicate-click protection, waiting state, ready dialog, copy action and stale-account protection.');