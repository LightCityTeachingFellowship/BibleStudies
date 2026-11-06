// In-page delivery never reloads, pauses or replaces the playing stream.
export function setupStreamInbox({document,window,api,videoId,privateTest=false,panel:providedPanel,list:providedList}){
 const panel=providedPanel||document.getElementById('stream-admin-messages'),list=providedList||document.getElementById('stream-admin-message-list');
 if(!panel||!list)return;
 let enabled=false,flight=false,revision=0,lastOwner='',rows=[],dismissed=new Set(),destroyed=false;
 const cards=new Map();
 const listeners=[],listen=(target,event,fn)=>{target.addEventListener?.(event,fn);listeners.push(()=>target.removeEventListener?.(event,fn));};
 const owner=()=>api()?.user?.uid||'visitor',key=()=> 'lc-stream-messages-dismissed:'+owner()+':'+(privateTest?'test:':'')+videoId;
 function clear(){revision++;rows=[];cards.clear();list.replaceChildren();panel.hidden=true;}
 function account(){if(lastOwner===owner())return;lastOwner=owner();clear();try{dismissed=new Set(JSON.parse(window.sessionStorage.getItem(key())||'[]'));}catch{dismissed=new Set();}}
 function addReply(card,actions,row){
  const reply=document.createElement('button');reply.type='button';reply.textContent='Reply privately';reply.setAttribute('aria-expanded','false');
  const form=document.createElement('form');form.className='stream-admin-reply';form.hidden=true;
  const label=document.createElement('label');label.textContent='Your reply to LightCity';
  const input=document.createElement('textarea');input.required=true;input.maxLength=2000;input.rows=3;label.appendChild(input);
  const send=document.createElement('button');send.type='submit';send.textContent='Send reply';
  const status=document.createElement('div');status.className='stream-admin-reply-status';status.setAttribute('role','status');
  form.append(label,send);
  let pending=null,busy=false;
  function toggle(open){form.hidden=!open;reply.setAttribute('aria-expanded',String(open));}
  reply.addEventListener('click',()=>{if(busy)return;const open=form.hidden;toggle(open);status.textContent='';if(open)input.focus();});
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   const message=input.value.trim();
   if(busy||!message)return;
   if(!pending||pending.message!==message)pending={message,requestId:window.crypto.randomUUID()};
   const ticket=revision,identity=owner();
   const current=()=>ticket===revision&&identity===owner()&&card.isConnected;
   busy=true;input.readOnly=send.disabled=reply.disabled=true;status.textContent='Sending reply…';
   try{
    const result=await api().reportStreamIssue({videoId,privateTest,issue:'message',replyTo:row.id,...pending});
    if(!current())return;
    if(result?.state!=='reported')throw new Error('Your reply could not be confirmed. Please retry.');
    const restoreFocus=form.contains(document.activeElement)||document.activeElement===document.body;
    pending=null;input.value='';toggle(false);status.textContent='Private reply sent to LightCity.';
    reply.disabled=false;if(restoreFocus)reply.focus();
    if(privateTest)window.dispatchEvent(new Event('lightcity-stream-reports-changed'));
   }catch(error){if(current())status.textContent=error?.message||'Your reply could not be sent. Please retry.';}
   finally{busy=false;input.readOnly=send.disabled=reply.disabled=false;}
  });
  actions.appendChild(reply);card.append(form,status);
 }
 function createCard(row){
  const card=document.createElement('article');card.className='stream-admin-message';
  const heading=document.createElement('strong');heading.textContent=row.audience==='sender'?'Private reply from LightCity':'Message to everyone watching';
  const body=document.createElement('p');body.textContent=row.message;
  const time=document.createElement('small');time.textContent=new Date(row.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const actions=document.createElement('div');actions.className='stream-admin-message-actions';actions.appendChild(time);
  const close=document.createElement('button');close.type='button';close.textContent='Dismiss';close.addEventListener('click',()=>{dismissed.add(row.id);try{window.sessionStorage.setItem(key(),JSON.stringify([...dismissed].slice(-200)));}catch{}render();});
  card.append(heading,body,actions);
  if(row.audience==='sender'&&row.canReply===true)addReply(card,actions,row);
  actions.appendChild(close);
  return card;
 }
 function render(){
  const visible=rows.filter(row=>!dismissed.has(row.id)),ids=new Set(visible.map(row=>row.id));
  panel.hidden=!visible.length;
  for(const [id,card] of cards){if(!ids.has(id)){card.remove();cards.delete(id);}}
  visible.forEach((row,index)=>{
   if(!cards.has(row.id))cards.set(row.id,createCard(row));
   const card=cards.get(row.id),position=list.children[index];
   if(card!==position)list.insertBefore(card,position||null);
  });
 }
 async function refresh(){
  account();if(destroyed||!enabled||flight||document.visibilityState==='hidden'||typeof api()?.getStreamMessages!=='function')return;
  flight=true;const ticket=revision,identity=owner();
  try{const result=await api().getStreamMessages({videoId,...(privateTest?{privateTest:true}:{})});if(ticket!==revision||identity!==owner()||!enabled)return;const next=result.messages||[];if(JSON.stringify(next)===JSON.stringify(rows))return;rows=next;render();}
  catch(error){if(ticket===revision&&['functions/permission-denied','functions/unauthenticated','functions/not-found'].includes(error?.code))clear();}
  finally{flight=false;}
 }
 const timer=setInterval(()=>void refresh(),10000);timer.unref?.();
 listen(window,'focus',()=>void refresh());listen(document,'visibilitychange',()=>{if(document.visibilityState==='visible')void refresh();});
 listen(window,'lightcity-members-changed',()=>{lastOwner='';account();void refresh();});
 const destroy=()=>{destroyed=true;enabled=false;clearInterval(timer);listeners.forEach(remove=>remove());clear();};
 listen(window,'pagehide',event=>{if(!event.persisted)destroy();});
 return {setEnabled(value){if(destroyed)return;account();if(value===enabled)return;enabled=value;if(enabled)void refresh();else clear();},refresh,destroy};
}
let playingId='',selection=0,floating=null;
export async function showPlayingStreamMessages(videoId){
 // Watch and the private Studio preview already have their own message panel.
 if(typeof globalThis.LightCityMembers?.getStreamMessages!=='function'||typeof document==='undefined'||document.getElementById('watch-player')||document.getElementById('admin-content'))return;
 if(playingId===videoId)return;playingId=videoId;const ticket=++selection;
 floating?.inbox.destroy();floating?.panel.remove();floating=null;
 if(ticket!==selection||!/^[\w-]{11}$/.test(videoId))return;
 const panel=document.createElement('section'),list=document.createElement('div');panel.className='stream-admin-messages stream-admin-messages-floating';panel.hidden=true;panel.setAttribute('aria-label','Messages from LightCity');panel.setAttribute('aria-live','polite');panel.setAttribute('aria-relevant','additions');panel.appendChild(list);document.body.appendChild(panel);
 const inbox=setupStreamInbox({document,window,api:()=>globalThis.LightCityMembers,videoId,panel,list});floating={panel,inbox};inbox.setEnabled(true);
}
