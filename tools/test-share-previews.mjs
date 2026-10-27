import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {videoPreview,writeVideoSharePages} from './share-previews.mjs';
import {videoShareLink} from '../script/share-links.mjs';
const require=createRequire(import.meta.url),{Liquid}=require('./visibility-qa/node_modules/liquidjs');
const id='abcdefghijk',old='ABCDEFGHIJK',title='Prayer & worship <script>bad()</script> "Today"';
const page=videoPreview({id,title});
assert.ok(page.includes('Watch this video on LightCity Teaching Fellowship.'));
assert.ok(!page.includes('Watch this recording'));
assert.ok(page.includes('property="og:image:width" content="320"'));
assert.ok(page.includes('property="og:image:height" content="180"'));
assert.ok(videoPreview({id,title},{audio:true}).includes('Listen to this recording on LightCity Teaching Fellowship.'));
assert.ok(page.includes('property="og:title" content="Prayer &amp; worship &lt;script&gt;bad()&lt;/script&gt; &quot;Today&quot;"'));
assert.ok(page.includes(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`));assert.ok(page.includes('location.replace("/Watch/?v='+id+'")'));
assert.ok(videoPreview({id,title},{audio:true}).includes('location.replace("/Listen/?v='+id+'")'));
assert.equal(videoShareLink(id),'https://lightcityfellowship.com/Share/Video/'+id+'/');
assert.equal(videoShareLink(id,{base:'https://example.com/BibleStudies/Watch/?t=20',audio:true}),'https://example.com/BibleStudies/Share/Audio/'+id+'/');
assert.equal(videoShareLink('bad'),null);
const root=await mkdtemp(join(tmpdir(),'lc-share-'));
try{
 assert.equal(await writeVideoSharePages(root,[{id,title,replaces:[old]}]),4);
 const oldPage=await readFile(join(root,'share-previews','lc-video-'+old+'.html'),'utf8');assert.ok(oldPage.includes(`/Share/Video/${old}/`));assert.ok(oldPage.includes('/Watch/?v='+id),'old shared previews open replacement');
 await writeVideoSharePages(root,[]);assert.equal((await readdir(join(root,'share-previews'))).length,0,'removed content does not leave stale preview files');
}finally{await rm(root,{recursive:true,force:true});}
const social=await readFile(new URL('../_includes/social-preview.html',import.meta.url),'utf8');
for(const layout of ['articleTEMPLATE','summaryTEMPLATE','summaryTEMPLATE2','summaryTEMPLATE3']){
 const engine=new Liquid();engine.registerFilter('relative_url',v=>v);
 const html=await engine.parseAndRender(social,{site:{url:'https://lightcityfellowship.com'},page:{layout,title:'Reading & study',url:'/reading/'}});
 assert.ok(html.includes('content="Reading &amp; study"'));assert.ok(html.includes(layout==='articleTEMPLATE'?'/images/share/article.png':'/images/share/summary.png'));assert.ok(html.includes('content="https://lightcityfellowship.com/reading/"'));
}
for(const kind of ['article','summary']){
 const png=await readFile(new URL('../images/share/'+kind+'.png',import.meta.url));assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
}
console.log('PASS: crawler-readable video/audio previews, escaped titles, thumbnails, replacement links, generated-file pruning, reading layouts and 1200x630 share cards.');
