const api=()=>globalThis.LightCityMembers;
let rows=[],message='',owner='',epoch=0;
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
function hasActivity(row){return !!(row.attemptId||row.completed||Number(row.question)>0||row.answers?.some(a=>Array.isArray(a)&&a.length));}
export function quizHistory(){return rows.filter(hasActivity).map(row=>({type:'quiz',row,item:row.resource}));}
export function quizCard(row){
 const card=el('article');card.className='lc-hub-resource lc-hub-resource-body lc-hub-quiz-card';const link=el('a'),url=row.resource.url;link.className='lc-hub-quiz-title';link.href=url;link.append(el('h3',row.resource.title));card.append(el('p','QUIZ'),link);const count=row.resource.questionCount||row.resource.questions?.length||1,answered=row.answers?.filter(a=>a.length).length||0,p=el('progress');p.max=count;p.value=row.completed?count:answered;p.setAttribute('aria-label','Quiz progress');const result=row.result;card.append(p,el('p',row.completed?(result?'Score: '+result.percentage+'% · '+result.correct+'/'+result.total:'Completed'):answered+' of '+count+' answered'));const resume=el('a',row.completed?'Review quiz':'Continue quiz');resume.className='lc-hub-quiz-resume';resume.href=url;card.append(resume);
 if(owner&&row.completed){const details=el('details');details.append(el('summary','Previous attempts'));details.ontoggle=async()=>{if(!details.open||details.dataset.loaded)return;const uid=owner,ticket=epoch;try{const result=await api().quizActivity({action:'attempts',id:row.resource.id});if(ticket!==epoch||uid!==api()?.user?.uid)return;for(const a of result.attempts)details.append(el('p',new Date(a.completedAt).toLocaleString()+' · '+a.percentage+'%'));details.dataset.loaded='true';}catch{details.append(el('p','Previous attempts could not load.'));}};card.append(details);}return card;
}
export function quizShelf(view='overview'){
 const section=el('section');section.className='lc-hub-shelf lc-hub-quiz-shelf'+(view==='overview'?' lc-hub-quiz-overview':'');section.append(el('h2',view==='saved'?'Saved quizzes':view==='history'?'Quiz history':'Your quizzes'));
 const filtered=rows.filter(r=>view==='saved'?r.saved:hasActivity(r));if(message)section.append(el('p',message));if(!filtered.length)section.append(el('p',view==='saved'?'Save a quiz to find it here.':'Quiz progress and completed scores will appear here.'));
 const grid=el('div');grid.className='lc-hub-grid';grid.append(...filtered.map(quizCard));section.append(grid);return section;
}

async function load(){const ticket=++epoch;rows=[];message='';await api()?.ready;owner=api()?.user&&!api().user.isAnonymous?api().user.uid:'';try{
 if(owner){const result=await api().quizActivity({action:'history'});if(ticket!==epoch)return;rows=result.rows;}
 else{const {resources}=await api().learning({});if(ticket!==epoch)return;for(const resource of resources.filter(r=>r.kind==='Quiz')){try{const state=JSON.parse(localStorage.getItem('lc-quiz-v1:device:'+resource.id));if(state)rows.push({...state,resource});}catch{}}}
 }catch{if(ticket===epoch)message='Quiz history could not load. Refresh to retry.';}if(ticket===epoch)window.dispatchEvent(new Event('lightcity-quizzes-changed'));
}
window.addEventListener('lightcity-members-changed',()=>void load());void load();
