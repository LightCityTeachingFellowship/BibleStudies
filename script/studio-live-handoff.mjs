// Desktop-only bridge: no clipboard monitoring, publishing or audience changes.
const desktop=window.LightCityDesktop,input=document.getElementById('admin-quick'),form=document.getElementById('admin-quick-form');
if(desktop?.getLiveBroadcast&&input&&form){
 const banner=document.createElement('p'),use=document.createElement('button'),message=document.createElement('span');banner.setAttribute('role','status');use.type='button';use.textContent='Use detected stream';banner.hidden=true;banner.append(message,use);form.after(banner);let last=null,pending=null,polling=false;
 function fill(){if(!pending)return;input.value=pending.url;input.dispatchEvent(new Event('input',{bubbles:true}));message.textContent='Livestream link filled in. Choose the audience, then Publish. ';use.hidden=true;}
 use.onclick=fill;
 async function poll(){if(polling)return;const api=window.LightCityMembers;if(!api?.user||document.getElementById('admin-content')?.hidden)return;polling=true;try{const b=await desktop.getLiveBroadcast();if(!b){pending=null;banner.hidden=true;return;}if(b.session===last)return;last=b.session;pending=b;banner.hidden=false;message.textContent='Livestream detected. ';use.hidden=false;if(!input.value.trim()&&!document.getElementById('admin-publish')?.disabled)fill();}catch{}finally{polling=false;}}
 const timer=setInterval(()=>void poll(),5000);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});window.addEventListener('lightcity-members-changed',()=>{last=null;pending=null;banner.hidden=true;void poll();});void poll();
}
