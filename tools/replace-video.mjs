import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {parseVideoIds} from './video-library.mjs';
import {loadReplacements,planReplacement} from './video-replacements.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),args=process.argv.slice(2),get=name=>args[args.indexOf(name)+1];
function id(value){value=String(value||'').trim();if(/^[\w-]{11}$/.test(value||''))return value;try{const u=new URL(value);if(!['youtube.com','www.youtube.com','youtu.be'].includes(u.hostname))throw Error();return u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).at(-1);}catch{throw Error('Enter a YouTube video ID or watch/share URL.');}}
if(!args.includes('--from')||!args.includes('--to'))throw Error('Use --from OLD_VIDEO_ID --to UPLOADED_VIDEO_ID [--apply].');
const files=['video-ids-public.txt','video-ids-members.txt'].map(name=>join(root,'_includes',name));
const texts=await Promise.all(files.map(p=>readFile(p,'utf8'))),publicIds=parseVideoIds(texts[0]),memberIds=parseVideoIds(texts[1]);
const plan=planReplacement({publicIds,memberIds,replacements:await loadReplacements(root),from:id(get('--from')),to:id(get('--to'))});
if(!args.includes('--apply')){console.log('Validated silent replacement. Add --apply to update the two ID lists and replacement record. No files changed.');process.exit(0);}
// All validation finishes before any local files are changed. Restore them if a write fails.
const mapping=join(root,'_data/video_replacements.json'),original=await readFile(mapping,'utf8');
try{await writeFile(mapping,JSON.stringify(plan.replacements,null,2)+'\n');for(let i=0;i<files.length;i++)await writeFile(files[i],(i===0?plan.publicIds:plan.memberIds).join('\n')+'\n');}
catch(error){await writeFile(mapping,original);await Promise.all(files.map((p,i)=>writeFile(p,texts[i])));throw error;}
console.log('Silent replacement saved locally. Commit and sync all three changed files together. Old Watch links and bookmarks will use the uploaded video. No notifications were sent.');
