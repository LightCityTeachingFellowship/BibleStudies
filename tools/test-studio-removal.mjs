import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {syncLocalVideoLists} from './studio-local-sync.mjs';
import {removeStudioVideo,listVersion,syncStudioBackup} from './members/functions/studio-removal.mjs';
import {mergeStudioVideos} from './members/functions/direct-library.mjs';
const a='abcdefghijk',b='ABCDEFGHIJK',c='12345678901',d='local000001';
const work=await mkdtemp(join('tools/audio-library/work/','sync-test-'));
try{
 await mkdir(join(work,'_includes'));const publicFile=join(work,'_includes/video-ids-public.txt'),membersFile=join(work,'_includes/video-ids-members.txt');
 await writeFile(publicFile,a+'\n'+d+'\n');await writeFile(membersFile,c+'\n');
 let remote={videos:[{id:b,visibility:'public'},{id:a,visibility:'public'},{id:c,visibility:'members'}],versions:{[a]:'1',[b]:'1',[c]:'legacy'},removed:[]},calls=[];
 const remove=async(id,version)=>{calls.push({id,version});remote={...remote,videos:remote.videos.filter(v=>v.id!==id),removed:[...remote.removed,id]};return remote;};
 await syncLocalVideoLists(work,remote,{remove});assert.ok((await readFile(publicFile,'utf8')).includes(b),'Studio addition mirrored');assert.ok((await readFile(publicFile,'utf8')).includes(d),'unpublished local addition kept');assert.equal(calls.length,0,'first sync never infers removal');
 await syncLocalVideoLists(work,remote,{remove});assert.ok((await readFile(publicFile,'utf8')).includes(d),'local-only addition persists across passes');
 await writeFile(publicFile,d+'\n'+a+'\n');await syncLocalVideoLists(work,remote,{remove});assert.deepEqual(calls,[{id:b,version:'1'}],'saved deletion reaches server with lifecycle version');
 await writeFile(publicFile,d+'\n');remote.versions[a]='2';await syncLocalVideoLists(work,remote,{remove});assert.equal(calls.length,1,'stale deletion cannot remove republished ID');assert.ok((await readFile(publicFile,'utf8')).includes(a));
 remote={...remote,videos:remote.videos.filter(v=>v.id!==a),removed:[...remote.removed,a]};await syncLocalVideoLists(work,remote,{remove});assert.equal(await readFile(publicFile,'utf8'),d+'\n','Studio removal mirrored; local-only addition retained');
 await writeFile(publicFile,'invalid ID!\n');await assert.rejects(syncLocalVideoLists(work,remote,{remove}),/invalid/);assert.equal(calls.length,1);
}finally{await rm(work,{recursive:true,force:true});}
class Fail extends Error{constructor(code,message){super(message);this.code=code;}}
const rows=new Map([['churchVideoLibrary/current',{videos:[{id:a,visibility:'members',replaces:[b]}]}],['churchVideoLibrary/desired',{videos:[{id:a,visibility:'members'}]}],['churchVideoLibrary/studio',{entries:[{video:{id:a,visibility:'members'},state:'ready',operationId:'live-generation'}]}]]);
const db={doc:path=>({get:async()=>({exists:rows.has(path),data:()=>structuredClone(rows.get(path))}),set:async(v,o)=>rows.set(path,o?.merge?{...rows.get(path),...v}:v)}),runTransaction:cb=>cb({get:r=>r.get(),set:(r,v,o)=>r.set(v,o)})};
await assert.rejects(removeStudioVideo({db,fail:Fail,videoId:a,expectedVersion:'stale',actor:'helper'}),e=>e.code==='aborted');
assert.equal(rows.get('churchVideoLibrary/current').videos.length,1);
await removeStudioVideo({db,fail:Fail,videoId:a,expectedVersion:'live-generation',actor:'helper'});
assert.equal(rows.get('churchVideoLibrary/current').videos.length,0);assert.equal(rows.get('churchVideoLibrary/desired').videos.length,0);assert.equal(rows.get('churchVideoLibrary/studio').entries.length,0);assert.equal(rows.get('churchStudioPublications/'+a).state,'removed');
assert.deepEqual(mergeStudioVideos([{id:a,visibility:'members'},{id:b,visibility:'members'}],rows.get('churchVideoLibrary/studio')),[],'stale builds cannot restore removed ID or old aliases');
let removed;await syncStudioBackup({db,id:a,github:{remove:async ids=>removed=ids}});assert.deepEqual(removed,[a,b]);assert.equal(rows.get('churchStudioPublications/'+a).backedUp,true);
await removeStudioVideo({db,fail:Fail,videoId:a,actor:'admin'});assert.equal(listVersion(rows.get('churchVideoLibrary/studio'),a),'legacy');
console.log('PASS: two-way ID sync, first-run safety, local-only additions, lifecycle conflicts, saved removals, invalid-file protection, durable tombstones, alias removal, GitHub cleanup and idempotency.');rows.set('churchStudioPublications/'+a,{direct:true,state:'ready',visibility:'members',operationId:'old',backedUp:false});let repaired=false;
await syncStudioBackup({db,id:a,github:{add:async()=>rows.set('churchStudioPublications/'+a,{direct:true,state:'removed',removedIds:[a],operationId:'new',backedUp:true}),remove:async()=>{repaired=true;}}});
assert.equal(repaired,true,'a late stale add is compensated even after removal backup was marked done');
console.log('PASS: concurrent add/remove backup compensation preserves the newest Studio decision.');