import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createReleaseActions,parseBadging,sha256,updateDownloadPage} from './release-actions.mjs';

test('only the active download link is updated',()=>{
 const old='https://github.com/LightCityTeachingFellowship/BibleStudies/releases/download/v1.0.3/old.apk';
 const html=`<body><a href="${old}">Download</a></body><!-- <a href="${old}">old</a> -->`;
 const next=updateDownloadPage(html,'https://example.test/new.apk');assert.equal((next.match(/example\.test/g)||[]).length,1);assert.ok(next.includes(`<!-- <a href="${old}">`));
 assert.throws(()=>updateDownloadPage('<body>No link</body>','https://example.test'));
 assert.deepEqual(parseBadging("package: name='com.lightcityfellowship.mobilepilot' versionCode='33' versionName='1.0.5'"),{code:33,version:'1.0.5'});
 assert.throws(()=>parseBadging("package: name='other.app' versionCode='33' versionName='1.0.5'"));
});
async function fixture(confirmPublish){
 const root=await mkdtemp(join(tmpdir(),'lightcity-release-test-')),project=join(root,'website'),releases=join(root,'LightCity-Android','releases');await mkdir(project);await mkdir(releases,{recursive:true});
 const apk=join(releases,'LightCity-1.0.5-production.apk'),bytes=Buffer.from('apk fixture');await writeFile(apk,bytes);
 const original='<body><a href="https://github.com/LightCityTeachingFellowship/BibleStudies/releases/download/v1.0.3/old.apk">Download</a></body>';
 await writeFile(join(project,'downloads.html'),original);await writeFile(join(project,'android-update.json'),JSON.stringify({versionCode:31,versionName:'1.0.3'}));
 const calls=[],dialogs=[];
 const run=async(_cmd,args)=>{calls.push(args);if(args[0]==='branch')return {stdout:'master'};if(args[0]==='rev-parse')return {stdout:'abc'};return {stdout:''};};
 const dialog={showOpenDialog:async()=>({canceled:false,filePaths:[apk]}),showMessageBox:async(_w,d)=>{dialogs.push(d);return {response:d.title==='Publish app release'&&!confirmPublish?1:0};}};
 const request=async(url,opts={})=>{calls.push([opts.method||'GET',url]);if(url.includes('/actions/workflows/'))return Response.json({workflow_runs:[{head_sha:'abc',event:'push',status:'completed',conclusion:'success'}]});if(url.endsWith('/releases?per_page=100'))return Response.json([]);if(url.endsWith('/releases')&&opts.method==='POST')return Response.json({id:55,draft:true});if(url.includes('/assets?per_page=100'))return Response.json([]);if(url.includes('uploads.github.com'))return Response.json({id:77,name:'LightCity-1.0.5-production.apk',size:bytes.length});if(url.endsWith('/assets/77'))return new Response(bytes);if(opts.method==='PATCH')return Response.json({draft:false});throw Error('Unexpected URL '+url);};
 const actions=createReleaseActions({project,dialog,getWindow:()=>null,run,request,getCredentials:async()=> 'fake-token',inspect:async()=>({code:33,version:'1.0.5'}),wait:async()=>{}});
 await actions.release();return {project,original,calls,dialogs,hash:sha256(bytes)};
}
test('leaving the draft never publishes and restores website files',async()=>{
 const f=await fixture(false);assert.equal(await readFile(join(f.project,'downloads.html'),'utf8'),f.original);assert.ok(!f.calls.some(x=>x[0]==='PATCH'));assert.ok(!f.calls.some(x=>x[0]==='push'));assert.ok(f.dialogs.some(x=>x.title==='Draft saved'));
});
test('confirmed release verifies asset, updates only release files and pushes',async()=>{
 const f=await fixture(true),update=JSON.parse(await readFile(join(f.project,'android-update.json'),'utf8'));assert.equal(update.sha256,f.hash);assert.equal(update.versionCode,33);assert.ok(f.calls.some(x=>x[0]==='PATCH'));assert.ok(f.calls.some(x=>x[0]==='commit'&&x.includes('--only')));assert.ok(f.calls.some(x=>x[0]==='push'));assert.ok(f.dialogs.some(x=>x.title==='App release published'));
});
