export function setupAdminStreamMessages({document,window,api=()=>globalThis.LightCityMembers}){
 const form=document.getElementById('admin-stream-message-form');if(!form)return;
 const get=id=>document.getElementById('admin-stream-message-'+id),target=get('stream'),audience=get('audience'),person=get('recipient'),text=get('text'),status=get('status'),send=get('send');
 let streams=[],report=null,pending=null,busy=false,version=0,loadedOwner='';
 const owner=()=>api()?.user?.uid||'';
 function options(){const selected=target.value;target.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose a video or stream';target.appendChild(placeholder);for(const stream of streams){const option=document.createElement('option');option.value=(stream.privateTest?'test:':'published:')+stream.videoId;option.textContent=(stream.privateTest?'Private test · ':'')+stream.title;target.appendChild(option);}if(streams.some(s=>(s.privateTest?'test:':'published:')+s.videoId===selected))target.value=selected;}
 function fields(){const privateReply=audience.value==='sender';get('recipient-row').hidden=!privateReply;person.required=privateReply;get('hint').textContent=privateReply?'Only this sender can read your reply. Signed-in viewers can receive it on their other signed-in devices; visitors receive it in the browser they used.':'Only viewers of the selected stream receive this message. The original viewer message and name are not shared.';send.textContent=privateReply?'Send private reply':'Send to everyone watching';get('cancel').hidden=!report;}
 function reset(){report=null;pending=null;person.replaceChildren();audience.value='everyone';audience.querySelector('option[value="sender"]').disabled=true;text.value='';fields();}
 async function load(){const uid=owner(),ticket=++version;if(!uid){streams=[];loadedOwner='';options();reset();status.textContent='';return;}if(loadedOwner===uid)return;
  try{const result=await api().getStreamMessageTargets();if(ticket!==version||uid!==owner())return;streams=result.streams||[];loadedOwner=uid;options();}catch{if(uid===owner())status.textContent='Stream choices could not load. Refresh reports to retry.';}
 }
 window.addEventListener('lightcity-stream-reply',event=>{
  if(!owner()||busy)return;report=event.detail;pending=null;
  const value=(report.privateTest?'test:':'published:')+report.videoId;
  if(!streams.some(s=>(s.privateTest?'test:':'published:')+s.videoId===value)){streams.unshift({videoId:report.videoId,title:report.title,privateTest:!!report.privateTest});options();}target.value=value;
  person.replaceChildren();const seen=new Set();for(const sender of [report.sender,...(report.senders||[])]){if(!sender?.key||seen.has(sender.key))continue;seen.add(sender.key);const option=document.createElement('option');option.value=sender.key;option.textContent=sender.name;person.appendChild(option);}
  audience.querySelector('option[value="sender"]').disabled=!seen.size;audience.value=seen.size?'sender':'everyone';text.value='';status.textContent='';fields();form.scrollIntoView?.({behavior:'smooth',block:'nearest'});text.focus();
 });
 target.addEventListener('change',()=>{reset();status.textContent='';});audience.addEventListener('change',()=>{pending=null;fields();});get('cancel').addEventListener('click',()=>{reset();status.textContent='';});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!owner())return;
  const chosen=streams.find(s=>(s.privateTest?'test:':'published:')+s.videoId===target.value);if(!chosen||!text.value.trim()){status.textContent='Choose a stream and type a message.';return;}
  if(audience.value==='sender'&&(!report||!person.value)){status.textContent='Select Reply on the viewer’s report first.';return;}
  if(audience.value==='everyone'&&!window.confirm('Send this message to everyone watching “'+chosen.title+'”?'+(chosen.privateTest?' This stays inside your private test.':'')))return;
  const data={videoId:chosen.videoId,privateTest:chosen.privateTest,audience:audience.value,message:text.value.trim(),...(report?{reportId:report.id}:{}),...(audience.value==='sender'?{recipientKey:person.value}:{})};
  const fingerprint=JSON.stringify(data);if(!pending||pending.fingerprint!==fingerprint)pending={fingerprint,requestId:window.crypto.randomUUID()};
  busy=true;const uid=owner(),ticket=version;send.disabled=true;form.querySelectorAll('input,select,textarea,button').forEach(n=>n.disabled=true);status.textContent='Sending…';
  try{const result=await api().sendStreamMessage({...data,requestId:pending.requestId});if(ticket!==version||uid!==owner())return;status.textContent=result.message;text.value='';pending=null;window.dispatchEvent(new Event('lightcity-stream-reports-changed'));}
  catch(error){if(ticket===version&&uid===owner())status.textContent=error?.message||'Message could not be sent. Retry to send the same message safely.';}
  finally{busy=false;form.querySelectorAll('input,select,textarea,button').forEach(n=>n.disabled=false);audience.querySelector('option[value="sender"]').disabled=!report;fields();}
 });
 window.addEventListener('lightcity-members-changed',()=>{loadedOwner='';streams=[];options();reset();status.textContent='';void load();});
 document.getElementById('admin-stream-report-refresh')?.addEventListener('click',()=>{loadedOwner='';void load();});
 reset();void Promise.resolve(api()?.ready).then(load);return {load};
}
