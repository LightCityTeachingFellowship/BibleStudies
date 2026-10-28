import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{Liquid}=require('./visibility-qa/node_modules/liquidjs');
const engine=new Liquid();engine.registerFilter('relative_url',v=>'/BibleStudies'+v);
const read=p=>readFile(p,'utf8');
const search=await read('_includes/site-search.html'),dialog=await read('_includes/site-search-dialog.html');
for(const [scope,label]of [[undefined,'all resources'],['All','all resources'],['Article','articles'],['Summary','summaries'],['Video','videos']]){
 const html=await engine.parseAndRender(search.replace(/{% include site-search-dialog.html scope=search_scope %}/,''),{include:{scope}});
 assert.ok(html.includes('placeholder="Search '+label+'…"'));
 const popup=await engine.parseAndRender(dialog,{include:{scope:scope||'All'}});
 assert.ok(popup.includes('data-scope="'+(scope||'All')+'"'));
 assert.equal(popup.includes('class="home-search-filters"'),!scope||scope==='All');
}
for(const path of ['_includes/homeTEMPLATE.html','_includes/homeTEMPLATE2.html'])assert.match(await read(path),/page\.search_scope \| default: 'All'/);
for(const path of ['index.html','moreRecentPosts.html'])assert.match(await read(path),/^search_scope: Article$/m);
for(const path of ['about.html','Meeting-Days.html','A List Of Our Doctrines.html','MAIN LightCity-Resources-section.html'])assert.doesNotMatch(await read(path),/^search_scope: Article$/m);
assert.match(await read('MyVideos.html'),/site-search\.html scope='All'/);
for(const [path,scope]of [['_includes/cat-homepageTEMPLATE.html','Article'],['_includes/cat-homepageTEMPLATE-summary.html','Summary'],['_includes/homeTEMPLATE-summary.html','Summary'],['_includes/videosTEMPLATE.html','Video']])assert.match(await read(path),new RegExp("site-search\\.html scope='"+scope+"'"));
console.log('PASS: global search labels/filters, Study Library/general page scope, article listings, and unchanged article/summary category scopes.');
