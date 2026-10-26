import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {loadVideoLibrary,publicVideos} from '../video-library.mjs';
const require=createRequire(import.meta.url),{Liquid}=require('../visibility-qa/node_modules/liquidjs');
const engine=new Liquid({root:'_includes',dynamicPartials:false});
engine.registerFilter('jsonify',v=>JSON.stringify(v??null));engine.registerFilter('relative_url',v=>'/BibleStudies'+v);engine.registerFilter('normalize_whitespace',v=>String(v).replace(/\s+/g,' ').trim());
const videos=JSON.parse(await readFile('_data/videos.json','utf8')),site={data:{videos},pages:[],posts:[],members_enabled:true,video_visibility_enabled:true};
const render=async path=>engine.parseAndRender((await readFile(path,'utf8')).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,''),{site});
const listen=await render('Listen.html');assert.ok(listen.includes('LightCity Teaching Fellowship'),'brand preserved');
const metadata=JSON.parse(listen.match(/id="audio-public-videos">([\s\S]*?)<\/script>/)[1]);
assert.deepEqual(metadata.map(v=>v.id),publicVideos(await loadVideoLibrary()).map(v=>v.id),'audio and video use the same public inclusion and order');
assert.ok(listen.includes('id="audio-library-search"'));assert.ok(listen.includes('id="videotab-container"'));assert.ok(!listen.includes('audio-pilot.js'));
for(const name of ['Listen.html','videos.html','watch.html','MyVideos.html']){const html=name==='videos.html'?await engine.parseAndRender(await readFile('_includes/videosTEMPLATE.html','utf8'),{site,content:await render(name)}):await render(name);assert.ok(html.includes('href="/BibleStudies/Home/"'),name+' has Home');assert.ok(html.includes('href="/BibleStudies/Listen/"'),name+' has Audio');}
const home=await render('home.html'),explore=home.match(/<nav class="home-shortcuts"[\s\S]*?<\/nav>/)[0];assert.equal((explore.match(/<a /g)||[]).length,4);assert.ok(explore.includes('>Audio</span>'));assert.ok(home.includes('Explore resources'));assert.ok(!home.includes('Browse audio teachings'));
console.log('PASS: rendered audio metadata matches public video ordering without member leaks; search, Home/Audio navigation, four Explore shortcuts and unchanged branding.');
