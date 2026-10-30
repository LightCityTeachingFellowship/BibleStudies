import assert from 'node:assert/strict';
import {setupDesktopStudio} from '../script/studio-desktop.mjs';
class Element {
 constructor(){this.children=[];this.textContent='';}
 append(...nodes){this.children.push(...nodes);}prepend(node){this.children.unshift(node);}
 setAttribute(){}remove(){this.removed=true;}
}
const top=new Element(),main=new Element(),status=new Element(),install=new Element();
const document={getElementById:id=>({'admin-status':status,'admin-install':install}[id]),querySelector:s=>s==='.studio-top'?top:s==='.studio-main'?main:null,createElement:()=>new Element()};
let calls=[],signed=0;const api={ready:Promise.resolve(),user:null,signInForVideos:async()=>{signed++;api.user={uid:'admin'};},connectStudioDesktop:async data=>calls.push(data)};
let cleaned;const window={location:{href:'https://lightcityfellowship.com/Admin/?desktopSession='+ 'a'.repeat(32)+'&desktopChallenge='+'b'.repeat(64)},history:{replaceState:(_a,_b,url)=>cleaned=url}};
setupDesktopStudio({document,window,api:()=>api});
assert.equal(calls.length,0,'opening a link never approves a desktop login automatically');assert.ok(!cleaned.includes('desktopSession'));
const panel=main.children[0];assert.ok(panel.children[1].textContent.includes('AAAA-AAAA'));
const approve=panel.children.find(n=>n.textContent==='Approve Windows connection');await approve.onclick();
assert.equal(signed,1);assert.equal(calls.length,1);assert.equal(calls[0].action,'approve');assert.equal(approve.textContent,'Approved');
let handle,acknowledged=[],events=[];window.LightCityDesktop={showAlerts(){},openSettings(){},onConnectionCode(fn){fn({code:'ABCD-EFGH'});},onHandle:fn=>handle=fn,acknowledgeResult:async value=>acknowledged.push(value)};window.dispatchEvent=event=>events.push(event.type);api.resolveStreamReport=async id=>calls.push({resolved:id});
setupDesktopStudio({document,window,api:()=>api});assert.equal(install.removed,true);assert.ok(status.textContent.includes('ABCD-EFGH'));assert.equal(top.children.length,2);
await handle({uid:'other',id:'report'});assert.equal(acknowledged.length,0);
await handle({uid:'admin',id:'report'});assert.equal(acknowledged[0].ok,true);assert.ok(events.includes('lightcity-stream-reports-changed'));
api.resolveStreamReport=async()=>{throw Error('Offline');};await handle({uid:'admin',id:'report'});assert.equal(acknowledged.at(-1).ok,false);
console.log('PASS: explicit browser approval, visible matching code, URL cleanup, native account isolation and server-confirmed report handling.');
