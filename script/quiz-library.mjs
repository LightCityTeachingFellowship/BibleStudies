const api=()=>globalThis.LightCityMembers;
let rows=[],message='',owner='',epoch=0;
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
export function quizShelf(view='overview'){
 const section=el('section');section.className='lc-hub-shelf';section.append(el('h2',view==='saved'?'Saved quizzes':view==='history'?'Quiz history':'Your quizzes'));
 const filtered=rows.filter(r=>view==='saved'?r.saved:r.attemptId||r.completed);if(message)section.append(el('p',message));
 if(!filtered.length)section.append(el('p',view==='saved'?'Save a quiz to find it here.':'Quiz progress and completed scores will appear here.'));
 const grid=el('div');grid.className='lc-hub-grid';for(const row of filtered){const card=el('article');card.className='lc-hub-resource lc-hub-resource-body';const link=el('a'),url=row.resource.url;link.href=url;link.append(el('h3',row.resource.title));card.append(el('p','QUIZ'),link);const count=row.resource.questionCount||row.resource.questions?.length||1,answered=row.answers?.filter(a=>a.length).length||0,p=el('progress');p.max=count;p.value=row.completed?count:answered;p.setAttribute('aria-label','Quiz progress');card.append(p,el('p',row.completed?'Score: '+row.result.percentage+'% · '+row.result.correct+'/'+row.result.total:answered+' of '+count+' answered'));const resume=el('a',row.completed?'Review quiz':'Continue quiz');resume.href=url;card.append(resume);
  if(owner&&row.completed){const details=el('details');details.append(el('summary','Previous attempts'));details.ontoggle=async()=>{if(!details.open||details.dataset.loaded)return;const uid=owner,ticket=epoch;try{const result=await api().quizActivity({action:'attempts',id:row.resource.id});if(ticket!==epoch||uid!==api()?.user?.uid)return;for(const a of result.attempts)details.append(el('p',new Date(a.completedAt).toLocaleString()+' · '+a.percentage+'%'));details.dataset.loaded='true';}catch{details.append(el('p','Previous attempts could not load.'));}};card.append(details);}grid.append(card);
 }section.append(grid);return section;
}
async function load(){const ticket=++epoch;rows=[];message='';await api()?.ready;owner=api()?.user&&!api().user.isAnonymous?api().user.uid:'';try{
 if(owner){const result=await api().quizActivity({action:'history'});if(ticket!==epoch)return;rows=result.rows;}
 else{const {resources}=await api().learning({});if(ticket!==epoch)return;for(const resource of resources.filter(r=>r.kind==='Quiz')){try{const state=JSON.parse(localStorage.getItem('lc-quiz-v1:device:'+resource.id));if(state)rows.push({...state,resource});}catch{}}}
 }catch{if(ticket===epoch)message='Quiz history could not load. Refresh to retry.';}if(ticket===epoch)window.dispatchEvent(new Event('lightcity-quizzes-changed'));
}
window.addEventListener('lightcity-members-changed',()=>void load());void load();
