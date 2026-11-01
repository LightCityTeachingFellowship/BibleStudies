import {serviceClocks,countdownParts,viewerTimeZone,NIGERIA_ZONE} from './service-countdown-core.mjs?v=1';
export function setupServiceCountdown({document,window,send=fetch,endpoint='https://us-central1-perceptive-zoo-424115-j6.cloudfunctions.net/getChurchServiceSchedule',storage=window.localStorage}={}){
 const get=id=>document.getElementById(id);if(!get('welcome-digits'))return;
 const obs=new URLSearchParams(window.location.search).get('display')==='obs';document.body.classList.toggle('welcome-obs',obs);
 const zone=obs?NIGERIA_ZONE:viewerTimeZone();let payload=null,anchor=0,mono=0,flight=false,stopped=false,clockKey='';
 const current=()=>anchor+(window.performance.now()-mono);
 function render(){if(!payload)return;const {schedule,next}=payload;get('welcome-heading').textContent=schedule.heading;get('welcome-message').textContent=schedule.message;
  if(!next){clockKey='';get('welcome-service').textContent='The next service time will be announced soon.';for(const id of ['welcome-digits','welcome-phase','welcome-starting','welcome-clocks'])get(id).hidden=true;return;}
  get('welcome-service').textContent=next.name;const parts=countdownParts(next.startAt,current());
  get('welcome-phase').hidden=parts.started;get('welcome-digits').hidden=parts.started;get('welcome-starting').hidden=!parts.started;get('welcome-starting').textContent=schedule.startingMessage;
  get('welcome-days-wrap').hidden=!parts.days;get('welcome-digits').classList.toggle('has-days',parts.days>0);
  for(const key of ['days','hours','minutes','seconds'])get('welcome-'+key).textContent=String(parts[key]).padStart(2,'0');
  const key=next.startAt+'|'+zone;if(key===clockKey)return;clockKey=key;
  const clocks=serviceClocks(next.startAt,zone);get('welcome-primary-label').textContent=clocks.primary.label;get('welcome-primary').textContent=clocks.primary.text;get('welcome-nigeria-wrap').hidden=!clocks.nigeria;get('welcome-nigeria').textContent=clocks.nigeria?.text||'';get('welcome-clocks').hidden=false;
 }
 async function refresh(){if(flight||stopped)return;flight=true;get('welcome-retry').hidden=true;const start=window.performance.now();
  try{const response=await send(endpoint,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();const data=await response.json();
   if(data.timeZone!==NIGERIA_ZONE||!Number.isFinite(data.serverNow)||!data.schedule||typeof data.schedule.heading!=='string'||(data.next!==null&&(!data.next||!Number.isFinite(data.next.startAt)||typeof data.next.name!=='string')))throw Error();
   payload=data;anchor=data.serverNow+(window.performance.now()-start)/2;mono=window.performance.now();get('welcome-status').textContent='';try{storage?.setItem('lc-service-countdown',JSON.stringify({...data,cachedAt:Date.now()}));}catch{}render();
  }catch{get('welcome-status').textContent=payload?'Connection interrupted. Showing the last confirmed service time; checking again shortly.':'The service time could not load. Please try again.';get('welcome-retry').hidden=false;}
  finally{flight=false;}
 }
 // An offline cache is explicitly labelled and never presented as a fresh confirmation.
 try{const saved=JSON.parse(storage?.getItem('lc-service-countdown')||'null');if(saved?.schedule&&saved.timeZone===NIGERIA_ZONE&&Date.now()-saved.cachedAt<86400000&&saved.cachedAt<=Date.now()&&(!saved.next||saved.next.startAt+saved.schedule.holdMinutes*60000>Date.now())){payload=saved;anchor=Date.now();mono=window.performance.now();render();}}catch{}
 get('welcome-retry').addEventListener('click',()=>void refresh());
 get('welcome-fullscreen').hidden=!document.fullscreenEnabled;
 get('welcome-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{get('welcome-status').textContent='Use your browser or OBS full-screen controls.';}});
 document.addEventListener('fullscreenchange',()=>{get('welcome-fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen');get('welcome-fullscreen').textContent=document.fullscreenElement?'Exit full screen ⛶':'Full screen ⛶';});
 const tick=window.setInterval(render,1000),poll=window.setInterval(()=>{if(document.visibilityState!=='hidden')void refresh();},20000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){render();void refresh();}});window.addEventListener('online',()=>void refresh());
 window.addEventListener('pagehide',e=>{if(!e.persisted){stopped=true;window.clearInterval(tick);window.clearInterval(poll);}});void refresh();return {refresh,render};
}
if(typeof document!=='undefined')setupServiceCountdown({document,window});
