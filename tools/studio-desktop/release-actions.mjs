import {createHash} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {join,dirname,basename} from 'node:path';

const REPO='LightCityTeachingFellowship/BibleStudies';
const API='https://api.github.com';
const CERT='f9ba01b405af136a85ca638bbaa859a21f752ae42b0ec303623a648596075a2d';
const execute=promisify(execFile);
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function updateDownloadPage(html,url){
 const body=html.match(/<body\b[^>]*>[\s\S]*?<\/body>/i);if(!body)throw Error('Download page structure changed. Update it manually.');
 const pattern=/(href\s*=\s*["'])https:\/\/github\.com\/LightCityTeachingFellowship\/BibleStudies\/releases\/download\/[^"']+\.apk(["'])/gi;
 const matches=[...body[0].matchAll(pattern)];if(matches.length!==1)throw Error('Could not identify exactly one active APK download link.');
 return html.replace(body[0],body[0].replace(pattern,(_m,a,b)=>a+url+b));
}
export function parseBadging(text){
 const m=text.match(/package: name='([^']+)' versionCode='(\d+)' versionName='(\d+\.\d+\.\d+)'/);
 if(!m||m[1]!=='com.lightcityfellowship.mobilepilot')throw Error('The selected file is not a LightCity production APK.');
 return {code:Number(m[2]),version:m[3]};
}
function credentials(project){return new Promise((resolve,reject)=>{
 const p=spawn('git',['credential','fill'],{cwd:project,windowsHide:true,stdio:['pipe','pipe','ignore']});let output='';
 p.stdout.setEncoding('utf8');p.stdout.on('data',x=>{output+=x;if(output.length>16384)p.kill();});p.on('error',reject);
 p.on('close',code=>{if(code!==0)return reject(Error('GitHub sign-in is unavailable. Sign in to Git on this computer and retry.'));const lines=Object.fromEntries(output.split(/\r?\n/).map(x=>{const i=x.indexOf('=');return i<0?['','']:[x.slice(0,i),x.slice(i+1)];}));if(!lines.password)return reject(Error('GitHub credentials were not found.'));resolve(lines.password);});
 p.stdin.end('protocol=https\nhost=github.com\n\n');
});}
function sdkPath(text){const m=text.match(/^sdk\.dir=(.+)$/m);if(!m)throw Error('Android SDK location was not found.');return m[1].trim().replace(/\\:/g,':').replace(/\\\\/g,'\\');}
export async function inspectApk(apk,android,run=execute){
 const sdk=sdkPath(await readFile(join(android,'android','local.properties'),'utf8'));
 const versions=(await readdir(join(sdk,'build-tools'),{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
 if(!versions.length)throw Error('Android build tools are missing.');
 const dir=join(sdk,'build-tools',versions[0]),java=join(process.env.ProgramFiles||'C:\\Program Files','Android','Android Studio','jbr');
 const env={...process.env,JAVA_HOME:java,PATH:join(java,'bin')+';'+process.env.PATH};
 const opts={windowsHide:true,env,maxBuffer:2_000_000};
 const signed=await run(join(java,'bin','java.exe'),['-jar',join(dir,'lib','apksigner.jar'),'verify','--print-certs',apk],opts);
 const digests=[...signed.stdout.matchAll(/certificate SHA-256 digest:\s*([a-f0-9]+)/gi)].map(x=>x[1].toLowerCase());
 if(digests.length!==1||digests[0]!==CERT)throw Error('The APK is not signed with the current LightCity production key.');
 const badging=await run(join(dir,'aapt.exe'),['dump','badging',apk],opts);
 return parseBadging(badging.stdout);
}
export function createReleaseActions({project,dialog,getWindow,run=execute,request=fetch,getCredentials=credentials,inspect=inspectApk,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 const android=join(dirname(project),'LightCity-Android'),repoApi=API+'/repos/'+REPO;
 const git=async(...args)=>(await run('git',args,{cwd:project,windowsHide:true,maxBuffer:2_000_000})).stdout.trim();
 let busy=false;
 async function release(){
  if(busy)throw Error('A release is already being prepared.');busy=true;let token,releaseId,prepared=false,published=false,committed=false,oldPage,oldUpdate,newPage,newUpdate;
  const notes=[];
  async function api(url,options={}){
   const parsed=new URL(url);if(!['api.github.com','uploads.github.com'].includes(parsed.hostname)||parsed.protocol!=='https:')throw Error('Unexpected GitHub address.');
   const response=await request(url,{...options,redirect:'error',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+token,...options.headers}});
   if(!response.ok){const payload=await response.text().catch(()=> '');throw Error(`GitHub request failed (${response.status}): ${payload.slice(0,350)}`);}return response;
  }
  try{
   const pick=await dialog.showOpenDialog(getWindow(),{title:'Select the APK you tested',defaultPath:join(android,'releases'),properties:['openFile'],filters:[{name:'Android app',extensions:['apk']}]});if(pick.canceled||pick.filePaths.length!==1)return;
   const apk=pick.filePaths[0],file=basename(apk),info=await inspect(apk,android,run),tag='v'+info.version;
   if(file!==`LightCity-${info.version}-production.apk`)throw Error('The APK file name does not match its version.');
   const size=(await stat(apk)).size;if(!size||size>512*1024*1024)throw Error('The APK size is unexpected.');
   const bytes=await readFile(apk),hash=sha256(bytes);
   oldUpdate=await readFile(join(project,'android-update.json'),'utf8');oldPage=await readFile(join(project,'downloads.html'),'utf8');const current=JSON.parse(oldUpdate);
   if(!Number.isSafeInteger(info.code)||info.code<=Number(current.versionCode))throw Error('The APK version code is not newer than the current website version.');
   if((await git('branch','--show-current'))!=='master')throw Error('Switch the website project to master before releasing.');
   if(await git('status','--porcelain','--untracked-files=normal'))throw Error('Sync the website project changes in Studio before releasing, so the APK and website come from the same version.');
   if(await git('diff','--cached','--name-only'))throw Error('Files are already staged. Finish or unstage them before preparing a release.');
   await git('fetch','origin','master');if((await git('rev-parse','HEAD'))!==(await git('rev-parse','origin/master')))throw Error('Sync the website project with GitHub before releasing.');
   token=await getCredentials(project);
   const check=await dialog.showMessageBox(getWindow(),{type:'question',title:'Prepare app release',message:`Prepare a draft release for LightCity ${info.version}?`,detail:`APK: ${file}\nVersion code: ${info.code}\nSHA-256: ${hash}\n\nOnly continue if you have tested this exact APK on a phone.`,buttons:['Prepare draft','Cancel'],defaultId:1,cancelId:1});if(check.response!==0)return;
   const releases=await (await api(repoApi+'/releases?per_page=100')).json();let draft=releases.find(x=>x.tag_name===tag);
   if(draft&&!draft.draft)throw Error('This version is already published. Choose a newer APK.');
   if(!draft){const response=await api(repoApi+'/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tag_name:tag,target_commitish:'master',name:'LightCity '+info.version,draft:true,prerelease:false})});draft=await response.json();}
   releaseId=draft.id;if(!Number.isSafeInteger(releaseId)||draft.draft!==true)throw Error('GitHub did not return a valid draft release.');
   const assets=await (await api(repoApi+'/releases/'+releaseId+'/assets?per_page=100')).json();
   if(assets.some(x=>x.name!==file)||assets.filter(x=>x.name===file).length>1)throw Error('The draft has unexpected attachments. Review it on GitHub.');
   let asset=assets[0];if(!asset){const uploaded=await api(`https://uploads.github.com/repos/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(file)}`,{method:'POST',headers:{'Content-Type':'application/vnd.android.package-archive'},body:bytes});asset=await uploaded.json();}
   if(!Number.isSafeInteger(asset.id)||asset.name!==file||asset.size!==size)throw Error('The uploaded APK metadata did not match.');
   const downloaded=await request(repoApi+'/releases/assets/'+asset.id,{redirect:'manual',headers:{Accept:'application/octet-stream','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+token}});
   let assetResponse=downloaded;if(downloaded.status===302){const location=new URL(downloaded.headers.get('location'));if(location.protocol!=='https:'||!['release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(location.hostname))throw Error('Unexpected GitHub asset download address.');assetResponse=await request(location.href,{redirect:'error'});}
   if(!assetResponse.ok)throw Error('Could not download the uploaded APK for verification.');const uploadedBytes=Buffer.from(await assetResponse.arrayBuffer());if(sha256(uploadedBytes)!==hash)throw Error('The uploaded APK did not match the local file.');
   const url=`https://github.com/${REPO}/releases/download/${tag}/${file}`;
   newPage=updateDownloadPage(oldPage,url);newUpdate=JSON.stringify({...current,versionCode:info.code,versionName:info.version,downloadUrl:url,sha256:hash})+'\n';
   if(await readFile(join(project,'downloads.html'),'utf8')!==oldPage||await readFile(join(project,'android-update.json'),'utf8')!==oldUpdate)throw Error('Website files changed while preparing the draft.');
   await writeFile(join(project,'downloads.html'),newPage);prepared=true;await writeFile(join(project,'android-update.json'),newUpdate);
   const confirm=await dialog.showMessageBox(getWindow(),{type:'question',title:'Publish app release',message:`Publish LightCity ${info.version}?`,detail:`The APK was verified. Publishing will make it available and update the website download and app update information.\n\nAPK: ${file}\nSHA-256: ${hash}`,buttons:['Publish release','Leave draft'],defaultId:1,cancelId:1});if(confirm.response!==0){if(await readFile(join(project,'downloads.html'),'utf8')===newPage)await writeFile(join(project,'downloads.html'),oldPage);if(await readFile(join(project,'android-update.json'),'utf8')===newUpdate)await writeFile(join(project,'android-update.json'),oldUpdate);prepared=false;await dialog.showMessageBox(getWindow(),{type:'info',title:'Draft saved',message:'The verified APK is saved as a GitHub draft. Run Release app again when you are ready.'});return;}
   await git('fetch','origin','master');if((await git('rev-parse','HEAD'))!==(await git('rev-parse','origin/master')))throw Error('GitHub changed while the draft was being reviewed. The release remains a draft; reconcile before retrying.');
   if(await readFile(join(project,'downloads.html'),'utf8')!==newPage||await readFile(join(project,'android-update.json'),'utf8')!==newUpdate)throw Error('Website files changed during review; the release remains a draft.');
   await git('add','--','downloads.html','android-update.json');await git('commit','--only','-m',`Release LightCity ${info.version}`,'--','downloads.html','android-update.json');committed=true;
   await api(repoApi+'/releases/'+releaseId,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft:false})});published=true;
   const commit=await git('rev-parse','HEAD');await git('push','origin','master');
   let outcome='Website publication has started; check GitHub Actions for its status.';
   try{for(let i=0;i<30;i++){
    await wait(10000);const result=await (await api(repoApi+`/actions/workflows/audio-ready-pages.yml/runs?event=push&head_sha=${encodeURIComponent(commit)}&per_page=10`)).json();
    const job=(result.workflow_runs||[]).find(x=>x.head_sha===commit&&x.event==='push');if(!job)continue;
    if(job.status==='completed'){outcome=job.conclusion==='success'?'Website workflow completed. Check the live download page and update on a phone.':`Website workflow finished: ${job.conclusion}. Check GitHub Actions.`;break;}
   }}catch{outcome='The release was published, but Studio could not check the website workflow. Check GitHub Actions.';}
   await dialog.showMessageBox(getWindow(),{type:'info',title:'App release published',message:`LightCity ${info.version} was published.`,detail:outcome});
  }catch(error){
   notes.push(published?'The GitHub release is already public.':releaseId?'The release is still a GitHub draft.':'No release was published.');
   if(prepared)notes.push(committed?'The website update was committed locally; check whether it was pushed.':'The website update is prepared locally; review it before retrying.');
   await dialog.showMessageBox(getWindow(),{type:'error',title:'Release did not finish',message:'The release needs attention.',detail:String(error?.message||error).slice(0,800)+'\n\n'+notes.join('\n')});
  }finally{token=null;busy=false;}
 }
 return {release};
}
