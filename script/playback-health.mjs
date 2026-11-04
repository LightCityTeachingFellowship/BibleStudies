// Recover stalled transport without treating an intentional pause as a failure.
export function watchPlayback(audio,{active,recover,delay=12000,timers=globalThis}){
 let timer=null,disposed=false;
 const cancel=()=>{if(timer!==null)timers.clearTimeout(timer);timer=null;};
 const check=()=>{
  if(disposed||timer!==null||!active()||audio.paused||audio.ended||audio.seeking)return;
  const position=audio.currentTime;
  timer=timers.setTimeout(()=>{
   timer=null;
   if(!disposed&&active()&&!audio.paused&&!audio.ended&&!audio.seeking&&Math.abs(audio.currentTime-position)<.1)void recover();
  },delay);
 };
 const progressed=()=>{cancel();};
 const events={waiting:check,stalled:check,timeupdate:progressed,playing:progressed,pause:cancel,ended:cancel,seeking:cancel};
 for(const [name,fn]of Object.entries(events))audio.addEventListener(name,fn);
 return {check,dispose(){disposed=true;cancel();for(const [name,fn]of Object.entries(events))audio.removeEventListener(name,fn);}};
}
const KEY='lc-playback-diagnostics';
export function playbackDiagnostics(){try{const rows=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(rows)?rows.slice(-60):[];}catch{return [];}}
export function recordPlaybackEvent(type,details={}){
 try{const rows=playbackDiagnostics();rows.push({at:Date.now(),type,visibility:document.visibilityState,...details});localStorage.setItem(KEY,JSON.stringify(rows.slice(-60)));}catch{}
}
