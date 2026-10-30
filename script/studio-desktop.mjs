// The phone uses the same Studio. Only a Windows-initiated connection opens the approval panel.
export function setupDesktopStudio({document,window,api=()=>globalThis.LightCityMembers}){
 const desktop=window.LightCityDesktop,status=document.getElementById('admin-status'),top=document.querySelector('.studio-top');
 if(!top)return;
 const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b;};
 if(desktop){
  document.getElementById('admin-install')?.remove();
  top.append(button('Alerts',()=>void desktop.showAlerts()),button('Desktop settings',()=>void desktop.openSettings()));
  desktop.onConnectionCode?.(value=>{status.textContent='Approve connection '+value.code+' in your browser.';});
  desktop.onHandle(async({id,uid})=>{
   if(uid!==api()?.user?.uid)return;
   try{await api().resolveStreamReport(id);if(uid!==api()?.user?.uid)return;await desktop.acknowledgeResult({id,uid,ok:true});window.dispatchEvent(new Event('lightcity-stream-reports-changed'));}
   catch{if(uid===api()?.user?.uid)await desktop.acknowledgeResult({id,uid,ok:false,message:'Could not update the shared report. Check your connection and retry.'});}
  });
  return;
 }
 const url=new URL(window.location.href),id=url.searchParams.get('desktopSession'),challenge=url.searchParams.get('desktopChallenge');
 if(!/^[a-f0-9]{32}$/.test(id||'')||!/^[a-f0-9]{64}$/.test(challenge||''))return;
 url.searchParams.delete('desktopSession');url.searchParams.delete('desktopChallenge');window.history.replaceState(null,'',url.href);
 const panel=document.createElement('section');panel.className='studio-panel';panel.setAttribute('aria-label','Connect Windows Studio');
 const title=document.createElement('h2');title.textContent='Connect LightCity Studio for Windows';
 const code=document.createElement('p');code.textContent='Connection code: '+id.slice(0,4).toUpperCase()+'-'+id.slice(4,8).toUpperCase();
 const text=document.createElement('p');text.textContent='Approve only if you just started sign-in in your Windows Studio app and this code matches. Use your admin Google account.';
 const message=document.createElement('p');message.setAttribute('role','status');
 const approve=button('Approve Windows connection',async()=>{
  approve.disabled=true;message.textContent='Checking your admin account…';
  try{await api()?.ready;if(!api()?.user||api().user.isAnonymous)await api().signInForVideos();await api().connectStudioDesktop({action:'approve',id,challenge});message.textContent='Connected. Return to the Windows Studio app.';approve.textContent='Approved';}
  catch(error){message.textContent=error?.message||'Could not approve the connection. Start again from Windows.';approve.disabled=false;}
 });approve.className='primary';panel.append(title,code,text,approve,button('Cancel',()=>panel.remove()),message);document.querySelector('.studio-main')?.prepend(panel);
}
if(typeof document!=='undefined')setupDesktopStudio({document,window});
