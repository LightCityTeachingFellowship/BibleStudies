import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {basename, dirname, isAbsolute, join, relative, sep} from 'node:path';
import {homedir} from 'node:os';
import {readFile} from 'node:fs/promises';

const execute = promisify(execFile);
export function createProjectActions({dialog, shell, getWindow, run=execute, home=homedir()}) {
 const project = join(home, 'OneDrive', 'Desktop', 'LightCityApp_Project', 'LightCity-Website');
 const git = async (...args) => (await run('git', args, {cwd:project, windowsHide:true, maxBuffer:2_000_000})).stdout.trim();
 let busy = false;
 async function exclusive(task) {
  if (busy) throw Error('Another project action is already running.');
  busy = true;
  try { return await task(); } finally { busy = false; }
 }
 function selectedPath(file) {
  const rel = relative(project, file);
  if (!rel || rel === '..' || rel.startsWith('..'+sep) || isAbsolute(rel)) throw Error('Choose files inside the website project.');
  const name=rel.replaceAll('\\','/');
  if (/(^|\/)(\.git|node_modules|_site|_preview|_windows-build[^/]*|_android-build[^/]*|_latest-build|service-account-key|oauth client|audio queue)(\/|$)/i.test(name) || /(^|\/)(\.env(?:\.|$)|.*(?:secret|credential|private.?key|service.account).*)/i.test(name) || /\.(jks|keystore|p12|pem|key|zip|apk|dpapi)$/i.test(name)) throw Error('The selection contains a generated or private file. Choose website source files only.');
  return name;
 }
 async function buildAndroid() { return exclusive(async()=>{
  const root=join(dirname(project),'LightCity-Android');
  const script=join(project,'tools','Build-Android-From-Website.ps1');
  await readFile(script);
  const answer=await dialog.showMessageBox(getWindow(),{type:'question',title:'Build Android app',message:'Build a signed Android APK from this website project?',detail:'This may take several minutes. The APK stays on this computer and is not published.',buttons:['Build APK','Cancel'],defaultId:1,cancelId:1});
  if(answer.response!==0)return;
  try {
   await run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',script],{cwd:project,windowsHide:true,maxBuffer:20_000_000,timeout:60*60*1000});
   const gradle=await readFile(join(root,'android','app','build.gradle'),'utf8');
   const version=gradle.match(/^\s*versionName\s+"([0-9A-Za-z._-]+)"\s*$/m)?.[1];
   if(!version)throw Error('Build finished, but the version could not be read.');
   const apk=join(root,'releases',`LightCity-${version}-production.apk`);
   await dialog.showMessageBox(getWindow(),{type:'info',title:'APK ready',message:'Your signed APK is ready.',detail:apk});
   shell.showItemInFolder(apk);
  } catch(error) {
   const detail=String(error.stderr||error.stdout||error.message||error).slice(-3000);
   await dialog.showMessageBox(getWindow(),{type:'error',title:'APK build did not finish',message:'The APK was not created. Check the details below.',detail});
  }
 }); }
 async function upload() { return exclusive(async()=>{
  try {
   const status=(await run('git',['status','--porcelain=v1','-z','--untracked-files=all'],{cwd:project,windowsHide:true,maxBuffer:2_000_000})).stdout.split('\0').filter(Boolean);
   const files=[], excluded=[];
   for(let i=0;i<status.length;i++){
    const entry=status[i],flags=entry.slice(0,2),name=entry.slice(3);
    const candidates=[name];if(/[RC]/.test(flags)&&i+1<status.length)candidates.push(status[++i]);
    for(const candidate of candidates){try{files.push(selectedPath(join(project,candidate)));}catch{excluded.push(candidate);}}
   }
   const selected=[...new Set(files)];
   if(!selected.length){
    const branch=await git('branch','--show-current');if(!branch)throw Error('The website project is not on a branch.');
    await git('fetch','origin');let reference='origin/'+branch;try{await git('rev-parse','--verify','refs/remotes/'+reference);}catch{reference='origin/master';}
    const ahead=Number(await git('rev-list','--count',reference+'..HEAD'));
    if(!ahead){await dialog.showMessageBox(getWindow(),{type:'info',title:'No website changes',message:'There are no eligible website changes to upload.',detail:excluded.length?'Private or generated files were skipped.':''});return;}
    const confirm=await dialog.showMessageBox(getWindow(),{type:'question',title:'Sync website commits',message:`Sync ${ahead} existing local commit(s) to GitHub?`,detail:'Branch: '+branch+(branch==='master'?'\nSyncing this branch triggers website publishing.':''),buttons:['Sync','Cancel'],defaultId:1,cancelId:1});if(confirm.response!==0)return;
    await git('push','-u','origin',branch);await dialog.showMessageBox(getWindow(),{type:'info',title:'Website synced',message:'Your local commits were synced to GitHub.',detail:'Branch: '+branch});return;
   }
   const branch=await git('branch','--show-current');if(!branch)throw Error('The website project is not on a branch.');
   const detail=selected.join('\n')+(excluded.length?'\n\nSkipped private or generated files: '+excluded.length:'')+'\n\nBranch: '+branch+(branch==='master'?'\nSyncing this branch triggers website publishing.':'');
   const choice=await dialog.showMessageBox(getWindow(),{type:'question',title:'Commit and sync website',message:`Commit and sync ${selected.length} changed file(s)?`,detail,buttons:['Commit and sync','Cancel'],defaultId:1,cancelId:1});
   if(choice.response!==0)return;
   const staged=(await git('diff','--cached','--name-only','-z')).split('\0').filter(Boolean);
   for(const name of staged) if(!selected.includes(name.replaceAll('\\','/')))throw Error('A staged private or generated file was found. Remove it from staging before syncing.');
   await git('add','-A','--',...selected);
   if(!await git('diff','--cached','--name-only'))throw Error('No eligible changes remain to commit.');
   await git('commit','-m','Update website from LightCity Studio');
   await git('fetch','origin');
   let hasRemote=false;try{await git('rev-parse','--verify','refs/remotes/origin/'+branch);hasRemote=true;}catch{}
   if(hasRemote)await git('merge','--ff-only','origin/'+branch);
   await git('push','-u','origin',branch);
   await dialog.showMessageBox(getWindow(),{type:'info',title:'Website synced',message:'Your changes were committed and synced to GitHub.',detail:'Branch: '+branch});
  } catch(error) {
   const detail=String(error.stderr||error.stdout||error.message||error).slice(-3000);
   await dialog.showMessageBox(getWindow(),{type:'error',title:'Sync did not finish',message:'Check the details before trying again. A local commit may already have been created.',detail});
  }
 }); }
 return {buildAndroid,upload,selectedPath,project};
}
