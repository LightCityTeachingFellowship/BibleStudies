import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('desktop connection is exposed during an opaque preload, only in the main frame',async()=>{
 const source=readFileSync(new URL('./preload.cjs',import.meta.url),'utf8');
 const run=mainFrame=>{
  const exposed={},calls=[];
  const electron={contextBridge:{exposeInMainWorld:(name,value)=>exposed[name]=value},ipcRenderer:{invoke:async(...args)=>{calls.push(args);return 'one-use-test-token';},on(){},removeListener(){}}};
  vm.runInNewContext(source,{require:name=>{assert.equal(name,'electron');return electron;},process:{isMainFrame:mainFrame},location:{origin:'null',pathname:'/'}});
  return {exposed,calls};
 };
 const {exposed,calls}=run(true);assert.ok(exposed.LightCityDesktop);assert.equal(exposed.LightCityDesktop.version,'0.1.1');
 assert.equal(await exposed.LightCityDesktop.connect(),'one-use-test-token');assert.equal(calls[0][0],'studio:connect');
 assert.equal(run(false).exposed.LightCityDesktop,undefined,'child frames never receive desktop actions');
});
test('Windows sign-in cannot fall back to the browser OAuth popup if its native connection is absent',async()=>{
 const source=readFileSync(new URL('../../script/members.js',import.meta.url),'utf8');
 const start=source.indexOf('api.signInForVideos = async () => {'),end=source.indexOf('\napi.getVideoActivity',start);
 assert.ok(start>=0&&end>start);const code=source.slice(start,end);
 async function run({desktop=false,bridge=false}={}){
  const calls=[];const api={ready:Promise.resolve()},memberAuth={};
  const sdk={auth:{signInWithCustomToken:async(_auth,token)=>calls.push(['custom',token]),signInWithPopup:async()=>calls.push(['popup']),GoogleAuthProvider:class {setCustomParameters(){}}}};
  const context=vm.createContext({api,memberAuth,sdk,checkAccess:async()=>calls.push(['access']),URLSearchParams,location:{search:desktop?'?desktop=windows':''},navigator:{userAgent:desktop?'Electron/45.2.0':'Chrome'}});
  if(bridge)context.LightCityDesktop={connect:async()=>{calls.push(['connect']);return 'one-use-test-token';}};
  vm.runInContext(code,context);return {api,calls};
 }
 const missing=await run({desktop:true});await assert.rejects(missing.api.signInForVideos(),/Windows connection did not load/);assert.equal(missing.calls.length,0);
 const native=await run({desktop:true,bridge:true});await native.api.signInForVideos();assert.equal(native.calls.map(v=>v[0]).join(','),'connect,custom,access');
 const browser=await run();await browser.api.signInForVideos();assert.equal(browser.calls.map(v=>v[0]).join(','),'popup,access');
});
