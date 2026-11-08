// Generated questions use the same board, feedback, results, fonts and themes as existing quizzes.
const api=()=>globalThis.LightCityMembers,params=new URL(location.href).searchParams,id=params.get('id')||document.querySelector('[data-file-quiz-id]')?.dataset.fileQuizId,preview=params.get('preview')==='1';
const status=document.getElementById('classic-quiz-status'),content=document.getElementById('classic-quiz-content')||document.getElementById('QandA-section');
content.hidden=true;document.querySelector('.loader-bg-bibleQuiz')?.remove();
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
const script=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('Quiz controls could not load. Refresh to retry.'));document.body.append(s);});
try{
 await api()?.ready;if(!api()?.learning)throw Error('The app could not connect. Refresh to retry.');
 const {resource:r}=await api().learning({id,format:'classic',...(preview?{preview:true}:{})});
 if(!preview&&r.url&&!new URL(r.url,location.origin).search&&new URL(r.url,location.origin).pathname!==location.pathname){location.replace(r.url);throw Error('Opening the quiz…');}
 if(r.kind!=='Quiz'||!r.questions?.length)throw Error('This quiz is not available.');
 window.LightCityClassicQuiz={...r,preview};document.title=r.title+' | LightCity';
 const ol=el('ol');
 for(const q of r.questions){
  const li=el('li');
  // The original engine converts the prompt to HTML. Escape it before passing it along.
  li.append(document.createTextNode(q.prompt.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')));
  if(q.hint||q.correct.length>1)li.append(el('em',[q.correct.length>1?'Select all answers that apply.':'',q.hint].filter(Boolean).join(' ')));
  const ul=el('ul');q.options.forEach((text,i)=>{const option=el('li');option.append(q.correct.includes(i)?el('strong',text):document.createTextNode(text));if(q.correct.includes(i)&&(q.explanation||q.reference)){const notes=el('ul');notes.append(el('li',[q.explanation,q.reference].filter(Boolean).join(' ')));option.append(notes);}ul.append(option);});li.append(ul);ol.append(li);
 }
 document.querySelector('.QandA-Board').append(ol);document.querySelector('#quizCatName span').textContent=r.title;
 // These are the links resolved by the original Adult Quiz template.
 const newQuiz=document.querySelector('.quizCatLink');newQuiz.textContent='New Quiz';newQuiz.href='/QuizQuestions-Adult/A0-Home-Adult.html';
 document.querySelectorAll('#newBtn,.corAnswers-btn button:last-child').forEach(n=>{n.replaceChildren();const a=el('a','New Quiz');a.href='/QuizQuestions-Adult/A0-Home-Adult.html';n.append(a);});
 document.querySelectorAll('#settingsContent a').forEach(a=>a.href='/QuizQuestions-Adult/A0-Home-Adult.html');
 await script('/script/victorScripts/QandAscriptsFontsandThemes.js?v=quiz-repair-2');
 await script('/script/victorScripts/QandAscripts.js?v=quiz-repair-2');
 if(!window.LightCityQuizEngineReady)throw Error('Quiz controls did not initialize. Refresh to retry.');
 content.hidden=false;status.textContent=preview?'Private preview · not published · no notifications. Scores here do not affect your history.':'';
 await script('/script/victorScripts/recentposts.js');
 await import('./legacy-quiz-session.mjs?v=quiz-viewport-1');
 window.addEventListener('lightcity-members-changed',()=>{content.hidden=true;location.reload();});
}catch(e){content.hidden=true;status.textContent=e.message||'This quiz could not load.';const retry=el('button','Retry');retry.onclick=()=>location.reload();status.append(retry);}
