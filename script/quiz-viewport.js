/* Refit after questions, fonts, settings or the usable screen size change. */
(() => {
 const panel=document.getElementById('opacityBG');
 if(!panel)return;
 let frame;
 function fit(){
  frame=null;
  if(!panel.getClientRects().length)return;
  panel.style.height=Math.max(200,innerHeight-Math.max(0,panel.getBoundingClientRect().top))+'px';
  panel.style.minHeight='0';
  panel.style.setProperty('--quiz-fit','1');
  const fits=()=>panel.scrollHeight<=panel.clientHeight+1;
  if(fits())return;
  let low=.45,high=1;
  for(let i=0;i<9;i++){
   const mid=(low+high)/2;panel.style.setProperty('--quiz-fit',String(mid));
   if(fits())low=mid;else high=mid;
  }
  panel.style.setProperty('--quiz-fit',String(low));
 }
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(fit);};
 new MutationObserver(schedule).observe(panel,{childList:true,subtree:true,characterData:true});
 document.addEventListener('click',schedule);
 window.addEventListener('resize',schedule);
 window.visualViewport?.addEventListener('resize',schedule);
 window.addEventListener('lightcity-members-changed',schedule);
 document.fonts?.ready.then(schedule);
 schedule();
})();
