const api=()=>globalThis.LightCityMembers;
await api()?.ready;
let returning=false;try{returning=localStorage.getItem('lc-returning-member')==='1';}catch{}
if(returning&&!api()?.user&&!document.getElementById('member-page')&&!location.pathname.startsWith('/Admin/')){
 const box=document.createElement('section'),text=document.createElement('p'),signin=document.createElement('button'),later=document.createElement('button');box.className='lc-member-return';text.textContent='Welcome back. Sign in again to restore your church access, saved items and history.';signin.type=later.type='button';signin.textContent='Sign in with Google';later.textContent='Not now';box.append(text,signin,later);// Keep the prompt in the first visible content area, including the homepage grid.
 const welcome=document.querySelector('.home-welcome');
 (welcome||document.querySelector('main')||document.body).prepend(box);
 box.setAttribute('aria-label','Welcome back');
 signin.onclick=async()=>{signin.disabled=true;try{await api().signInForVideos();box.remove();}catch(error){text.textContent=error.message||'Sign-in did not finish. Please try again.';signin.disabled=false;}};later.onclick=()=>box.remove();window.addEventListener('lightcity-members-changed',()=>{if(api()?.user)box.remove();});
}
