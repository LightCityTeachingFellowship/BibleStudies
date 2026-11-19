// Reuse the existing on-device study store and server API; account switches
// invalidate pending work so one member's data cannot enter another account.
export function createStudyService({createStore,resourcePath,resourceId,storage,api,session,events}){
 const store=createStore({storage,changed:()=>events.dispatchEvent(new Event('lightcity-study-changed'))});
 let generation=0,flushing=false,flushAgain=false,disposed=false;
 async function flush(){if(disposed||!store.signedIn||!api.updateReadingActivity)return;if(flushing){flushAgain=true;return}flushing=true;const owner=store.scope,token=generation;
  try{for(const [key,op] of store.pending()){if(disposed||token!==generation||store.scope!==owner)break;let result;do{result=await api.updateReadingActivity({...op,accountUid:owner.slice(5)});}while(op.action==='clearHistory'&&result?.more&&token===generation);if(token===generation&&store.scope===owner)store.acknowledge(key,op)}}catch{}finally{flushing=false;if(flushAgain&&!disposed){flushAgain=false;queueMicrotask(()=>void flush())}}}
 async function hydrate(token){const owner=store.scope;if(!store.signedIn||!api.getReadingActivity)return;await flush();
  try{for(const view of ['saved','history']){let cursor=null,pages=0,rows=[];do{const result=await api.getReadingActivity({view,accountUid:owner.slice(5),...(cursor?{cursor}:{})});if(disposed||token!==generation||store.scope!==owner)return;if(!Array.isArray(result.rows))throw Error('Invalid study data');rows.push(...result.rows);cursor=result.cursor;pages++}while(cursor&&pages<50);if(token===generation&&store.scope===owner)store.hydrate(view,rows)}}catch{}}
 const unsubscribe=session.subscribe(state=>{const uid=state.user&&!state.user.isAnonymous?state.user.uid:null;const desired=uid?'user:'+uid:'device';if(store.scope===desired)return;++generation;store.setIdentity(uid);void hydrate(generation)});
 const online=()=>void flush();events.addEventListener('online',online);const retry=setInterval(()=>void flush(),30000);retry.unref?.();
 return {async idFor(url){const path=resourcePath(url,events.location.origin);if(!path)throw Error('Invalid publication');return resourceId(path)},get store(){return store},save(id,wanted){store.save(id,wanted);void flush()},progress(row){store.progress(row);void flush()},flush,destroy(){disposed=true;++generation;unsubscribe();clearInterval(retry);events.removeEventListener('online',online)}};
}
