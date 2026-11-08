import {streamId} from './admin-core.mjs?v=previews-1';
export function setupStudioPublisher({document,window,navigator,api,status}){
 const get=id=>document.getElementById(id),form=get('admin-quick-form');if(!get('admin-audience'))return false;
 let timer=null,job=null,busy=false,context=null,sequence=0,submitting=null;
 const replaceDialog=get('admin-replace-dialog'),replaceForm=get('admin-replace-form'),replaceInput=get('admin-replace-input'),replaceStatus=get('admin-replace-status'),replaceSubmit=get('admin-replace-submit');
 let replacing=null;
 const storage=()=>{try{return window.localStorage;}catch{return null;}};
 function remember(){try{if(job)storage()?.setItem('lc-studio-publish',JSON.stringify(job));else storage()?.removeItem('lc-studio-publish');}catch{}}
 function stop(){clearTimeout(timer);timer=null;}
 const owned=()=>job&&api()?.user?.uid===job.uid;
 async function copy(){const url=get('admin-quick-link').value;if(!url)return;try{await navigator.clipboard.writeText(url);status('Ready link copied.');}catch{get('admin-quick-link').focus();get('admin-quick-link').select();status('Select and copy the ready link.');}}
 function chime(){try{if(!context||context.state!=='running')return;for(const [delay,freq]of [[0,660],[.2,880]]){const oscillator=context.createOscillator(),gain=context.createGain();oscillator.connect(gain);gain.connect(context.destination);oscillator.frequency.value=freq;gain.gain.setValueAtTime(.08,context.currentTime+delay);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+delay+.3);oscillator.start(context.currentTime+delay);oscillator.stop(context.currentTime+delay+.3);}}catch{}}
 async function alertReady(item,publication,ticket){
  if(window.LightCityDesktop)await window.LightCityDesktop.linkReady({uid:publication.uid,title:item.title,url:item.url});else chime();
  if(ticket!==sequence||api()?.user?.uid!==publication.uid)return;
  const heading=get('admin-ready-heading');if(heading)heading.textContent=publication.visibility==='test'?'Private test ready':'Ready to share!';const dialog=get('admin-ready-dialog');get('admin-ready-title').textContent=item.title;get('admin-ready-url').value=item.url;
  if(dialog?.showModal&&!dialog.open)dialog.showModal();
  if(!window.LightCityDesktop&&window.Notification?.permission==='granted'){
   try{const registration=await navigator.serviceWorker?.getRegistration('/');if(registration&&ticket===sequence&&api()?.user?.uid===publication.uid)await registration.showNotification('LightCity link ready',{body:item.title,tag:'studio-ready-'+publication.videoId,icon:'/images/icon-192.png',silent:false,data:{lightcity:true,url:'/Admin/'}});}catch{}
  }
 }
 async function check(){
  stop();if(!owned())return;const current=sequence;
  try{const result=await api().getStudioPublication({videoId:job.videoId,visibility:job.visibility});if(current!==sequence||!owned())return;
   if(result.state==='removed'){status(result.message||'This video was removed from LightCity.');job=null;remember();busy=false;get('admin-publish').disabled=false;return;}
   if(result.state==='ready'){
    // Keep a newly typed next video, but clear the completed publication.
    if(streamId(get('admin-quick').value)===job.videoId){get('admin-quick').value='';if(get('admin-notify-viewers'))get('admin-notify-viewers').checked=true;}
    try{storage()?.setItem('lc-studio-published-'+job.uid,job.videoId);}catch{}
    window.dispatchEvent(new window.CustomEvent('lightcity-studio-published',{detail:{videoId:job.videoId}}));
    get('admin-quick-link').value=result.url;get('admin-quick-result').hidden=false;status(job.visibility==='test'?'Private test ready. Alerts were sent only to your registered test devices.':job.notifyViewers===false||job.replaceVideoId?'Published without notifying viewers. Ready to share: '+result.title:'Ready to share: '+result.title);busy=false;get('admin-publish').disabled=false;
    const completed=job;job=null;remember();await alertReady(result,completed,current);return;
   }
   status(result.message||'Publishing your video…');
  }catch(error){if(current!==sequence||!owned())return;status(error?.code==='functions/not-found'?'Studio publishing needs its one-time setup and deployment.':'Unable to confirm publication yet. Checking again…');}
  if(owned())timer=setTimeout(()=>void check(),5000);
 }
 function restore(){
  if(submitting&&submitting.uid!==api()?.user?.uid){sequence++;submitting=null;busy=false;get('admin-publish').disabled=false;}
  if(replacing&&replacing.uid!==api()?.user?.uid){replaceDialog?.close();replacing=null;replaceInput.value='';replaceStatus.textContent='';}
  if(!api()?.user?.uid){sequence++;stop();job=null;busy=false;get('admin-publish').disabled=false;get('admin-ready-dialog')?.close?.();return;}
  if(job&&!owned()){sequence++;stop();job=null;busy=false;get('admin-publish').disabled=false;get('admin-ready-dialog')?.close?.();}
  if(job||!api()?.user?.uid)return;
  try{const saved=JSON.parse(storage()?.getItem('lc-studio-publish')||'null');if(saved?.uid===api().user.uid&&streamId(saved.videoId)&&['public','members','test'].includes(saved.visibility)){job=saved;busy=true;get('admin-publish').disabled=true;void check();}}catch{}
 }
 async function publish({videoId,visibility,replaceVideoId,notifyViewers=true}){
  if(busy){status('A publication is already being prepared. Wait for its ready link.');return false;}const uid=api()?.user?.uid;
  if(!videoId||!uid){status('Sign in and enter a valid YouTube link or ID.');return;}
  // Obtain notification/audio permissions from the user's Publish click, before waiting.
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){context||=new Audio();void context.resume();}}catch{}
  if(!window.LightCityDesktop&&window.Notification?.permission==='default')void window.Notification.requestPermission().catch(()=>{});
  const current=++sequence,attempt={uid};submitting=attempt;
  busy=true;get('admin-publish').disabled=true;get('admin-quick-result').hidden=true;status(replaceVideoId?'Preparing the replacement…':visibility==='test'?'Preparing a private test for your registered devices…':'Adding the video to your '+visibility+' list…');
  try{await api().publishStudioVideo({videoId,visibility,direct:true,...(!notifyViewers?{notifyViewers:false}:{}),...(replaceVideoId?{replaceVideoId}:{})});if(current!==sequence||api()?.user?.uid!==uid)return false;
   job={videoId,visibility,uid,notifyViewers,...(replaceVideoId?{replaceVideoId}:{})};remember();status(replaceVideoId?'Replacement saved. Checking that video and audio are ready…':visibility==='test'?'Test alert sent. Preparing your private preview…':'Saved. Checking that video and audio are ready…');void check();return true;
  }catch(error){
   if(current!==sequence||api()?.user?.uid!==uid)return false;
   const message=error?.message||'Publication could not start. Please retry.';status(message);if(replaceVideoId&&replaceDialog?.open)replaceStatus.textContent=message;busy=false;get('admin-publish').disabled=false;return false;
  }finally{if(submitting===attempt)submitting=null;}
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();await publish({videoId:streamId(get('admin-quick').value),visibility:get('admin-audience').value,notifyViewers:get('admin-audience').value==='test'||get('admin-notify-viewers')?.checked!==false});
 });
 if(replaceDialog&&replaceForm){
  window.addEventListener('lightcity-studio-replace',event=>{
   if(busy){status('A publication is already being prepared. Wait for its ready link.');return;}
   const item=event.detail,uid=api()?.user?.uid;
   if(!uid||!streamId(item?.videoId)||!['public','members'].includes(item.visibility))return;
   replacing={...item,uid};get('admin-replace-title').textContent=item.title;get('admin-replace-audience').textContent=item.visibility==='members'?'Church members':'Everyone (public)';
   replaceInput.value='';replaceStatus.textContent='';replaceSubmit.disabled=false;
   if(!replaceDialog.open)replaceDialog.showModal();replaceInput.focus();
  });
  get('admin-replace-cancel').addEventListener('click',()=>replaceDialog.close());
  replaceDialog.addEventListener('close',()=>{replacing=null;replaceInput.value='';replaceStatus.textContent='';});
  replaceForm.addEventListener('submit',async event=>{
   event.preventDefault();const target=replacing,videoId=streamId(replaceInput.value);
   if(!target||target.uid!==api()?.user?.uid||replaceSubmit.disabled)return;
   if(!videoId||videoId===target.videoId){replaceStatus.textContent=videoId?'Enter a different video to use as the replacement.':'Enter a valid YouTube link or 11-character video ID.';replaceInput.focus();return;}
   replaceSubmit.disabled=true;replaceStatus.textContent='Preparing the replacement…';
   try{if(await publish({videoId,visibility:target.visibility,replaceVideoId:target.videoId}))replaceDialog.close();}
   finally{if(!replacing||replacing===target)replaceSubmit.disabled=false;}
  });
 }
 get('admin-quick-copy').addEventListener('click',()=>void copy());
 get('admin-ready-copy').addEventListener('click',()=>{get('admin-quick-link').value=get('admin-ready-url').value;void copy();});
 get('admin-ready-close').addEventListener('click',()=>get('admin-ready-dialog').close());
 window.addEventListener('lightcity-members-changed',restore);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&owned())void check();});
 void Promise.resolve(api()?.ready).then(restore);return true;
}
