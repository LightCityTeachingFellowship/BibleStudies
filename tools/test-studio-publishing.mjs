import assert from 'node:assert/strict';
import {planAddition,parseIds,githubPublisher,createStudioPublishing,validHelperBearer,markStudioSelection} from './members/functions/studio-publishing.mjs';
import {watchAccess} from '../script/watch-access.mjs';
const a='abcdefghijk',b='ABCDEFGHIJK',c='12345678901';
assert.deepEqual(parseIds(a+'\r\n'+b+'\n'),[a,b]);assert.throws(()=>parseIds(a+'\n'+a));
assert.equal(planAddition({public:[a],members:[b]},a,'public'),null);
assert.throws(()=>planAddition({public:[a],members:[b]},b,'public'));
assert.deepEqual(planAddition({public:[a],members:[b]},c,'members'),{path:'_includes/video-ids-members.txt',content:c+'\n'+b+'\n'});
let patches=0,created=[],readRefs=[];
const github=githubPublisher({token:()=> 'private-test-token',send:async(url,options)=>{
 const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):null;
 if(path.endsWith('/git/ref/heads/master'))return Response.json({object:{sha:'base'+patches}});
 if(path.includes('/git/commits/')&&options.method==='GET')return Response.json({tree:{sha:'tree'}});
 if(path.includes('/contents/')){readRefs.push(new URL(url).searchParams.get('ref'));return Response.json({content:Buffer.from(path.includes('public')?a+'\n':b+'\n').toString('base64')});}
 if(path.endsWith('/git/trees')){created.push(body);return Response.json({sha:'new-tree'});}
 if(path.endsWith('/git/commits'))return Response.json({sha:'new-commit'});
 if(path.endsWith('/git/refs/heads/master')){assert.equal(body.force,false);patches++;return patches===1?new Response('',{status:422}):Response.json({});}
 throw Error('Unexpected endpoint');
}});
assert.equal((await github.add(c,'members')).sha,'new-commit');assert.equal(patches,2,'concurrent commit retries from latest head');
assert.deepEqual(readRefs,['base0','base0','base1','base1']);assert.ok(created.every(t=>t.tree.length===1&&t.tree[0].path==='_includes/video-ids-members.txt'));
class Fail extends Error{constructor(code,message){super(message);this.code=code;}}
let ordinary=false,commits=0,exists=false,pageStatus=404;
const deps={fail:Fail,emails:()=> 'owner@example.com',auth:{getUser:async()=>({email:ordinary?'guest@example.com':'owner@example.com',emailVerified:true,providerData:[{}]})},
 github:{add:async()=>{commits++;return {sha:'commit'};}},db:{doc:path=>({set:async()=>{},get:async()=>({exists,data:()=>({videos:[{id:c,visibility:'members',title:'Prayer meeting'}]})})})},send:async()=>pageStatus===200?new Response('<meta property="og:title" content="Prayer meeting">/Watch/?v='+c):new Response('',{status:pageStatus})};
const service=createStudioPublishing(deps),request={auth:{uid:'owner'},data:{videoId:c,visibility:'members'}};
await assert.rejects(service.publish({}),e=>e.code==='unauthenticated');ordinary=true;await assert.rejects(service.publish(request),e=>e.code==='permission-denied');assert.equal(commits,0);ordinary=false;
await assert.rejects(service.publish({...request,data:{videoId:'bad',visibility:'public'}}),e=>e.code==='invalid-argument');
await service.publish(request);assert.equal(commits,1);assert.equal((await service.status(request)).state,'publishing');exists=true;
assert.equal((await service.status(request)).state,'publishing','library alone cannot mark a missing share page ready');pageStatus=200;
assert.equal((await service.status(request)).state,'ready');assert.equal((await service.status({...request,data:{videoId:c,visibility:'public'}})).state,'publishing','wrong audience cannot mark ready');
assert.equal(await watchAccess(a,{publicIds:[a]}),true);
assert.equal(await watchAccess(b,{}),false);
assert.equal(await watchAccess(b,{api:{user:{uid:'owner'},library:[{id:b}]}}),true);
assert.equal(await watchAccess(b,{api:{user:{uid:'anon',isAnonymous:true},library:[{id:b}]}}),false);
console.log('PASS: admin-only publication, audience validation, immutable existing audience, list order, atomic non-force commits, concurrent retry, readiness verification and Watch access checks.');
const helperKey='a'.repeat(64);
assert.equal(validHelperBearer('Bearer '+helperKey,helperKey+'\r\n'),true,'CLI-added secret newline does not reject a correct existing helper key');
assert.equal(validHelperBearer('Bearer '+helperKey,helperKey),true);
assert.equal(validHelperBearer('Bearer '+'b'.repeat(64),helperKey+'\n'),false);
assert.equal(validHelperBearer('',helperKey),false);
assert.equal(validHelperBearer('Bearer bad','bad'),false);
assert.equal(validHelperBearer('Bearer '+helperKey,helperKey.slice(1)),false);
assert.equal(validHelperBearer('Bearer '+helperKey.slice(0,32)+' '+helperKey.slice(32),helperKey),false,'embedded whitespace is not repaired');
console.log('PASS: trusted helper authentication accepts CLI newline but rejects wrong, missing, malformed and shortened keys.');
const declared=[{id:a,visibility:'members'},{id:b,visibility:'public'}];
assert.equal(markStudioSelection(declared,{videoId:a,visibility:'members',requestedAt:900},1000)[0].studioSelected,true);
assert.equal(markStudioSelection(declared,{videoId:a,visibility:'public',requestedAt:900},1000)[0].studioSelected,false,'audience mismatch is not preferred');
assert.ok(markStudioSelection(declared,{videoId:a,visibility:'members',requestedAt:900},13*3600000).every(v=>!v.studioSelected),'old requests expire');
console.log('PASS: only a recent, listed Studio selection with its correct audience is preferred.');
let dispatched=0;
const kick=githubPublisher({token:()=> 'test',send:async(url,options)=>{
 if(url.includes('/contents/.github/workflows/'))return Response.json({content:Buffer.from('repository_dispatch:\n  types: [lightcity-audio-ready]').toString('base64')});
 assert.ok(url.endsWith('/dispatches'));assert.equal(options.method,'POST');assert.equal(JSON.parse(options.body).event_type,'lightcity-audio-ready');dispatched++;return new Response(null,{status:204});
}});
assert.equal((await kick.kick()).requested,true);assert.equal(dispatched,1);
const notConfigured=githubPublisher({token:()=> 'test',send:async()=>Response.json({content:Buffer.from('workflow_dispatch:').toString('base64')})});
assert.equal((await notConfigured.kick()).requested,false,'a missing workflow trigger is reported instead of pretending publication started');
console.log('PASS: verified audio can trigger repository publication; a missing workflow trigger is reported safely.');