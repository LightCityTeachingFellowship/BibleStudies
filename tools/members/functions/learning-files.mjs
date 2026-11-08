import {createHash} from 'node:crypto';
import {accessFor,validateDraft} from './learning-core.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const html=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('{','&#123;').replaceAll('}','&#125;');
const slug=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)||'LightCity';
const json=v=>JSON.stringify(v).replaceAll('<','\\u003c');
export function learningFile(resource,visibility,summary){
 if(resource.state!=='published'||!['members','public'].includes(visibility))throw Error('Only approved, published resources can create website files.');
 if(!/^(summary|quiz)-[\w-]{11}$/.test(resource.id))throw Error('Invalid generated resource.');
 const draft=validateDraft(resource),date=resource.teachingDate||summary?.teachingDate||new Date(resource.teachingEndedAt+3600000).toISOString().slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))throw Error('A teaching date is required.');
 const name=date+'-'+slug(draft.title),isSummary=draft.kind==='Summary';
 const path=isSummary?'Posts-Summaries/_posts/'+name+'.html':'QuizQuestions-Adult/'+name+'.html';
 const url=isSummary?'/'+slug(draft.title)+'-'+date+'/':'/'+path;
 const categories=isSummary?[...new Set(['Year-'+date.slice(0,4),...(resource.categories||[]).filter(c=>!/^Year-/.test(c))])]:['Quiz Cat'];
 const front=['---','visibility: '+visibility,'layout: '+(isSummary?'summaryTEMPLATE':'QandA-TEMPLATE'),'title: '+json(draft.title),'permalink: '+json(url),'categories: '+json(categories),'tags: '+json(isSummary?categories:['Adult']),'date: '+date,...(!isSummary?['subsection: [Adult]']:[]),'learning_resource_id: '+resource.id,'source_video_id: '+resource.videoId,'learning_version: '+(Number.isSafeInteger(resource.version)?resource.version:1),'notification_policy: manual','---',''];
 let body;
 if(visibility==='members'){
  body=isSummary?'<div data-generated-summary="'+resource.id+'" role="status"></div>\n<script type="module" src="/script/generated-summary.mjs?v=1"></script>':'<!-- Questions are loaded only after church membership is verified. -->';
 }else if(isSummary){
  let first=true;body='<header><h1>'+html(draft.title)+'</h1></header>\n'+draft.sections.map(s=>'<h2>'+html(s.heading)+'</h2>\n<ol>\n'+s.points.map(p=>{const text='    <li>'+html(p)+'</li>';if(!first)return text;first=false;return '<!--excerpt.start-->\n'+text+'\n<!--excerpt.end-->';}).join('\n')+'\n</ol>').join('\n');
 }else{
  body='<ol>\n'+draft.questions.map(q=>'    <li>'+html(q.prompt)+(q.hint||q.correct.length>1?'\n        <em>'+html([q.correct.length>1?'Select all answers that apply.':'',q.hint].filter(Boolean).join(' '))+'</em>':'')+'\n        <ul>\n'+q.options.map((o,i)=>'            <li>'+(q.correct.includes(i)?'<strong>'+html(o)+'</strong>':html(o))+(q.correct.includes(i)&&(q.explanation||q.reference)?'<ul><li>'+html([q.explanation,q.reference].filter(Boolean).join(' '))+'</li></ul>':'')+'</li>').join('\n')+'\n        </ul>\n    </li>').join('\n')+'\n</ol>';
 }
 const content=front.join('\n')+'\n'+body+'\n';return {id:resource.id,path,url,content,hash:hash(content)};
}
export async function commitLearningFiles(files,{token,send=fetch}){
 if(!files.length)return null;
 const base='https://api.github.com/repos/LightCityTeachingFellowship/BibleStudies';
 async function request(path,method='GET',body){const r=await send(base+path,{method,headers:{Authorization:'Bearer '+token(),Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});if(!r.ok){await r.body?.cancel();const e=Error('Website file publishing failed (GitHub HTTP '+r.status+').');e.status=r.status;throw e;}return r.json();}
 for(let attempt=0;attempt<3;attempt++){
  const head=(await request('/git/ref/heads/master')).object.sha,commit=await request('/git/commits/'+head);
  for(const f of files){
   let existing;try{existing=await request('/contents/'+f.path+'?ref='+head);}catch(e){if(e.status!==404)throw e;}
   if(existing&&(!existing.content||!Buffer.from(existing.content,'base64').toString('utf8').includes('learning_resource_id: '+f.id+'\n')))throw Error('A different publication already uses '+f.path+'. Choose a distinct title.');
  }
  const tree=await request('/git/trees','POST',{base_tree:commit.tree.sha,tree:files.map(f=>({path:f.path,mode:'100644',type:'blob',content:f.content}))});
  if(tree.sha===commit.tree.sha)return head;
  const next=await request('/git/commits','POST',{message:'Publish approved summary and quiz files (notifications held)',tree:tree.sha,parents:[head]});
  try{await request('/git/refs/heads/master','PATCH',{sha:next.sha,force:false});return next.sha;}catch(e){if(e.status!==422||attempt===2)throw e;}
 }
}
export async function syncLearningFiles({db,token,send=fetch}){
 const [snapshot,library]=await Promise.all([db.collection('churchVideoActivity/learning/resources').where('state','==','published').get(),db.doc('churchVideoLibrary/current').get()]);
 const rows=snapshot.docs.map(d=>({doc:d,...d.data()})),files=[];
 for(const r of rows){if(r.legacy===true)continue;const visibility=accessFor(r,library.data()?.videos||[]);if(!visibility)continue;const file=learningFile(r,visibility,rows.find(s=>s.id===r.summaryId));if(r.fileHash!==file.hash)files.push(file);}
 if(!files.length)return {files:0};
 const commit=await commitLearningFiles(files,{token,send});
 for(const f of files)await db.doc('churchVideoActivity/learning/resources/'+f.id).set({filePath:f.path,fileUrl:f.url,fileHash:f.hash,fileCommit:commit,filePublished:false},{merge:true});
 return {files:files.length,commit};
}
