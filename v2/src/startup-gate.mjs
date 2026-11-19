// Cold-start gate: a resumed page is already past this one-time gate.
export function installStartupGate({document,window,session,api,applicationReady}){
 const overlay=document.getElementById('app-startup'),message=document.getElementById('app-startup-message'),spinner=document.getElementById('app-startup-spinner'),retry=document.getElementById('app-startup-retry');
 if(!overlay)return()=>{};let done=false,revision=0,unsubscribe=()=>{};
 retry.onclick=()=>window.location.reload();
 const changed=state=>{if(done)return;const ticket=++revision;if(state.status==='loading'||state.status==='verifying'){message.textContent='Preparing your library…';spinner.hidden=false;retry.hidden=true;return}if(state.status==='authenticated'||api.error){message.textContent='We could not confirm your account access. Check your connection and try again.';spinner.hidden=true;retry.hidden=false;return}if(state.status!=='member'&&state.status!=='public')return;message.textContent='Preparing your library…';spinner.hidden=false;retry.hidden=true;Promise.resolve(applicationReady).then(()=>new Promise(resolve=>window.requestAnimationFrame(()=>window.requestAnimationFrame(resolve)))).then(()=>{if(done||ticket!==revision||api.error)return;done=true;overlay.hidden=true;unsubscribe()}).catch(()=>{if(done||ticket!==revision)return;message.textContent='The app could not finish loading. Please try again.';spinner.hidden=true;retry.hidden=false})};
 unsubscribe=session.subscribe(changed);return()=>{done=true;unsubscribe();retry.onclick=null};
}
