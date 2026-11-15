import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('script/navigation-launcher.js','utf8');
function setup(current='https://lightcityfellowship.com/Home/',embedded=false){
 const calls=[],handlers={};const loc=new URL(current);loc.assign=v=>calls.push(v);
 const win={location:loc,addEventListener(n,f){handlers[n]=f}};win.top=embedded?{}:win;
 const doc={currentScript:{dataset:{base:'/'}}};
 vm.runInNewContext(source,{window:win,document:doc,location:loc,URL});
 return {calls,handlers};
}
function click(state,url,options={}){const anchor={href:url,target:options.target||'',hasAttribute:n=>n==='download'&&!!options.download};const e={button:0,target:{closest:()=>anchor},preventDefault(){this.prevented=true},...options};state.handlers.click?.(e);return e;}
let state=setup();let e=click(state,'https://lightcityfellowship.com/Videos/');assert.equal(e.prevented,true);assert.equal(new URL(state.calls[0]).pathname,'/app/');assert.equal(new URL(state.calls[0]).searchParams.get('page'),'/Videos/');
for(const target of ['https://lightcityfellowship.com/Admin/','https://lightcityfellowship.com/members/','https://lightcityfellowship.com/Home/#section','https://other.example/Videos/','https://lightcityfellowship.com/file.pdf']){state=setup();click(state,target);assert.equal(state.calls.length,0,target)}
state=setup();click(state,'https://lightcityfellowship.com/Videos/',{ctrlKey:true});assert.equal(state.calls.length,0);
state=setup('https://lightcityfellowship.com/Watch/?v=abcdefghijk');assert.equal(state.handlers.click,undefined);
state=setup(undefined,true);assert.equal(state.handlers.click,undefined);
console.log('PASS: normal links enter shell; direct, private, media, external and modified clicks retain browser behavior');
