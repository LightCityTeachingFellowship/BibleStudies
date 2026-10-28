import {streamId} from './admin-core.mjs?v=previews-1';
export function setupStudioPublisher({document,window,navigator,api,status}){
 const get=id=>document.getElementById(id),form=get('admin-quick-form');if(!get('admin-audience'))return false;
 let timer=null,job=null,busy=false,context=null,sequence=0;
 const storage=()=>{try{return window.localStorage;}catch{return null;}};
 function remember(){try{if(job)storage()?.setItem('lc-studio-publish',JSON.stringify(job));else storage()?.removeItem('lc-studio-publish');}catch{}}
 function stop(){clearTimeout(timer);timer=null;}
 const owned=()=>job&&api()?.user?.uid===job.uid;
 async function copy(){const url=get('admin-quick-link').value;if(!url)return;try{await navigator.clipboard.writeText(url);status('Ready link copied.');}catch{get('admin-quick-link').focus();get('admin-quick-link').select();status('Select and copy the ready link.');}}
 function chime(){try{if(!context||context.state!=='running')return;for(const [delay,freq]of [[0,660],[.2,880]]){const oscillator=context.createOscillator(),gain=context.createGain();oscillator.connect(gain);gain.connect(context.destination);oscillator.frequency.value=freq;gain.gain.setValueAtTime(.08,context.currentTime+delay);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+delay+.3);oscillator.start(context.currentTime+delay);oscillator.stop(context.currentTime+delay+.3);}}catch{}}
 async function alertReady(item){
  chime();const heading=get('admin-ready-heading');if(heading)heading.textContent=job.visibility==='test'?'Private test ready':'Ready to share!';const dialog=get('admin-ready-dialog');get('admin-ready-title').textContent=item.title;get('admin-ready-url').value=item.url;
  if(dialog?.showModal&&!dialog.open)dialog.showModal();
  if(window.Notification?.permission==='granted'){
   try{const registration=await navigator.serviceWorker?.getRegistration('/');if(registration)await registration.showNotification('LightCity link ready',{body:item.title,tag:'studio-ready-'+job.videoId,icon:'/images/icon-192.png',silent:false,data:{lightcity:true,url:'/Admin/'}});}catch{}
  }
 }
 async function check(){
  stop();if(!owned())return;const current=sequence;
  try{const result=await api().getStudioPublication({videoId:job.videoId,visibility:job.visibility});if(current!==sequence||!owned())return;
   if(result.state==='removed'){status(result.message||'This video was removed from LightCity.');job=null;remember();busy=false;get('admin-publish').disabled=false;return;}
   if(result.state==='ready'){
    get('admin-quick-link').value=result.url;get('admin-quick-result').hidden=false;status(job.visibility==='test'?'Private test ready. Alerts were sent only to your registered test devices.':'Ready to share: '+result.title);busy=false;get('admin-publish').disabled=false;
    await alertReady(result);job=null;remember();return;
   }
   status(result.message||'Publishing your video…');
  }catch(error){if(current!==sequence||!owned())return;status(error?.code==='functions/not-found'?'Studio publishing needs its one-time setup and deployment.':'Unable to confirm publication yet. Checking again…');}
  if(owned())timer=setTimeout(()=>void check(),5000);
 }
 function restore(){
  if(!api()?.user?.uid){sequence++;stop();job=null;busy=false;get('admin-publish').disabled=false;get('admin-ready-dialog')?.close?.();return;}
  if(job&&!owned()){sequence++;stop();job=null;busy=false;get('admin-publish').disabled=false;get('admin-ready-dialog')?.close?.();}
  if(job||!api()?.user?.uid)return;
  try{const saved=JSON.parse(storage()?.getItem('lc-studio-publish')||'null');if(saved?.uid===api().user.uid&&streamId(saved.videoId)&&['public','members','test'].includes(saved.visibility)){job=saved;busy=true;get('admin-publish').disabled=true;void check();}}catch{}
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;const videoId=streamId(get('admin-quick').value),visibility=get('admin-audience').value,uid=api()?.user?.uid;
  if(!videoId||!uid){status('Sign in and enter a valid YouTube link or ID.');return;}
  // Obtain notification/audio permissions from the user's Publish click, before waiting.
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){context||=new Audio();void context.resume();}}catch{}
  if(window.Notification?.permission==='default')void window.Notification.requestPermission().catch(()=>{});
  busy=true;get('admin-publish').disabled=true;get('admin-quick-result').hidden=true;status(visibility==='test'?'Preparing a private test for your registered devices…':'Adding the video to your '+visibility+' list…');
  try{await api().publishStudioVideo({videoId,visibility,direct:true});if(api()?.user?.uid!==uid)return;
   job={videoId,visibility,uid};remember();status(visibility==='test'?'Test alert sent. Preparing your private preview…':'Saved. Checking that video and audio are ready…');sequence++;void check();
  }catch(error){status(error?.message||'Publication could not start. Please retry.');busy=false;get('admin-publish').disabled=false;}
 });
 get('admin-quick-copy').addEventListener('click',()=>void copy());
 get('admin-ready-copy').addEventListener('click',()=>{get('admin-quick-link').value=get('admin-ready-url').value;void copy();});
 get('admin-ready-close').addEventListener('click',()=>get('admin-ready-dialog').close());
 window.addEventListener('lightcity-members-changed',restore);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&owned())void check();});
 void Promise.resolve(api()?.ready).then(restore);return true;
}