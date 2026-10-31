import {getLiveRecordings,isLive} from './live-status.mjs';
export function setupStreamIssueForm({document,window,api=()=>globalThis.LightCityMembers,privateTest=false}){
 const get=id=>document.getElementById(id),open=get('stream-report-open'),dialog=get('stream-report-dialog');if(!open||!dialog)return;
 const id=new URL(window.location.href).searchParams.get(privateTest?'test':'v');if(!/^[\w-]{11}$/.test(id||''))return;
 const message=get('stream-report-status'),submit=get('stream-report-send'),refresh=get('stream-report-refresh'),recheck=get('stream-report-recheck'),kind=get('stream-report-kind'),sender=get('stream-report-name'),note=get('stream-report-message'),nameRow=get('stream-report-name-row'),textRow=get('stream-report-message-row'),identity=get('stream-report-identity'),storageKey='lc-recent-live-'+id;
 let busy=false,revision=0,sessionOwner='';
 function currentOwner(){return (api()?.user?.uid||'public')+':'+!!api()?.library;}
 function fields(){
  const user=api()?.user,accountName=!user?.isAnonymous&&user?.emailVerified&&user?.displayName?.trim();
  nameRow.hidden=!!accountName;sender.required=!accountName;sender.disabled=!!accountName||busy;identity.textContent=accountName?'Sending as '+accountName+'.':'Your name will be shown to the admin as a visitor-provided name.';
  textRow.hidden=kind.value!=='message';note.required=kind.value==='message';note.disabled=busy;kind.disabled=busy;submit.textContent=kind.value==='message'?'Send message':'Send report';
 }
 function availability(){
  const allowed=privateTest?!!api()?.user?.uid&&get('admin-test-preview')?.hidden===false:(api()?.library||api()?.publicLibrary||[]).some(v=>v.id===id),owner=currentOwner();
  if(owner!==sessionOwner){sessionOwner=owner;revision++;dialog.close();message.textContent='';sender.value='';note.value='';}
  fields();let seen=0;try{const old=JSON.parse(window.sessionStorage.getItem(storageKey)||'null');if(old?.owner===owner)seen=old.at;}catch{}
  if(allowed&&isLive(id)){seen=Date.now();try{window.sessionStorage.setItem(storageKey,JSON.stringify({at:seen,owner}));}catch{}}
  open.hidden=!allowed||(!privateTest&&(get('watch-player')?.hidden===true||!(isLive(id)||seen>0&&Date.now()-seen<2*3600000)));
  if(!allowed)dialog.close();
 }
 async function report(){
  availability();if(busy||open.hidden)return;
  const issue=kind.value,name=sender.value.trim(),text=note.value.trim();
  if(sender.required&&!name){message.textContent='Please enter your name.';sender.focus();return;}
  if(issue==='message'&&!text){message.textContent='Please type your question, answer or message.';note.focus();return;}
  busy=true;const ticket=++revision,owner=currentOwner();submit.disabled=true;fields();recheck.hidden=true;refresh.hidden=true;message.textContent=issue==='message'?'Sending your message…':issue==='ended'?'Checking whether the stream has ended. This may take a few seconds…':issue==='no-sound'?'Sending your no-sound report…':'Checking the stream and sending your volume request…';
  try{const result=await api().reportStreamIssue({videoId:id,issue,senderName:name,...(privateTest?{privateTest:true}:{}),...(issue==='message'?{message:text}:{})});if(ticket!==revision||owner!==currentOwner())return;message.textContent=result.message;refresh.hidden=!result.refresh;recheck.hidden=!result.recheck;if(issue==='message'&&result.state==='reported')note.value='';if(privateTest&&result.state==='reported')window.dispatchEvent(new Event('lightcity-stream-reports-changed'));}
  catch(error){if(ticket!==revision||owner!==currentOwner())return;message.textContent=error?.message||'Your message could not be sent. Please try again.';refresh.hidden=false;}
  finally{busy=false;submit.disabled=false;fields();}
 }
 open.addEventListener('click',()=>{fields();if(!dialog.open)dialog.showModal();});kind.addEventListener('change',()=>{fields();message.textContent='';refresh.hidden=true;recheck.hidden=true;});
 get('stream-report-close').addEventListener('click',()=>dialog.close());get('stream-report-form').addEventListener('submit',event=>{event.preventDefault();void report();});
 recheck.addEventListener('click',()=>void report());refresh.addEventListener('click',()=>window.location.reload());
 let outside=false;const beyond=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
 dialog.addEventListener('pointerdown',e=>{outside=e.target===dialog&&beyond(e);});dialog.addEventListener('click',e=>{if(outside&&e.target===dialog&&beyond(e))dialog.close();outside=false;});
 window.addEventListener('lightcity-live-status',availability);window.addEventListener('lightcity-members-changed',availability);if(!privateTest&&get('watch-player'))new MutationObserver(availability).observe(get('watch-player'),{attributes:true,attributeFilter:['hidden']});
 void Promise.resolve(api()?.ready).then(()=>privateTest?null:getLiveRecordings()).then(availability).catch(()=>{});return {availability,report};
}
if(typeof document!=='undefined'&&document.getElementById('watch-player'))setupStreamIssueForm({document,window});
