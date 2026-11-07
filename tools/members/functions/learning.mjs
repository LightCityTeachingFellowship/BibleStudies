import {randomUUID} from 'node:crypto';
import {requireStudioAdmin} from './studio-publishing.mjs';
import {canonicalVideo,accessFor,eligibleAt,canRelease,resourceId,validateDraft,answersFor,gradeQuiz,publicResource} from './learning-core.mjs';
export function createLearning(deps){
 const {db,auth,fail,legacy=[],now=Date.now}=deps;
 const ref=id=>db.doc('churchVideoActivity/learning/resources/'+id);
 const invalid=message=>{throw new fail('invalid-argument',message);};
 async function videos(){const data=(await db.doc('churchVideoLibrary/current').get()).data();if(!Array.isArray(data?.videos))throw new fail('unavailable','The video library is unavailable.');return data.videos;}
 async function identity(request,required=false){
  if(!request.auth?.uid||request.auth.token?.firebase?.sign_in_provider==='anonymous'){if(required)throw new fail('unauthenticated','Sign in to sync quiz progress.');return null;}
  if(request.data?.accountUid!==request.auth.uid)throw new fail('permission-denied','Your account changed. Please retry.');
  const user=await auth.getUser(request.auth.uid);if(user.disabled||!user.emailVerified||!user.providerData?.length)throw new fail('permission-denied','Use a verified account.');
  return {uid:user.uid||request.auth.uid,name:String(user.displayName||'Participant').slice(0,160),member:(await db.doc('churchMembers/'+request.auth.uid).get()).data()?.active===true};
 }
 async function all(){const rows=[...legacy];let last;do{let query=db.collection('churchVideoActivity/learning/resources').orderBy('__name__').limit(250);if(last)query=query.startAfter(last);const page=await query.get();rows.push(...page.docs.map(doc=>({id:doc.id,...doc.data()})));last=page.docs.length===250?page.docs.at(-1):null;}while(last);return rows;}
 async function get(id){if(!resourceId(id))invalid('Choose a valid resource.');return legacy.find(r=>r.id===id)||(await ref(id).get()).data();}
 async function allowed(id,person){const r=await get(id);if(!r||r.state!=='published')throw new fail('not-found','This resource is not available.');const visibility=accessFor(r,await videos());if(!visibility||visibility==='members'&&!person?.member)throw new fail('permission-denied','Church membership is required for this resource.');return {r,visibility};}
 async function admin(request){if(request.data?.accountUid!==request.auth?.uid)throw new fail('permission-denied','Your account changed.');return requireStudioAdmin(request,deps);}
 async function manage(request){
  const uid=await admin(request),data=request.data||{};
  if(data.action==='list'){const library=await videos(),resources=await all(),jobs=await db.collection('churchVideoActivity/learning/jobs').limit(300).get();return {jobs:jobs.docs.map(d=>({id:d.id,...d.data()})),resources:resources.map(r=>({...r,visibility:accessFor(r,library),eligibleAt:eligibleAt(r,resources.find(s=>s.id===r.summaryId))})),videos:library.map(({id,title,visibility})=>({id,title,visibility})),timings:{summaryHours:3,quizHours:1}};}
  if(data.action==='queue'){
   const video=canonicalVideo(await videos(),data.videoId),end=data.teachingEndedAt;
   if(!video||!['public','members'].includes(video.visibility)||!Number.isSafeInteger(end)||end<946684800000||end>now()+60000)invalid('Choose a published public/member teaching and its actual ending time.');
   const summaryId='summary-'+video.id,quizId='quiz-'+video.id;
   await db.runTransaction(async tx=>{const s=await tx.get(ref(summaryId)),q=await tx.get(ref(quizId));
    if(s.exists||q.exists)throw new fail('already-exists','This teaching already has a review workflow.');
    for(const [id,kind]of [[summaryId,'Summary'],[quizId,'Quiz']])tx.set(ref(id),{id,kind,videoId:video.id,title:video.title,summaryId,teachingEndedAt:end,state:'awaiting-draft',...(kind==='Summary'?{teachingDate:new Date(end+3600000).toISOString().slice(0,10),categories:['Year-'+new Date(end+3600000).getUTCFullYear()]}:{}),version:1,createdAt:now(),createdBy:uid});
    tx.set(db.doc('churchVideoActivity/learning/jobs/'+video.id),{videoId:video.id,state:'queued',createdAt:now(),createdBy:uid});
   });return {summaryId,quizId};
  }
  if(!resourceId(data.id)||legacy.some(r=>r.id===data.id))invalid('Choose a generated draft. Existing quizzes remain public.');
  return db.runTransaction(async tx=>{
   const snapshot=await tx.get(ref(data.id)),r=snapshot.data();if(!r)throw new fail('not-found','Draft not found.');
   if(r.version!==data.version)throw new fail('aborted','This draft changed. Reload before reviewing.');
   if(data.action==='notify'){
    if(r.state!=='published')throw new fail('failed-precondition','Publish this resource before sending a notification.');
    const library=(await tx.get(db.doc('churchVideoLibrary/current'))).data()?.videos||[];
    if(!accessFor(r,library))throw new fail('failed-precondition','The source video is not available.');
    if(['sent','pending'].includes(r.notificationState))return {requested:true,alreadyRequested:true};
    tx.set(ref(data.id),{...r,notificationState:'pending',notificationRequestedAt:now(),notificationRequestedBy:uid});return {requested:true};
   }
   if(r.state==='published')throw new fail('failed-precondition','Published quizzes and summaries are kept unchanged to preserve their history.');
   if(data.action==='publishSilent'){
    try{validateDraft(r);}catch(e){invalid(e.message);}
    const library=(await tx.get(db.doc('churchVideoLibrary/current'))).data()?.videos||[];
    if(!accessFor(r,library))throw new fail('failed-precondition','The source video is not available.');
    if(r.kind==='Quiz'){const summary=(await tx.get(ref(r.summaryId))).data();if(summary?.state!=='published')throw new fail('failed-precondition','Publish the summary first.');}
    tx.set(ref(data.id),{...r,state:'published',approvedAt:now(),approvedBy:uid,publishedAt:now(),notificationState:'held'});return {published:true,notificationsHeld:true};
   }
   if(data.action==='save'){
    let draft;try{draft=validateDraft({...data.draft,kind:r.kind});}catch(e){invalid(e.message);}
    if(Buffer.byteLength(JSON.stringify(draft))>600000)invalid('This draft is too large.');
    tx.set(ref(data.id),{...r,...draft,state:'draft',version:r.version+1,approvedAt:null,updatedAt:now(),updatedBy:uid});return {saved:true};
   }
   if(data.action==='approve'){
    try{validateDraft(r);}catch(e){invalid(e.message);}
    tx.set(ref(data.id),{...r,state:'approved',approvedAt:now(),approvedBy:uid,version:r.version+1});return {approved:true};
   }
   if(data.action==='withdraw'){tx.set(ref(data.id),{...r,state:'draft',approvedAt:null,version:r.version+1});return {withdrawn:true};}
   invalid('Choose Save, Approve, Publish silently, Send notification or Withdraw approval.');
  });
 }
 async function release(){
  const approved=await db.collection('churchVideoActivity/learning/resources').where('state','==','approved').limit(100).get();let count=0;
  for(const item of approved.docs){const r=item.data();const released=await db.runTransaction(async tx=>{
   const [fresh,library,summary]=await Promise.all([tx.get(item.ref),tx.get(db.doc('churchVideoLibrary/current')),r.kind==='Quiz'?tx.get(ref(r.summaryId)):Promise.resolve(null)]);
   const current=fresh.data();if(!current||!accessFor(current,library.data()?.videos||[])||!canRelease(current,summary?.data(),now()))return false;
   tx.set(item.ref,{...current,state:'published',publishedAt:now(),notificationState:'held'});return true;
  });if(released)count++;}return {released:count};
 }
 function renderResource(r,visibility,data){const out=publicResource(r,visibility);if(data.format==='classic'&&r.kind==='Quiz')out.questions=r.questions;return out;}
 async function read(request){const person=await identity(request),data=request.data||{};
  if(data.preview===true){
   await admin(request);
   const r=await get(data.id);if(!r||r.legacy||!['draft','approved','published'].includes(r.state))throw new fail('not-found','This draft is not ready to preview.');
   if(data.action==='practice'){if(r.kind!=='Quiz')invalid('Choose a quiz.');try{return {result:gradeQuiz(r,data.answers),preview:true};}catch(e){invalid(e.message);}}
   return {resource:{...renderResource(r,accessFor(r,await videos())||'members',data),preview:true}};
  }
  if(data.action==='practice'){const {r}=await allowed(data.id,person);if(r.kind!=='Quiz')invalid('Choose a quiz.');try{return {result:gradeQuiz(r,data.answers)};}catch(e){invalid(e.message);}}
  if(data.id){const {r,visibility}=await allowed(data.id,person);return {resource:renderResource(r,visibility,data)};}
  const library=await videos(),resources=await all();return {resources:resources.filter(r=>r.state==='published').flatMap(r=>{const visibility=accessFor(r,library);return visibility&&(visibility==='public'||person?.member)?[publicResource(r,visibility)]:[];}).map(({sections,questions,...r})=>({...r,questionCount:questions?.length||0}))};
 }
 async function activity(request){
  const person=await identity(request,true),data=request.data||{},base='churchVideoActivity/'+person.uid;
  if(data.action==='history'){
   const page=await db.collection(base+'/learningQuizzes').orderBy('updatedAt','desc').limit(100).get(),library=await videos(),resources=await all();
   return {rows:page.docs.flatMap(doc=>{const r=resources.find(r=>r.id===doc.id),visibility=r&&accessFor(r,library);return r&&r.state==='published'&&visibility&&(visibility==='public'||person.member)?[{...doc.data(),resource:publicResource(r,visibility)}]:[];})};
  }
  const {r}=await allowed(data.id,person);if(r.kind!=='Quiz')invalid('Choose a quiz.');
  const activityRef=db.doc(base+'/learningQuizzes/'+r.id);
  if(data.action==='get')return {activity:(await activityRef.get()).data()||null};
  if(data.action==='attempts'){const page=await db.collection(base+'/learningAttempts').orderBy('completedAt','desc').limit(200).get();return {attempts:page.docs.map(d=>d.data()).filter(a=>a.quizId===r.id)};}
  if(['save','unsave'].includes(data.action)){await activityRef.set({saved:data.action==='save',updatedAt:now()},{merge:true});return {saved:data.action==='save'};}
  if(data.action==='start'){
   const id=randomUUID();return db.runTransaction(async tx=>{
    const current=(await tx.get(activityRef)).data();if(current?.attemptId&&!current.completed&&current.version===r.version&&data.restart!==true)return {attemptId:current.attemptId};
    tx.set(activityRef,{saved:current?.saved||false,attemptId:id,version:r.version,answers:r.questions.map(()=>[]),question:0,completed:false,startedAt:now(),updatedAt:now()});
    return {attemptId:id};
   });
  }
  if(!['progress','submit'].includes(data.action)||typeof data.attemptId!=='string'||data.attemptId.length>60)invalid('Invalid quiz action.');
  let answers;try{answers=answersFor(r,data.answers,{complete:data.action==='submit'});}catch(e){invalid(e.message);}
  if(!Number.isInteger(data.question)||data.question<0||data.question>=r.questions.length)invalid('Choose a valid question.');
  return db.runTransaction(async tx=>{
   const snapshot=await tx.get(activityRef),a=snapshot.data();if(!a||a.attemptId!==data.attemptId||a.version!==r.version)throw new fail('aborted','This attempt changed on another device. Reload to continue.');
   if(a.completed){if(data.action==='submit')return {result:a.result};throw new fail('failed-precondition','This attempt is complete.');}
   if(data.action==='progress'){if(data.revision!==a.revision&&a.revision!==undefined)throw new fail('aborted','Progress changed on another device. Reload to continue.');const revision=(a.revision||0)+1;tx.set(activityRef,{...a,answers,question:data.question,revision,updatedAt:now()});return {revision};}
   const result=gradeQuiz(r,answers),attemptRef=db.doc(base+'/learningAttempts/'+a.attemptId),scoreRef=db.doc('churchVideoActivity/learningScores/quizzes/'+r.id+'/people/'+person.uid),score=(await tx.get(scoreRef)).data();
   const attempt={quizId:r.id,title:r.title,version:r.version,attemptId:a.attemptId,startedAt:a.startedAt,completedAt:now(),...result};
   tx.set(attemptRef,attempt);tx.set(activityRef,{...a,answers,completed:true,result,updatedAt:now()});
   tx.set(scoreRef,{uid:person.uid,name:person.name,firstPercentage:score?.firstPercentage??result.percentage,bestPercentage:Math.max(score?.bestPercentage||0,result.percentage),attempts:(score?.attempts||0)+1,lastCompletedAt:now()});
   return {result};
  });
 }
 async function leaderboard(request){await admin(request);const data=request.data||{};if(!resourceId(data.id))invalid('Choose a quiz.');const page=await db.collection('churchVideoActivity/learningScores/quizzes/'+data.id+'/people').orderBy('firstPercentage','desc').limit(200).get();return {rows:page.docs.map(d=>d.data()),limit:200};}
 return {manage,release,read,activity,leaderboard,all};
}
