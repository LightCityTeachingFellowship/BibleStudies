import {createHash,randomUUID} from 'node:crypto';
import {requireStudioAdmin} from './studio-publishing.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const reportsPath='churchStudioPublications/stream-issues/reports';
export function youtubeState(item){
 const d=item?.liveStreamingDetails;
 // actualEndTime overrides a stale liveBroadcastContent flag.
 if(d?.actualEndTime&&Number.isFinite(Date.parse(d.actualEndTime)))return {state:'ended',endedAt:Date.parse(d.actualEndTime)};
 if(d?.actualStartTime&&item?.snippet?.liveBroadcastContent==='live')return {state:'live'};
 return {state:'unknown'};
}
export function playlistEvidence(text,now=Date.now()){
 let last=0,duration=0;
 for(const line of String(text).split(/\r?\n/)){if(line.startsWith('#EXT-X-PROGRAM-DATE-TIME:'))last=Date.parse(line.slice(25));if(line.startsWith('#EXTINF:'))duration=parseFloat(line.slice(8))||0;}
 const segment=String(text).split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).at(-1)?.split('?')[0]||'';
 return {last,segment,fresh:!text.includes('#EXT-X-ENDLIST')&&Number.isFinite(last)&&last>0&&now-last>=-30000&&now-last-duration*1000<60000,finished:text.includes('#EXT-X-ENDLIST')};
}
export function createStreamReports(deps){
 const {db,auth,fail,live,key,send=fetch,now=Date.now,pause=ms=>new Promise(r=>setTimeout(r,ms))}=deps;
 const pending=new Map();
 async function youtube(id){
  try{const url=new URL('https://www.googleapis.com/youtube/v3/videos');url.search=new URLSearchParams({part:'snippet,liveStreamingDetails',id,key:key(),fields:'items(id,snippet(liveBroadcastContent),liveStreamingDetails(actualStartTime,actualEndTime))'});
   const response=await send(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok){await response.body?.cancel();return {state:'unknown'};}return youtubeState((await response.json()).items?.find(v=>v.id===id));
  }catch{return {state:'unknown'};}
 }
 async function relay(id){try{const feed=(await live.catalog()).find(v=>v.videoId===id&&!v.replay&&v.active);if(!feed)return null;const signed=await live.sign(feed);const r=await send(signed.url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok){await r.body?.cancel();return null;}return playlistEvidence(await r.text(),now());}catch{return null;}}
 async function verify(id){
  if(pending.has(id))return pending.get(id);
  const work=(async()=>{
   const ref=db.doc('churchRateLimits/stream-status-'+id),cached=(await ref.get()).data();
   if(cached?.checkedAt>now()-15000)return cached.result;
   const first=await youtube(id);
   if(first.state==='ended'){await ref.set({checkedAt:now(),result:first});return first;}
   const before=await relay(id);
   await pause(7000);
   const [second,after]=await Promise.all([youtube(id),relay(id)]);
   const advancing=before?.fresh&&after?.fresh&&(after.last>before.last||after.segment!==before.segment);
   const result=second.state==='ended'?second:second.state==='live'&&advancing?{state:'live'}:{state:'unknown'};
   await ref.set({checkedAt:now(),result});return result;
  })();pending.set(id,work);try{return await work;}finally{pending.delete(id);}
 }
 return {
  async submit(request){
   const {videoId:id,issue,deviceToken}=request.data||{};
   if(!/^[\w-]{11}$/.test(id||'')||!['ended','volume','no-sound','message'].includes(issue))throw new fail('invalid-argument','Choose a stream and an issue.');
   if(typeof deviceToken!=='string'||deviceToken.length>10000)throw new fail('unauthenticated','Refresh the page and try again.');
   let device;try{device=(await auth.verifyIdToken(deviceToken,true)).uid;}catch{throw new fail('unauthenticated','Refresh the page and try again.');}
   const privateTest=request.data?.privateTest===true;
   let video,testOwner;
   if(privateTest){
    testOwner=await requireStudioAdmin(request,deps);
    const record=await db.doc('churchStudioPublications/private-test-'+hash(testOwner)+'/videos/'+id).get();
    if(!record.exists||record.data()?.videoId!==id)throw new fail('not-found','This private test was not found for your admin account.');
    video={id,title:record.data().title};
   }else{
    const snapshot=await db.doc('churchVideoLibrary/current').get();video=snapshot.data()?.videos?.find(v=>v.id===id);
   }
   if(!video)throw new fail('not-found','This video is no longer on LightCity. Refresh to open its replacement.');
   if(!privateTest&&video.visibility!=='public'){
    const uid=request.auth?.uid;if(!uid)throw new fail('permission-denied','Sign in with your church account first.');
    const [user,membership]=await Promise.all([auth.getUser(uid),db.doc('churchMembers/'+uid).get()]);if(user.disabled||!user.emailVerified||membership.data()?.active!==true)throw new fail('permission-denied','Church access is required for this stream.');
   }
   // Account names come from Admin Auth, never from a client-supplied UID or role.
   let account=null;if(request.auth?.uid){account=await auth.getUser(request.auth.uid);if(account.disabled)throw new fail('permission-denied','This account is unavailable.');}
   const cleanName=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim():'';
   const accountName=account?.emailVerified&&account.providerData?.length?cleanName(account.displayName).slice(0,80):'';
   const supplied=cleanName(request.data?.senderName);
   if(!accountName&&(!supplied||supplied.length>80))throw new fail('invalid-argument','Please enter your name (up to 80 characters).');
   const sender={name:accountName||supplied,source:accountName?'account':'visitor',key:hash(request.auth?.uid||device)};
   let custom='';if(issue==='message'){
    if(typeof request.data?.message!=='string'||request.data.message.length>2000)throw new fail('invalid-argument','Use a message between 1 and 2000 characters.');
    custom=request.data.message.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();if(!custom)throw new fail('invalid-argument','Please type your question, answer or message.');
   }
   // Neither client roles nor player-ended events can bypass server verification.
   await db.runTransaction(async tx=>{const actor=db.doc('churchRateLimits/stream-actor-'+hash(device+':'+id)),ip=db.doc('churchRateLimits/stream-ip-'+hash(request.rawRequest?.ip||device));const [a,b]=await Promise.all([tx.get(actor),tx.get(ip)]);const window=Math.floor(now()/300000),count=b.data()?.window===window?b.data().count:0;if(a.data()?.nextAt>now()||count>=15)throw new fail('resource-exhausted','Please wait before reporting again.');tx.set(actor,{nextAt:now()+30000});tx.set(ip,{window,count:count+1});});
   // Questions/answers are feedback, not claims about stream status; send without a YouTube check.
   // Audio faults are viewer feedback. Do not require a healthy audio relay to
   // report a broken one. Only ended-stream claims require full verification.
   const audioIssue=issue==='volume'||issue==='no-sound';
   const state=issue==='message'?{state:'message'}:audioIssue?await youtube(id):await verify(id);
   if(issue==='ended'&&state.state==='live')return {state:'still-live',refresh:true,message:'The stream is still live. Refresh this page to reconnect.'};
   if(issue==='ended'&&state.state==='unknown')return {state:'uncertain',refresh:true,recheck:true,message:'We could not confirm the stream status yet. YouTube may still be updating. Refresh or check again shortly. No ended-stream alert has been sent.'};
   if(audioIssue&&state.state==='ended')return {state:'ended',refresh:true,message:'This stream has ended. Refresh to check for an updated video.'};
   if(issue==='ended'&&now()-state.endedAt>2*3600000)return {state:'ended',refresh:true,message:'This broadcast ended earlier. Refresh to check for its recording or a newer stream.'};
   const reportId=hash((privateTest?'private:'+testOwner+':':'')+id+':'+issue+':'+(issue==='message'?randomUUID():Math.floor(now()/300000))),ref=db.doc(reportsPath+'/'+reportId);
   await db.runTransaction(async tx=>{const old=await tx.get(ref);if(old.exists){const senders=[...(old.data().senders||[]).filter(s=>s.key!==sender.key),sender].slice(-20);tx.set(ref,{count:(old.data().count||1)+1,lastAt:now(),senders},{merge:true});return;}tx.set(ref,{videoId:id,title:String(video.title||'LightCity stream').slice(0,300),issue,sender,senders:[sender],...(privateTest?{privateTest:true,testOwner}:{}),...(issue==='message'?{message:custom}:issue==='no-sound'?{message:'No sound is coming from the stream. Please check the audio feed.'}:{}),verified:issue==='ended',createdAt:now(),lastAt:now(),count:1,resolved:false,delivery:'pending'});});
   return {state:'reported',message:issue==='message'?'Your message has been sent to the admin.':issue==='ended'?'The stream ending was confirmed. Your report has been sent to the admin.':issue==='no-sound'?'Your no-sound report has been sent to the admin.':'Your request to increase the speaker volume has been sent to the admin.'};
  },
  async inbox(request){const uid=await requireStudioAdmin(request,deps);const rows=await db.collection(reportsPath).where('resolved','==',false).get();return {reports:rows.docs.map(d=>({id:d.id,...d.data()})).filter(r=>!r.privateTest||r.testOwner===uid).sort((a,b)=>b.createdAt-a.createdAt)};},
  async resolve(request){const uid=await requireStudioAdmin(request,deps);const id=request.data?.reportId;if(!/^[a-f0-9]{64}$/.test(id||''))throw new fail('invalid-argument','Choose a report.');const ref=db.doc(reportsPath+'/'+id),row=await ref.get();if(!row.exists||row.data()?.privateTest&&row.data().testOwner!==uid)throw new fail('not-found','Report not found.');await ref.set({resolved:true},{merge:true});return {resolved:true};}
 };
}
export async function notifyStreamReport({id,db,auth,messaging,emails,now=Date.now}){
 const ref=db.doc(reportsPath+'/'+id),row=(await ref.get()).data();if(!row||row.resolved||row.delivery==='sent')return;
 const targets=new Map();
 for(const email of String(emails()).split(/[,;\s]+/).filter(Boolean)){
  let user;try{user=await auth.getUserByEmail(email);}catch{continue;}if(user.disabled||!user.emailVerified||row.privateTest&&row.testOwner!==user.uid)continue;
  const devices=await db.collection('churchStudioPublications/private-test-'+hash(user.uid)+'/devices').get();if(!devices.docs.length)continue;
  const subscribers=await db.getAll(...devices.docs.map(d=>db.doc('webPushSubscribers/'+d.id)));for(const d of subscribers)if(typeof d.data()?.token==='string'&&d.data().token)targets.set(d.data().token,d);
 }
 if(!targets.size){await ref.set({delivery:'no-devices'},{merge:true});return;}
 const senderLabel=(row.sender?.name||'A viewer')+(row.sender?.source==='visitor'?' (visitor)':'');
 const url='https://lightcityfellowship.com/Admin/?reports=1',title=(row.privateTest?'Private test · ':'')+(row.issue==='message'?'Stream message from '+senderLabel:row.issue==='ended'?'Stream ended — confirmed':row.issue==='no-sound'?'No sound on the stream':'Speaker volume request');
 const body=row.issue==='message'?row.message.slice(0,240)+' · '+row.title:(senderLabel+': '+(row.issue==='ended'?'Stream ending confirmed. ':row.issue==='no-sound'?'There is no sound on the stream. ':'Speaker volume is too low. ')+row.title);
 for(const [token,subscriber]of targets){
  const receipt=db.doc(reportsPath+'/'+id+'/delivery/'+hash(token));if((await receipt.get()).exists)continue;
  const result=await messaging.sendEachForMulticast({tokens:[token],notification:{title,body},data:{id:'stream-issue-'+id,title,body,url,requireInteraction:'true'},webpush:{headers:{TTL:'1800',Urgency:'high'},notification:{icon:'https://lightcityfellowship.com/images/pwa-192.png',badge:'https://lightcityfellowship.com/images/notification-badge.png',tag:'stream-issue-'+id,silent:false,renotify:true,requireInteraction:true},fcmOptions:{link:url}}});
  const error=result.responses[0]?.error;if(error){if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code)){await subscriber.ref.delete();continue;}throw Error('Admin notification needs retry.');}
  await receipt.set({sentAt:now()});
 }
 await ref.set({delivery:'sent'},{merge:true});
}
