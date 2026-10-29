import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),{Liquid}=require('./visibility-qa/node_modules/liquidjs');
const page=await readFile('MyVideos.html','utf8'),redirect=await readFile('my-videos-redirect.html','utf8');
assert.match(page,/^permalink: \/MyLibrary\/$/m);
assert.doesNotMatch(page,/data-hub-sync|data-hub-import/);
for(const base of ['','/BibleStudies']){
 const engine=new Liquid();engine.registerFilter('jsonify',JSON.stringify);engine.registerFilter('relative_url',v=>base+v);engine.registerFilter('absolute_url',v=>'https://lightcityfellowship.com'+base+v);
 const html=await engine.parseAndRender(redirect,{}),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 let result;vm.runInNewContext(script,{location:{search:'?view=history',hash:'#saved',replace:v=>{result=v;}}});
 assert.equal(result,base+'/MyLibrary/?view=history#saved');
 assert.ok(html.includes('href="'+base+'/MyLibrary/"'),'fallback link uses the new route');
}
console.log('PASS: canonical library route, removed overview strip, and old links redirect with query/hash and project base paths preserved.');
