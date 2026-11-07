export const SUMMARY_DELAY=3*60*60*1000,QUIZ_DELAY=60*60*1000;
export const resourceId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
export function canonicalVideo(videos,id){return videos.find(v=>v.id===id)||videos.find(v=>v.replaces?.includes(id));}
export function accessFor(resource,videos){if(!resource.videoId)return resource.legacy===true?'public':null;const visibility=canonicalVideo(videos,resource.videoId)?.visibility;return ['public','members'].includes(visibility)?visibility:null;}
export function eligibleAt(resource,summary){return resource.kind==='Summary'?resource.teachingEndedAt+SUMMARY_DELAY:summary?.state==='published'?summary.publishedAt+QUIZ_DELAY:null;}
export function canRelease(resource,summary,now){const time=eligibleAt(resource,summary);return resource.state==='approved'&&Number.isFinite(time)&&time<=now;}
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
export function validateDraft(input){
 const kind=input.kind;if(!['Summary','Quiz'].includes(kind))throw Error('Choose a summary or quiz.');
 const title=text(input.title,300);if(!title)throw Error('A title is required.');
 if(kind==='Summary'){
  if(!Array.isArray(input.sections)||!input.sections.length||input.sections.length>40)throw Error('Add the summary sections.');
  const sections=input.sections.map(section=>{const heading=text(section.heading,250),points=section.points?.map(p=>text(p,4000));if(!heading||!Array.isArray(points)||!points.length||points.length>30||points.some(p=>!p))throw Error('Each section needs a heading and points.');return {heading,points};});
  const metadata={};
  if(input.teachingDate!==undefined){if(typeof input.teachingDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.teachingDate)||!Number.isFinite(Date.parse(input.teachingDate))||new Date(input.teachingDate).toISOString().slice(0,10)!==input.teachingDate)throw Error('Choose a valid teaching date.');metadata.teachingDate=input.teachingDate;}
  if(input.categories!==undefined){if(!Array.isArray(input.categories)||input.categories.length>12||input.categories.some(c=>typeof c!=='string'||!c.trim()||c.length>80||/[<>\r\n]/.test(c)))throw Error('Check the summary categories.');metadata.categories=[...new Set(input.categories.map(c=>c.trim()))];}
  return {kind,title,sections,...metadata};
 }
 if(!Array.isArray(input.questions)||!input.questions.length||input.questions.length>250)throw Error('A quiz needs 1–250 questions.');
 const questions=input.questions.map((q,i)=>{
  const prompt=text(q.prompt,3000),options=q.options?.map(o=>text(o,3000)),correct=q.correct;
  if(!prompt||!Array.isArray(options)||options.length<2||options.length>12||options.some(o=>!o)||new Set(options).size!==options.length)throw Error('Check question '+(i+1)+' and its options.');
  if(!Array.isArray(correct)||!correct.length||new Set(correct).size!==correct.length||correct.some(v=>!Number.isInteger(v)||v<0||v>=options.length))throw Error('Check the correct answers for question '+(i+1)+'.');
  return {id:'q'+(i+1),prompt,options,correct:[...correct].sort((a,b)=>a-b),explanation:text(q.explanation,4000),reference:text(q.reference,500),hint:text(q.hint,1000)};
 });return {kind,title,questions};
}
export function answersFor(quiz,input,{complete=false}={}){
 if(!Array.isArray(input)||input.length!==quiz.questions.length)throw Error('The answers do not match this quiz.');
 return input.map((answer,i)=>{if(!Array.isArray(answer)||new Set(answer).size!==answer.length||answer.length>quiz.questions[i].options.length||answer.some(n=>!Number.isInteger(n)||n<0||n>=quiz.questions[i].options.length)||complete&&!answer.length)throw Error('Check the answers for question '+(i+1)+'.');return [...answer].sort((a,b)=>a-b);});
}
export function gradeQuiz(quiz,answers){const clean=answersFor(quiz,answers,{complete:true}),review=quiz.questions.map((q,i)=>({questionId:q.id,correct:JSON.stringify(clean[i])===JSON.stringify(q.correct),answers:clean[i],correctAnswers:q.correct,explanation:q.explanation,reference:q.reference}));const correct=review.filter(r=>r.correct).length;return {correct,total:review.length,percentage:Math.round(correct*10000/review.length)/100,review};}
export function publicResource(r,visibility){return {id:r.id,kind:r.kind,title:r.title,videoId:r.videoId||null,visibility,state:r.state,version:r.version||1,publishedAt:r.publishedAt||null,teachingDate:r.teachingDate||null,categories:r.categories||[],url:r.legacyUrl||'/StudyResource/?id='+encodeURIComponent(r.id),...(r.sections?{sections:r.sections}:{}),...(r.questions?{questions:r.questions.map(({correct,explanation,reference,...q})=>({...q,multiple:correct.length>1}))}:{})};}
