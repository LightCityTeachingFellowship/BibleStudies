import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
// Git handles conflict checks; never reset, stash, commit, or replace a local edit.
export async function syncLocalRepository(root,{run=execute}={}){
 const options={cwd:root,windowsHide:true,timeout:30000,maxBuffer:2_000_000,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}};
 const git=async(...args)=>(await run('git',args,options)).stdout;
 const branch=(await git('branch','--show-current')).trim();if(branch!=='master')return {synced:false,reason:'branch'};
 const edits=await git('status','--porcelain=v1','-z','--untracked-files=all','--','Posts-Summaries/_posts','QuizQuestions-Adult');
 if(edits)return {synced:false,reason:'local-learning-edits'};
 await git('fetch','--no-tags','origin','master');
 const local=(await git('rev-parse','HEAD')).trim(),remote=(await git('rev-parse','FETCH_HEAD')).trim();
 if(local===remote)return {synced:true,changed:false};
 try{await git('merge','--ff-only','FETCH_HEAD');}catch(error){return {synced:false,reason:'needs-review',detail:String(error.stderr||error.message||'').slice(-300)}}
 return {synced:true,changed:true};
}
