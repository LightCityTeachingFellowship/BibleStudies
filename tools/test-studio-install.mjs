import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),{Liquid}=require('./visibility-qa/node_modules/liquidjs');
const root=new URL('..',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');
const clean=s=>s.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'');
const header=await read('_includes/pwa-head.html'),source=await read('script/studio-install.js');
for(const prefix of ['', '/BibleStudies']){
 const engine=new Liquid({root:new URL('_includes/',root).pathname.replace(/^\/([A-Z]:)/,'$1'),dynamicPartials:false});
 engine.registerFilter('relative_url',value=>prefix+value);engine.registerFilter('jsonify',value=>JSON.stringify(value??null));engine.registerFilter('normalize_whitespace',value=>String(value).replace(/\s+/g,' ').trim());
 const site={members_enabled:true,video_visibility_enabled:true,data:{videos:[],video_replacements:[]}};
 const studio=JSON.parse(await engine.parseAndRender(clean(await read('studio.webmanifest'))));
 const main=JSON.parse(await engine.parseAndRender(clean(await read('manifest.webmanifest'))));
 assert.equal(studio.id,prefix+'/Admin/');assert.equal(studio.start_url,prefix+'/Admin/');assert.equal(studio.scope,prefix+'/Admin/');assert.notEqual(studio.id,main.id);assert.equal(studio.name,'LightCity Studio');
 for(const enabled of [true,false]){
  const html=await engine.parseAndRender(header,{site,page:{studio_app:enabled}});
  assert.equal((html.match(/rel="manifest"/g)||[]).length,1,'exactly one app manifest per page');
  assert.equal(html.includes('/studio.webmanifest'),enabled);assert.equal(html.includes('/script/studio-install.js'),enabled);assert.equal(html.includes('/script/pwa.js'),!enabled);assert.ok(html.includes('/script/members.js'),'admin authentication remains loaded');
 }
}
let installed=0,prevented=0;
const handlers={},button={hidden:true,addEventListener:(e,fn)=>handlers['button-'+e]=fn};
const window={addEventListener:(e,fn)=>handlers[e]=fn};
vm.runInNewContext(source,{document:{currentScript:{dataset:{base:'/'}},getElementById:()=>button},window,location:{href:'https://lightcityfellowship.com/Admin/'},URL,matchMedia:()=>({matches:false}),navigator:{serviceWorker:{register:()=>Promise.resolve()}}});
handlers.beforeinstallprompt({preventDefault(){prevented++;},prompt:async()=>{installed++;},userChoice:Promise.resolve({outcome:'accepted'})});assert.equal(prevented,1);assert.equal(button.hidden,false);
await handlers['button-click']();assert.equal(installed,1);assert.equal(button.hidden,true);await handlers['button-click']();assert.equal(installed,1,'install prompt is consumed once');handlers.appinstalled();assert.equal(button.hidden,true);
console.log('PASS: separate Studio identity, direct Admin launch, scoped manifest, one correct manifest/runtime per page, retained auth and install prompt lifecycle.');
