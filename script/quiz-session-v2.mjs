// One serial save lane per quiz/account; switching accounts never imports guest answers.
export function createQuizSession({id,version,count,api,storage,owner,changed=()=>{}}){
 const key='lc-quiz-v1:'+encodeURIComponent(owner||'device')+':'+id;
 let state={version,answers:Array.from({length:count},()=>[]),question:0,saved:false,completed:false},lane=Promise.resolve(),timer;
 try{const value=JSON.parse(storage.getItem(key));if(value?.version===version&&value.answers?.length===count)state={...state,...value};}catch{}
 const validOwner=()=>!owner||api()?.user?.uid===owner;
 const persist=()=>{if(!validOwner())return;try{storage.setItem(key,JSON.stringify(state));}catch{}changed(state);};
 async function cloud(action,extra={}){if(!owner||!validOwner())return null;return api().quizActivity({action,id,...extra});}
 async function load(){if(owner){const result=await cloud('get');if(!validOwner())return;const remote=result?.activity;if(remote?.version===version&&remote.attemptId){const sameAttempt=state.attemptId===remote.attemptId,localResult=state.localOnlyResult&&state.completed&&sameAttempt,localNewer=sameAttempt&&!remote.completed&&Number(state.updatedAt)>Number(remote.updatedAt||0);if(localResult)state={...remote,...state,saved:!!remote.saved};else if(localNewer){state={...remote,...state,saved:!!remote.saved,revision:remote.revision};timer=setTimeout(()=>void sync().catch(e=>changed(state,e)),0)}else state={...state,...remote}}else if(remote?.saved)state.saved=true;}persist();return state;}
 function serial(fn){const next=lane.then(fn);lane=next.catch(()=>{});return next;}
 async function ensure(){if(!state.attemptId){const r=await cloud('start');if(r&&validOwner())state.attemptId=r.attemptId;}}
 function sync(){return serial(async()=>{if(!owner||!validOwner()||state.completed)return;await ensure();const snapshot=structuredClone(state);const r=await cloud('progress',{attemptId:state.attemptId,answers:snapshot.answers,question:snapshot.question,revision:snapshot.revision||0});if(r&&validOwner()){state.revision=r.revision;persist();}});}
 return {
  get state(){return state;},load,
  update(answers,question){if(!validOwner()||state.completed)return;state={...state,answers,question,updatedAt:Date.now()};persist();clearTimeout(timer);timer=setTimeout(()=>void sync().catch(e=>changed(state,e)),700);},
  flush(){clearTimeout(timer);return sync();},
  save(saved){return serial(async()=>{await cloud(saved?'save':'unsave');if(validOwner()){state.saved=saved;persist();}});},
  restart(){return serial(async()=>{clearTimeout(timer);const result=await cloud('start',{restart:true});if(!validOwner())return;state={version,answers:Array.from({length:count},()=>[]),question:0,saved:state.saved,completed:false,...(result?{attemptId:result.attemptId}:{})};persist();});},
  submit(){clearTimeout(timer);return serial(async()=>{if(state.completed)return state.result;await ensure();const unanswered=state.answers.some(a=>!a.length);let response;if(unanswered){const filled=state.answers.map(a=>a.length?a:[0]);response=await api().learning({action:'practice',id,answers:filled});if(!Array.isArray(response?.result?.review)||response.result.review.length!==count)throw Error('Could not score this quiz. Please try again.');const review=response.result.review.map((row,i)=>state.answers[i].length?row:{...row,answers:[],correct:false});const correct=review.filter(row=>row.correct).length;response={result:{...response.result,review,correct,total:count,percentage:Math.round(correct*10000/count)/100}}}else response=owner?await cloud('submit',{attemptId:state.attemptId,answers:state.answers,question:state.question}):await api().learning({action:'practice',id,answers:state.answers});if(response&&validOwner()){state={...state,completed:true,result:response.result,...(unanswered&&owner?{localOnlyResult:true}:{})};persist();return state.result;}});},
  dispose(){clearTimeout(timer);}
 };
}
