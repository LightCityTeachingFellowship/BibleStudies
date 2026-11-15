import assert from 'node:assert/strict';
const listeners = {};
const parentLocation = new URL('file:///preview?section=home');
globalThis.location = parentLocation;
const entries = [];
globalThis.history = {state:null, replaceState(state){this.state=state;}, pushState(state,unused,url){this.state=state;entries.push(url.href);}};
globalThis.window = {addEventListener(type,fn){listeners[type]=fn;}, location:parentLocation};
const frames=[];
let refreshCount=0;
const container={append(frame){frames.push(frame);}};
globalThis.document = {
 getElementById(id){return id==='lightcity-pages'?container:null;},
 createElement(){return {hidden:false, classList:{toggle(){}}, contentDocument:{scrollingElement:{scrollTop:0}}, contentWindow:{location:{reload(){refreshCount++}}}, addEventListener(type,fn){this[type]=fn;}, remove(){}};}
};
await import('../script/navigation-preview.mjs');
assert.equal(frames.length,1);
assert.match(frames[0].src,/\/Home\/$/);
listeners.popstate({state:{lightcityPage:new URL('../Videos/', import.meta.url).href}});
assert.equal(frames.length,2);
assert.equal(frames[0].hidden,true);
listeners.popstate({state:{lightcityPage:new URL('../Home/', import.meta.url).href}});
assert.equal(frames.length,2);
assert.equal(frames[0].hidden,false);
assert.equal(frames[1].hidden,true);
listeners.popstate({state:{lightcityPage:new URL('../Videos/', import.meta.url).href}});
assert.equal(frames.length,2,'revisiting a section retains its page');
assert.equal(globalThis.LightCityNavigationShell.refresh(),true, 'refresh reloads active page');
assert.equal(refreshCount,1);
assert.equal(frames.length,2, 'refresh keeps both pages mounted');
frames[1].contentDocument.scrollingElement.scrollTop=40;
assert.equal(globalThis.LightCityNavigationShell.refresh(),false, 'pull while scrolled does not refresh');
assert.equal(refreshCount,1);
assert.equal(globalThis.LightCityNavigationShell.back(),true);
assert.equal(frames[0].hidden,false,'Android back returns to Home');
assert.equal(frames[1].hidden,true);
assert.equal(globalThis.LightCityNavigationShell.back(),false,'root back can leave the app');
console.log('PASS: refresh retains pages; browser and Android Back select retained sections');
