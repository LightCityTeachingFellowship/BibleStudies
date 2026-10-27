const valid=id=>/^[\w-]{11}$/.test(id||'');
const paths={public:'_includes/video-ids-public.txt',members:'_includes/video-ids-members.txt'};
export function parseIds(text){const ids=String(text).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(ids.some(id=>!valid(id))||new Set(ids).size!==ids.length)throw Error('The video list needs review before publishing.');return ids;}
export function planAddition(lists,id,visibility){
 if(!valid(id)||!Object.hasOwn(paths,visibility))throw Error('Choose a valid video ID and audience.');
 const other=visibility==='public'?'members':'public';
 if(lists[other].includes(id))throw Error('This video already belongs to the other audience. Review its access before moving it.');
 if(lists[visibility].includes(id))return null;
 return {path:paths[visibility],content:[id,...lists[visibility]].join('\n')+'\n'};
}
export function githubPublisher({token,send=fetch}){
 const base='https://api.github.com/repos/LightCityTeachingFellowship/BibleStudies';
 async function request(path,method='GET',body){
  const response=await send(base+path,{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token(),'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok){await response.body?.cancel();const error=Error(response.status===401||response.status===403?'Studio cannot access GitHub. Check its publishing connection.':'GitHub publishing is temporarily unavailable.');error.status=response.status;throw error;}return response.status===204?null:response.json();
 }
 async function snapshot(){
  const ref=await request('/git/ref/heads/master'),sha=ref.object.sha;
  const [commit,...files]=await Promise.all([request('/git/commits/'+sha),...Object.values(paths).map(path=>request('/contents/'+path+'?ref='+sha))]);
  return {sha,tree:commit.tree.sha,lists:Object.fromEntries(Object.keys(paths).map((key,i)=>[key,parseIds(Buffer.from(files[i].content,'base64').toString('utf8'))]))};
 }
 return {snapshot,async add(id,visibility){
  for(let attempt=0;attempt<3;attempt++){
   const current=await snapshot(),change=planAddition(current.lists,id,visibility);if(!change)return {sha:current.sha,existing:true};
   const tree=await request('/git/trees','POST',{base_tree:current.tree,tree:[{path:change.path,mode:'100644',type:'blob',content:change.content}]});
   const commit=await request('/git/commits','POST',{message:'Studio: add '+visibility+' video '+id,tree:tree.sha,parents:[current.sha]});
   try{await request('/git/refs/heads/master','PATCH',{sha:commit.sha,force:false});return {sha:commit.sha,existing:false};}
   catch(error){if(error.status!==422||attempt===2)throw error;}
  }
 }};
}
export async function requireStudioAdmin(request,{auth,emails,fail}){
 const uid=request.auth?.uid;if(!uid)throw new fail('unauthenticated','Sign in with your admin account.');
 if(request.data?.accountUid&&request.data.accountUid!==uid)throw new fail('permission-denied','The account changed. Sign in again.');
 const user=await auth.getUser(uid),allowed=new Set(String(emails()).split(/[,;\s]+/).map(s=>s.toLowerCase()).filter(Boolean));
 if(user.disabled||!user.emailVerified||!user.providerData?.length||!allowed.has(String(user.email||'').toLowerCase()))throw new fail('permission-denied','This account does not have admin access.');
 return uid;
}
export function createStudioPublishing(deps){
 const {fail,github,db,send=fetch}=deps;
 return {
 async publish(request){
  const uid=await requireStudioAdmin(request,deps),{videoId,visibility}=request.data||{};
  if(!valid(videoId)||!['public','members'].includes(visibility))throw new fail('invalid-argument','Enter a valid video ID and choose its audience.');
  try{const result=await github.add(videoId,visibility);await db.doc('churchStudioPublications/'+videoId).set({videoId,visibility,sha:result.sha,requestedBy:uid,requestedAt:Date.now()});return {videoId,visibility,sha:result.sha,state:'publishing'};}
  catch(error){throw new fail('failed-precondition',error.status?'The GitHub publishing connection needs attention. Please retry after checking setup.':error.message);}
 },
 async status(request){
  await requireStudioAdmin(request,deps);const {videoId,visibility}=request.data||{};
  if(!valid(videoId)||!['public','members'].includes(visibility))throw new fail('invalid-argument','Invalid publication.');
  const published=await db.doc('churchVideoLibrary/current').get();
  const row=published.exists&&published.data()?.videos?.find(v=>v.id===videoId&&v.visibility===visibility);
  if(!row)return {state:'publishing',message:'Waiting for the website to publish. Recorded videos also wait for their matching audio.'};
  const url='https://lightcityfellowship.com/Share/Video/'+videoId+'/';
  try{
   const response=await send(url,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Cache-Control':'no-cache'}});
   if(!response.ok){await response.body?.cancel();return {state:'publishing',message:'The share page is still being published.'};}
   const html=await response.text();if(!html.includes('property="og:title"')||!html.includes('/Watch/?v='+videoId))return {state:'publishing',message:'Waiting for the finished share page.'};
   return {state:'ready',url,title:row.title||'LightCity video'};
  }catch{return {state:'publishing',message:'Checking the published share page…'};}
 }
 };
}