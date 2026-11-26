const button=document.getElementById('studio-report-device-toggle');
const status=document.getElementById('studio-report-device-status');
const api=()=>globalThis.LightCityMembers;
let enabled=false,revision=0;
async function refresh(){
 const ticket=++revision;button.disabled=true;
 try{await api()?.ready;if(!api()?.user?.uid){button.textContent='Sign in to manage alerts';return;}
  const result=await api().manageStudioTest('reports-status');if(ticket!==revision)return;
  enabled=!!result.enabled;button.textContent=enabled?'Turn off on this device':'Turn on for this device';
  status.textContent=enabled?'Stream report alerts are on for this device.':'Stream report alerts are off for this device.';
 }catch(error){if(ticket===revision){button.textContent='Try again';status.textContent=error.message||'Could not check this device.';}}
 finally{if(ticket===revision)button.disabled=false;}
}
button.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='Updating…';
 try{
  if(!enabled){const push=globalThis.LightCityNotificationSettings;if(!push?.getState()?.supported)throw Error('Notifications are unavailable here. On iPhone, open the installed Studio app.');
   const message=await push.enable();if(message)throw Error(message);}
  await api().manageStudioTest(enabled?'reports-disable':'reports-enable');await refresh();
 }catch(error){status.textContent=error.message||'Could not update alerts on this device.';button.disabled=false;}
});
window.addEventListener('lightcity-members-changed',()=>void refresh());
window.addEventListener('lightcity-notification-settings-ready',()=>void refresh());
void refresh();
