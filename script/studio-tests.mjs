import {setupStreamIssueForm} from './stream-issues.mjs?v=no-sound-1';
export function setupStudioTests({document,window,api,status}){
 const panel=document.getElementById('admin-test-preview');
 if(!panel)return;
 let version=0;
 const feedback=setupStreamIssueForm({document,window,api,privateTest:true});
 async function preview(){
  const current=++version;panel.hidden=true;document.getElementById('admin-test-frame').replaceChildren();feedback?.availability();
  const id=new URL(window.location.href).searchParams.get('test');
  if(!/^[\w-]{11}$/.test(id||'')||!api()?.user?.uid)return;
  const uid=api().user.uid;
  try{const row=await api().getStudioPublication({videoId:id,visibility:'test'});if(current!==version||api()?.user?.uid!==uid)return;
   document.getElementById('admin-test-title').textContent=row.title;
   const frame=document.createElement('iframe');frame.title=row.title;frame.src='https://www.youtube-nocookie.com/embed/'+id+'?playsinline=1&rel=0';frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';document.getElementById('admin-test-frame').appendChild(frame);panel.hidden=false;feedback?.availability();
  }catch(error){if(current===version&&api()?.user?.uid===uid)status(error?.message||'Sign in with the admin account that created this private test.');}
 }
 for(const [id,action] of [['admin-test-register','register'],['admin-test-unregister','unregister']]){
  document.getElementById(id)?.addEventListener('click',async event=>{
   const button=event.currentTarget,uid=api()?.user?.uid;button.disabled=true;
   try{await api().manageStudioTest(action);if(api()?.user?.uid===uid)status(action==='register'?'This device is registered for your private test alerts. Repeat on your other device.':'This device will no longer receive private test alerts.');}
   catch(error){if(api()?.user?.uid===uid)status(error?.message||'The device could not be updated.');}finally{button.disabled=false;}
  });
 }
 window.addEventListener('lightcity-members-changed',()=>void preview());
 void Promise.resolve(api()?.ready).then(preview);
}
