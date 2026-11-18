// Page views share one request per resource and session. Member data stays in
// memory and is discarded immediately when the verified identity changes.
export function createResourceStore({load,clock=()=>Date.now(),ttl=60000}){
 let scope='public',generation=0;const cache=new Map(),pending=new Map();
 function setScope(value){const next=String(value||'public');if(next===scope)return;scope=next;++generation;cache.clear();pending.clear();}
 async function get(key,{refresh=false}={}){
  const id=String(key),old=cache.get(id),now=clock();
  if(!refresh&&old&&now-old.at<ttl)return old.value;
  if(pending.has(id))return pending.get(id);
  const token=generation,owner=scope;
  const task=Promise.resolve().then(()=>load(id,{scope:owner})).then(value=>{
   if(token!==generation)throw Object.assign(Error('Session changed'),{name:'AbortError'});
   cache.set(id,{value,at:clock()});return value;
  }).finally(()=>{if(pending.get(id)===task)pending.delete(id)});
  pending.set(id,task);return task;
 }
 return {get,setScope,clear(){++generation;cache.clear();pending.clear()},get scope(){return scope}};
}
