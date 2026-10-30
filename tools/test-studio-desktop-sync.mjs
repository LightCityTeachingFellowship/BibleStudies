import assert from 'node:assert/strict';
import {setupAdminStreamIssues} from '../script/admin-stream-issues.mjs';
class Element{constructor(){this.children=[];this.events={};this.textContent='';}appendChild(n){this.children.push(n);}replaceChildren(...n){this.children=n;}addEventListener(k,fn){this.events[k]=fn;}}
const nodes=new Map(['admin-stream-reports','admin-stream-report-status','admin-stream-report-refresh'].map(id=>[id,new Element()]));
const events={},synced=[];let calls=0,offline=false,reports=[{id:'a'.repeat(64),videoId:'abcdefghijk',title:'Prayer meeting',issue:'volume',count:1,createdAt:1,resolved:false}];
const document={visibilityState:'hidden',getElementById:id=>nodes.get(id),createElement:()=>new Element(),addEventListener(){}};
const window={LightCityDesktop:{syncReports:async value=>synced.push(value)},addEventListener:(key,fn)=>events[key]=fn,dispatchEvent:event=>events[event.type]?.(event)};
const api={user:{uid:'admin'},ready:Promise.resolve(),getStreamReports:async()=>{calls++;if(offline)throw Error('Offline');return {reports};},resolveStreamReport:async()=>{reports=[];}};
let poll;const original=globalThis.setInterval;globalThis.setInterval=(fn,delay)=>{assert.equal(delay,10000);poll=fn;return {unref(){}};};
const ui=setupAdminStreamIssues({document,window,api:()=>api});globalThis.setInterval=original;
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};await settle();
assert.equal(nodes.get('admin-stream-reports').children.length,1);assert.equal(synced.at(-1).reports.length,1);
const prior=calls;poll();await settle();assert.ok(calls>prior,'Windows keeps checking while its window is hidden');
offline=true;await ui.load();assert.equal(nodes.get('admin-stream-reports').children.length,1,'Network failures keep the unresolved report');assert.equal(synced.at(-1).reports.length,1);
offline=false;reports=[];await ui.load();assert.equal(nodes.get('admin-stream-reports').children.length,0);assert.equal(synced.at(-1).reports.length,0,'Phone handling clears the corresponding Windows report');
api.user=null;await ui.load();assert.equal(synced.at(-1).uid,null,'Signing out clears native private alerts');
console.log('PASS: hidden Windows polling, shared acknowledgement, network-failure retention and sign-out isolation.');
