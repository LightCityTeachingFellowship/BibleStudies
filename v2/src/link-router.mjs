// Route supported incoming website links through the shared application.
// Unsupported features keep their existing website behavior.
export function createLinkRouter({window,router,player,api,resources,session,onError=()=>{}}){
 let incomingRevision=0,legacyIndex;
 async function legacyMatch(target){legacyIndex??=fetch('/legacy-app-pages.json').then(r=>{if(!r.ok)throw Error('Bible study index unavailable');return r.json()}).catch(error=>{legacyIndex=null;throw error});const data=await legacyIndex;return Array.isArray(data.pages)&&data.pages.some(item=>{try{return new URL(item.url,window.location.origin).pathname.toLowerCase()===target.pathname.toLowerCase()}catch{return false}})}
 function openLegacy(target,original){void legacyMatch(target).then(found=>{if(window.location.href!==original)return;if(found)return router.navigate('/v2/legacy/?url='+encodeURIComponent(target.pathname)+target.hash);window.location.assign(target.href)}).catch(()=>{if(window.location.href===original)window.location.assign(target.href)})}

 const sections=new Map([['/home/','/v2/'],['/videos/','/v2/videos/'],['/listen/','/v2/audio/'],['/teaching-articles/','/v2/articles/'],['/teaching-summary/','/v2/summaries/'],['/mylibrary/','/v2/library/'],['/myvideos/','/v2/library/'],['/study-resources/','/v2/categories/?kind=Article'],['/categories/','/v2/categories/?kind=Summary'],['/bible-quiz/','/v2/quizzes/'],['/bible%20quiz/','/v2/quizzes/'],['/about-us/','/v2/info/?page=about'],['/about/','/v2/info/?page=about'],['/join-us/','/v2/info/?page=meeting'],['/doctrines/','/v2/info/?page=doctrines']]);
 async function waitForSession(){await api.ready;if(!session)return;const ready=state=>{const user=api.user&&!api.user.isAnonymous?api.user:null;if(user)return ['member','authenticated'].includes(state.status)&&state.user?.uid===user.uid;return state.status==='public'};if(ready(session.state))return;await new Promise((resolve,reject)=>{let unsubscribe=()=>{},finished=false;const timeout=setTimeout(()=>{if(finished)return;finished=true;unsubscribe();reject(Error('Account restoration timed out'))},30000);const finish=()=>{if(finished)return;finished=true;clearTimeout(timeout);unsubscribe();resolve()};unsubscribe=session.subscribe(state=>{if(ready(state))finish()});if(finished)unsubscribe()})}
 function open(input){let target;try{target=new URL(input,window.location.href)}catch{return false}
  if(target.origin!==window.location.origin||!['http:','https:'].includes(target.protocol)||target.username||target.password)return false;
  const path=target.pathname.toLowerCase().replace(/\/?$/,'/');
  if(router.matches(target)){void router.navigate(target);return true}
  if(path==='/listen/'&&target.searchParams.has('archive')){
   const id=target.searchParams.get('archive');if(!/^[a-f0-9]{32}$/.test(id||''))return false;const original=window.location.href;
   void resources.get('archive').then(rows=>{if(window.location.href!==original)return false;const row=rows.find(item=>item.id===id);if(!row)throw Error('Recording unavailable');return player.open({id,title:row.title,kind:'archive',mode:'audio'})}).then(opened=>{if(opened&&window.location.href===original)return router.navigate('/v2/watch/')}).catch(onError);return true;
  }
  if(path==='/calendar/'){void router.navigate('/v2/calendar/'+target.search+target.hash);return true}
  if(path==='/categories/'&&/^#[a-z0-9-]+$/i.test(target.hash)){void router.navigate('/v2/categories/?kind=Summary&name='+encodeURIComponent(target.hash.slice(1)));return true}
  if(sections.has(path)){void router.navigate(sections.get(path));return true}
  if(/^\/quizquestions-(adult|children|trivia)\//i.test(target.pathname)){
   if(/\/a0-home-|\/triviaquestions\.html$/i.test(target.pathname)){void router.navigate('/v2/quizzes/');return true}
   const original=window.location.href;void Promise.resolve(api.ready).then(()=>api.learning({})).then(result=>{if(window.location.href!==original)return;const quiz=(result.resources||[]).find(item=>{try{return item.kind==='Quiz'&&new URL(item.url,window.location.origin).pathname.toLowerCase()===target.pathname.toLowerCase()}catch{return false}});if(quiz&&/^[a-zA-Z0-9_-]{1,100}$/.test(quiz.id||''))return router.navigate('/v2/quiz/?id='+encodeURIComponent(quiz.id));window.location.assign(target.href)}).catch(()=>{if(window.location.href===original)window.location.assign(target.href)});return true;
  }
  if(path==='/teachingquiz/'&&/^[a-zA-Z0-9_-]{1,100}$/.test(target.searchParams.get('id')||'')){void router.navigate('/v2/quiz/'+target.search);return true}
  if(path==='/watch/'){
   const id=target.searchParams.get('v');if(!/^[A-Za-z0-9_-]{11}$/.test(id||''))return false;
   const ticket=++incomingRevision,raw=target.searchParams.get('t'),parsed=raw===null?null:Number(raw),startSeconds=Number.isFinite(parsed)&&parsed>=0&&parsed<=172800?parsed:null;
   const watchURL=new URL('/v2/watch/',window.location.href).href;
   const viewReady=router.currentURL===watchURL?Promise.resolve(true):router.navigate(watchURL);
   void Promise.all([viewReady,waitForSession()]).then(([ready])=>{if(!ready||ticket!==incomingRevision||window.location.href!==watchURL)return false;const row=[...(api.library||[]),...(api.publicLibrary||[])].find(item=>item.id===id);return player.open({id,title:row?.title||'LightCity video',mode:target.searchParams.get('mode')==='audio'?'audio':'video',startSeconds})}).catch(onError);return true;
  }
  if(/^\/biblenodesgraph\/[^/]+\.html$/i.test(target.pathname)){openLegacy(target,window.location.href);return true}
  if(/^\/(?:admin|members|share|api|__|logout|signout)(?:\/|$)/i.test(target.pathname)||/\.[a-z0-9]{1,8}$/i.test(target.pathname))return false;
  const original=window.location.href;
  void resources.get('publications').then(async catalogue=>{if(window.location.href!==original)return;const has=()=>(catalogue.publications||[]).some(row=>{try{const candidate=new URL(row.url,window.location.origin);return candidate.pathname===target.pathname&&candidate.search===target.search}catch{return false}});let found=has();if(!found&&catalogue.memberReady){await catalogue.memberReady;if(window.location.href!==original)return;found=has()}if(found)return router.navigate('/v2/read/?url='+encodeURIComponent(target.pathname+target.search));openLegacy(target,original)}).catch(()=>{if(window.location.href===original)window.location.assign(target.href)});
  return true;
 }
 return {open};
}
