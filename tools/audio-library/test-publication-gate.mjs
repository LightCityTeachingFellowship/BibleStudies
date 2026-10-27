import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { audioReadyPublication } from './publication-gate.mjs';
import { preparePublication } from '../push/prepare-audio-publication.mjs';
import { reconcileReplacements, splitReplacementNotifications } from '../video-replacements.mjs';
const a='oldpublic01', b='newpublic01', c='oldmember01', d='newmember01', e='addition001';
const v=(id,visibility='public')=>({id,visibility,title:id,category:'Meeting'});
const ready=id=>({videoId:id,title:id,objectKey:`audio/${id}.m4a`,bytes:123,durationSeconds:456,sha256:'a'.repeat(64)});
const previous=[v(a),v(c,'members')];
let result=audioReadyPublication(previous,[v(b),v(c,'members')]);
assert.deepEqual(result.videos,previous,'pending replacement retains original');
assert.deepEqual(result.pending,[b]);assert.ok(!result.videos.some(v=>v.replaces?.includes(a)),'no early redirect');
result=audioReadyPublication(previous,[v(b),v(c,'members')],{recordings:[ready(b)]});
assert.equal(result.videos[0].id,b);assert.deepEqual(result.videos[0].replaces,[a]);
assert.equal(splitReplacementNotifications(result.videos.map(x=>({...x,kind:'video'}))).silent.length,1);
result=audioReadyPublication(previous,[v(e),...previous]);assert.deepEqual(result.videos,previous);
result=audioReadyPublication(previous,[v(e),...previous],{recordings:[ready(e)]});assert.equal(result.videos[0].id,e);
for(const bad of [{...ready(e),bytes:0},{...ready(e),objectKey:`audio/${a}.m4a`},{...ready(e),sha256:'invalid'}])assert.ok(!audioReadyPublication(previous,[v(e),...previous],{recordings:[bad]}).videos.some(x=>x.id===e));
assert.equal(audioReadyPublication(previous,[v(e),...previous],{live:[{videoId:e,active:true,expiresAt:2000}],now:1000}).videos[0].id,e);
for(const live of [{videoId:e,active:true,expiresAt:999},{videoId:e,active:false,replay:true,expiresAt:2000}])assert.ok(!audioReadyPublication(previous,[v(e),...previous],{live:[live],now:1000}).videos.some(x=>x.id===e));
assert.throws(()=>audioReadyPublication([],previous),/baseline/);
// Separate desired snapshots retain replacement intent across multiple waiting commits.
const intent1=reconcileReplacements(previous,[v(b),v(c,'members')]).videos;
const intent2=reconcileReplacements(intent1,[v(b),v(d,'members')]).videos;
result=audioReadyPublication(previous,intent2,{planned:true,recordings:[ready(d)]});
assert.deepEqual(result.videos.map(x=>x.id),[a,d]);assert.deepEqual(result.pending,[b]);
const both=audioReadyPublication(previous,intent2,{planned:true,recordings:[ready(b),ready(d)]});
assert.deepEqual(both.videos.map(x=>x.id),[b,d]);assert.deepEqual(both.videos[1].replaces,[c]);
// Actual build copies exclude pending IDs and private aliases; the private plan
// retains member replacement links for the protected snapshot and silent pushes.
const root=await mkdtemp(join(tmpdir(),'lc-publication-'));
try {
 await mkdir(join(root,'_includes'));await mkdir(join(root,'_data'));
 let output='';
 result=await preparePublication({root,previous:{videos:previous,revision:'old'},desired:[v(b),v(d,'members')],intent:{videos:intent2},declared:[],recordings:[ready(b),ready(d)],live:[],revision:'new',output:async text=>{output=text;}});
 assert.ok(output.includes('publish=true'));
 assert.equal((await readFile(join(root,'_includes/video-ids-public.txt'),'utf8')).trim(),b);
 assert.equal((await readFile(join(root,'_includes/video-ids-members.txt'),'utf8')).trim(),d);
 const aliases=JSON.parse(await readFile(join(root,'_data/video_replacements.json'),'utf8'));
 assert.deepEqual(aliases,[{from:a,to:b,visibility:'public'}]);
 const metadata=JSON.parse(await readFile(join(root,'_data/videos.json'),'utf8'));
 assert.ok(metadata.every(x=>!x.replaces&&!x.replacementVisibility));
 const plan=JSON.parse(await readFile(join(root,'tools/audio-library/work/publication.json'),'utf8'));
 assert.deepEqual(plan.videos[1].replaces,[c]);
 const synced=reconcileReplacements(previous,plan.videos,plan.videos.flatMap(x=>(x.replaces||[]).map(from=>({from,to:x.id,visibility:x.replacementVisibility[from]}))));
 assert.deepEqual(synced.videos,plan.videos,'multiple ready replacements sync without ambiguity');
 const unchanged=await preparePublication({root,previous:{videos:previous,revision:'same'},desired:[v(b),v(c,'members')],declared:[],recordings:[],live:[],revision:'same'});
 assert.equal(unchanged.publish,false,'scheduled waiting check does not rebuild unchanged site');
 const forced=await preparePublication({root,previous:{videos:previous,revision:'same'},desired:previous,declared:[],recordings:[],live:[],revision:'same',force:true});
 assert.equal(forced.publish,true,'manual publish can recover a failed notification step after snapshot sync');
} finally {await rm(root,{recursive:true,force:true});}
console.log('PASS: hidden additions, retained originals, silent ready replacements, live exceptions, invalid readiness, queued intent across commits, build privacy, protected sync and unchanged polling.');
