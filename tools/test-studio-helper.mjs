import assert from 'node:assert/strict';
import {activeChannelLink,discoverBroadcast} from './live-audio/automatic/discovery.mjs';
const config={apiKey:'a'.repeat(39),channelId:'UC'+'a'.repeat(22)};let count=0;
const send=async url=>{count++;return url.pathname.endsWith('/search')?Response.json({items:[{id:{videoId:'abcdefghijk'}}]}):Response.json({items:[{id:'abcdefghijk',snippet:{channelId:config.channelId,title:'Prayer',liveBroadcastContent:'live'},liveStreamingDetails:{actualStartTime:new Date().toISOString()},status:{privacyStatus:'public'}}]});};
assert.equal(await activeChannelLink({...config,send}),'https://youtube.com/watch?v=abcdefghijk');assert.equal(count,2);
assert.equal(await activeChannelLink({...config,send:async()=>Response.json({items:[]})}),null,'unlisted/invisible streams are not guessed');
assert.equal(await activeChannelLink({...config,send:async()=>Response.json({items:[{},{}]})}),null,'multiple streams are not guessed');
assert.equal(await activeChannelLink({...config,send:async()=>new Response('',{status:403})}),null);
console.log('PASS: clipboard candidate requires one verified live broadcast on the configured channel; missing, ambiguous, or API-denied results do not choose a link.');
const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join,resolve}=await import('node:path');
const root=await mkdtemp(join(tmpdir(),'lc-studio-helper-'));
try{
 await mkdir(join(root,'tools/live-audio/work'),{recursive:true});await writeFile(join(root,'tools/live-audio/work/cloud-secrets.json'),JSON.stringify({LIVE_PLAYBACK_KEY:'a'.repeat(64)}));
 const {processingLibrary}=await import('./studio-library.mjs');
 const local=async()=>[{id:'abcdefghijk',title:'Local title',visibility:'public'}];
 await assert.rejects(processingLibrary(root,local,async()=>new Response('',{status:403})),/temporarily unavailable/);
 let calls=0;const send=async(url,options)=>{calls++;assert.ok(url.endsWith('/getStudioHelperLibrary'));assert.equal(options.method,'POST');assert.ok(options.headers.Authorization.startsWith('Bearer '));return Response.json({videos:[{id:'abcdefghijk',visibility:'members'},{id:'ABCDEFGHIJK',visibility:'public',studioSelected:true}]});};
 const result=await processingLibrary(root,local,send);assert.equal(result[0].visibility,'members','remote audience replaces stale local audience');assert.equal(result[0].title,'Local title');assert.equal(result[1].id,'ABCDEFGHIJK','new Studio IDs reach local helpers without a pull');assert.equal(result[1].studioSelected,true,'Studio selection reaches live discovery');
 await processingLibrary(root,local,send);assert.equal(calls,1,'polling is cached');
}finally{const {sep}=await import('node:path');if(!resolve(root).startsWith(resolve(tmpdir())+sep))throw Error('Unexpected temporary path');await rm(root,{recursive:true,force:true});}
console.log('PASS: protected helper fetch, fail-closed errors, remote audience authority, remote new-ID discovery and bounded caching.');
const liveLookup=async ids=>ids.map(id=>({id,title:'Live event',live:true}));
const both=[{id:'abcdefghijk',visibility:'public'},{id:'ABCDEFGHIJK',visibility:'members',studioSelected:true}];
assert.equal((await discoverBroadcast(both,liveLookup)).video.id,'ABCDEFGHIJK','an explicit Studio selection resolves simultaneous live videos');
assert.equal((await discoverBroadcast(both.map(v=>({...v,studioSelected:false})),liveLookup)).video,null,'without a Studio selection ambiguity still fails closed');
assert.equal((await discoverBroadcast(both,async()=>[])).video,null,'an unavailable selection cannot fall back to a different broadcast');
console.log('PASS: explicit Studio selection resolves simultaneous broadcasts without guessing or changing audience.');