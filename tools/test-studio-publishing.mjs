import assert from 'node:assert/strict';
import {planAddition,parseIds,githubPublisher,createStudioPublishing} from './members/functions/studio-publishing.mjs';
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