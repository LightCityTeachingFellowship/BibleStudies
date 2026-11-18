// Owns one verified session for all views. The adapter must verify access with
// the existing backend; stored data and route state never grant membership.
export function createSessionService(adapter) {
 let state={status:'loading',user:null,library:null,error:null}, revision=0, unsubscribe=null, started=false;
 const listeners=new Set();
 const publish=next=>{state=Object.freeze(next);for(const listener of listeners)listener(state);};
 async function apply(user){
  const token=++revision;
  if(!user||user.isAnonymous){publish({status:'public',user:null,library:null,error:null});return;}
  // Revoke a different identity immediately. Reverification of the same
  // account may retain its already verified state until the result arrives.
  if(!['member','authenticated'].includes(state.status)||state.user?.uid!==user.uid||(state.status==='member'&&adapter.hasVerifiedAccess?.(user)===false))publish({status:'verifying',user:null,library:null,error:null});
  try{const result=await adapter.verify(user);if(token!==revision)return;
   if(!Array.isArray(result?.library))throw Error('Member verification returned an invalid library');
   publish({status:'member',user,library:Object.freeze([...result.library]),error:null});
  }catch(error){if(token===revision){const signed=adapter.isCurrent?adapter.isCurrent(user):true;publish({status:signed?'authenticated':'public',user:signed?user:null,library:null,error})}}
 }
 return {
  start(){if(started)return;started=true;unsubscribe=adapter.observe(user=>void apply(user));},
  subscribe(listener){listeners.add(listener);listener(state);return()=>listeners.delete(listener);},
  get state(){return state;},
  async signIn(){return adapter.signIn();},
  async signOut(){++revision;publish({status:'public',user:null,library:null,error:null});return adapter.signOut();},
  destroy(){++revision;unsubscribe?.();listeners.clear();started=false;}
 };
}
