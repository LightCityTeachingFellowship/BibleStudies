// The preference applies only when leaving the app, never to page navigation.
export function installBackgroundSwitch({document,storage,player}){
 let pending=null,disposed=false;
 async function changed(){
  if(disposed)return;
  if(document.visibilityState==='hidden'){
   let enabled=false;try{enabled=storage.getItem('lc-minimize-audio')==='1'}catch{}
   const item=player.current;if(!enabled||!item||item.mode!=='video'||!player.videoPlaying()||pending?.id===item.id)return;
   const attempt={id:item.id,task:null};pending=attempt;
   attempt.task=player.open({...item,mode:'audio'}).catch(()=>false);
   await attempt.task;
  }else{
   const attempt=pending;if(!attempt)return;pending=null;await attempt.task;
   const item=player.current;if(!disposed&&document.visibilityState!=='hidden'&&item?.id===attempt.id&&item.mode==='audio')await player.open({...item,mode:'video'}).catch(()=>false);
  }
 }
 document.addEventListener('visibilitychange',changed);
 const dispose=()=>{disposed=true;pending=null;document.removeEventListener('visibilitychange',changed)};dispose.check=changed;return dispose;
}
