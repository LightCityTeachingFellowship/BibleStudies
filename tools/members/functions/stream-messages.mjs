import {createHash} from 'node:crypto';
import {requireStudioAdmin} from './studio-publishing.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const validId=value=>typeof value==='string'&&/^[\w-]{11}$/.test(value);
const validKey=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const reportsPath='churchStudioPublications/stream-issues/reports/';
const lifetime=24*3600000;
const privateMessageAudience='sender';
const streamMessagesPath=({scope,id})=>'churchStudioPublications/stream-messages-'+hash(scope+':'+id);
export const privateStreamMessagesPath=(video,recipient)=>streamMessagesPath(video)+'/recipients/'+recipient+'/messages';
export const canReplyToStreamMessage=(message,now)=>message?.audience===privateMessageAudience&&message.expiresAt>now&&typeof message.message==='string'&&!!message.message.trim();
export function createStreamMessages(deps){
 const {db,auth,fail,now=Date.now}=deps;
 async function stream(request,{admin=false}={}){
  const id=request.data?.videoId;if(!validId(id))throw new fail('invalid-argument','Choose a stream.');
  if(request.data?.privateTest===true){
   const owner=await requireStudioAdmin(request,deps),row=await db.doc('churchStudioPublications/private-test-'+hash(owner)+'/videos/'+id).get();
   if(!row.exists||row.data()?.videoId!==id)throw new fail('not-found','This private test is no longer available.');
   return {id,title:row.data().title||'Private test',scope:'test:'+owner,privateTest:true};
  }
  const snapshot=await db.doc('churchVideoLibrary/current').get(),video=snapshot.data()?.videos?.find(v=>v.id===id);
  if(!video)throw new fail('not-found','This stream is no longer available. Refresh to open its replacement.');
  if(!admin&&video.visibility!=='public'){
   const uid=request.auth?.uid;if(!uid)throw new fail('permission-denied','Church access is required for this stream.');
   const [user,member]=await Promise.all([auth.getUser(uid),db.doc('churchMembers/'+uid).get()]);
   if(user.disabled||!user.emailVerified||member.data()?.active!==true)throw new fail('permission-denied','Church access is required for this stream.');
  }
  return {id,title:video.title||'LightCity stream',scope:'published',privateTest:false};
 }
 return {
  async targets(request){
   const uid=await requireStudioAdmin(request,deps);
   const [current,tests]=await Promise.all([db.doc('churchVideoLibrary/current').get(),db.collection('churchStudioPublications/private-test-'+hash(uid)+'/videos').get()]);
   return {streams:[...(current.data()?.videos||[]).slice(0,40).map(v=>({videoId:v.id,title:String(v.title||v.id).slice(0,300),privateTest:false})),...tests.docs.map(d=>({videoId:d.id,title:String(d.data()?.title||d.id).slice(0,300),privateTest:true}))].filter(v=>validId(v.videoId))};
  },
  async send(request){
   const uid=await requireStudioAdmin(request,deps),data=request.data||{};
   if(!['sender','everyone'].includes(data.audience))throw new fail('invalid-argument','Choose who should receive the message.');
   if(typeof data.message!=='string'||data.message.length>2000)throw new fail('invalid-argument','Use a message between 1 and 2000 characters.');
   const text=data.message.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();
   if(!text)throw new fail('invalid-argument','Please type a message.');
   if(typeof data.requestId!=='string'||!/^[\w-]{16,80}$/.test(data.requestId))throw new fail('invalid-argument','Please retry sending the message.');
   const video=await stream(request,{admin:true}),id=hash(uid+':'+data.requestId);
   let reportRef=null,recipient=null;
   if(data.reportId!=null){if(!validKey(data.reportId))throw new fail('invalid-argument','Choose a stream message to reply to.');reportRef=db.doc(reportsPath+data.reportId);}
   if(data.audience==='sender'){
    if(!reportRef||!validKey(data.recipientKey))throw new fail('invalid-argument','Choose the original sender for a private reply.');
    recipient=data.recipientKey;
   }
   const destination=db.doc((recipient?privateStreamMessagesPath(video,recipient):streamMessagesPath(video)+'/broadcasts')+'/'+id);
   const receipt=db.doc('churchStudioPublications/stream-message-receipts/messages/'+id),rate=db.doc('churchRateLimits/stream-admin-message-'+hash(uid));
   const fingerprint=hash(JSON.stringify([video.scope,video.id,data.audience,recipient,data.reportId||null,text]));
   return db.runTransaction(async tx=>{
    const [previous,limit,report]=await Promise.all([tx.get(receipt),tx.get(rate),reportRef?tx.get(reportRef):null]);
    if(previous.exists){if(previous.data().fingerprint!==fingerprint)throw new fail('already-exists','This send was already used for a different message.');return previous.data().result;}
    let originalSender;
    if(reportRef){
     const row=report?.data();
     if(!report?.exists||row.videoId!==video.id||!!row.privateTest!==video.privateTest||row.privateTest&&row.testOwner!==uid||row.replyOwner&&row.replyOwner!==uid)throw new fail('not-found','The original message was not found for this stream.');
     if(recipient){
      originalSender=[...(row.senders||[]),row.sender].find(s=>s?.key===recipient);
      if(!originalSender)throw new fail('permission-denied','A private reply must go to an original sender.');
     }
    }
    const window=Math.floor(now()/60000),count=limit.data()?.window===window?limit.data().count:0;
    if(count>=20)throw new fail('resource-exhausted','Please wait a minute before sending more messages.');
    const result={sent:true,id,audience:data.audience,message:recipient?'Private reply sent to the sender.':'Message sent to everyone watching this stream.'};
    // Do not copy the viewer’s original question, name or recipient identity into broadcasts.
    tx.set(destination,{
     message:text,audience:data.audience,createdAt:now(),expiresAt:now()+lifetime,
     ...(recipient?{replyOwner:uid,recipientName:originalSender.name||'',recipientSource:originalSender.source||'visitor'}:{})
    });
    tx.set(receipt,{fingerprint,result,createdAt:now(),expiresAt:now()+lifetime});tx.set(rate,{window,count:count+1});
    if(reportRef)tx.set(reportRef,{lastReply:{message:text,audience:data.audience,createdAt:now()}},{merge:true});
    return result;
   });
  },
  async inbox(request){
   const token=request.data?.deviceToken;if(typeof token!=='string'||!token||token.length>10000)throw new fail('unauthenticated','Refresh the page and try again.');
   let device;try{device=(await auth.verifyIdToken(token,true)).uid;}catch{throw new fail('unauthenticated','Refresh the page and try again.');}
   if(request.auth?.uid){const user=await auth.getUser(request.auth.uid);if(user.disabled)throw new fail('permission-denied','This account is unavailable.');}
   const video=await stream(request),recipient=hash(request.auth?.uid||device);
   const [broadcasts,personal]=await Promise.all([db.collection(streamMessagesPath(video)+'/broadcasts').orderBy('createdAt','desc').limit(30).get(),db.collection(privateStreamMessagesPath(video,recipient)).orderBy('createdAt','desc').limit(30).get()]);
   const at=now();
   const display=(doc,personal)=>{
    const row=doc.data();
    return {
     id:doc.id,message:row.message,audience:row.audience,createdAt:row.createdAt,expiresAt:row.expiresAt,
     ...(personal&&canReplyToStreamMessage(row,at)?{canReply:true}:{})
    };
   };
   return {messages:[...broadcasts.docs.map(d=>display(d,false)),...personal.docs.map(d=>display(d,true))].filter(m=>m.expiresAt>at).sort((a,b)=>b.createdAt-a.createdAt).map(({expiresAt,...message})=>message)};
  }
 };
}
