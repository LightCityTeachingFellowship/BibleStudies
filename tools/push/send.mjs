import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {getMessaging} from 'firebase-admin/messaging';
import {createHash} from 'node:crypto';
const origin=new URL(process.env.SITE_URL);
if(origin.protocol !== 'https:' || !origin.pathname.endsWith('/') || origin.search || origin.hash) throw Error('SITE_URL must be an HTTPS base URL ending in /');
const dryRun = process.env.DRY_RUN === 'true';
const baselineOnly = process.env.BASELINE_ONLY === 'true';
initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))});
const db=getFirestore(), messaging=getMessaging();

function notificationMessage(data) {
 return {
  notification:{title:data.title,body:data.body,...(data.image ? {imageUrl:data.image} : {})},
  data,
  webpush:{
   headers:{TTL:'86400',Urgency:'high'},
   notification:{icon:new URL('images/pwa-192.png',origin).href,badge:new URL('images/notification-badge.png',origin).href,tag:data.id,...(data.image ? {image:data.image} : {})},
   fcmOptions:{link:data.url}
  }
 };
}
// YouTube hqdefault is 4:3 and can contain black letterboxing.
// Check actual JPEG dimensions: unavailable variants may return a tiny placeholder.
function jpegDimensions(bytes) {
 if(bytes.length<4 || bytes[0]!==0xff || bytes[1]!==0xd8) return null;
 let offset=2;
 while(offset+3<bytes.length) {
  if(bytes[offset++]!==0xff) return null;
  while(bytes[offset]===0xff) offset++;
  const marker=bytes[offset++];
  if(marker===0xd9 || marker===0xda) return null;
  if(marker===0x01 || (marker>=0xd0 && marker<=0xd7)) continue;
  if(offset+1>=bytes.length) return null;
  const length=(bytes[offset]<<8)|bytes[offset+1];
  if(length<2 || offset+length>bytes.length) return null;
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
   if(length<7) return null;
   return {height:(bytes[offset+3]<<8)|bytes[offset+4],width:(bytes[offset+5]<<8)|bytes[offset+6]};
  }
  offset+=length;
 }
 return null;
}
async function widescreenThumbnail(videoId) {
 for(const variant of ['maxresdefault','mqdefault']) {
  const url=`https://i.ytimg.com/vi/${videoId}/${variant}.jpg`;
  try {
   const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
   if(!response.ok) continue;
   const size=jpegDimensions(new Uint8Array(await response.arrayBuffer()));
   if(size && size.width>=320 && size.height>0 && Math.abs(size.width/size.height-16/9)<0.02) return url;
  } catch { /* Try the smaller widescreen version if the first is unavailable. */ }
 }
 console.warn(`No widescreen thumbnail available for ${videoId}; sending the title without an image.`);
 return null;
}
// Use the same public metadata source as the website; no YouTube API key required.
async function videoNotificationData(item) {
 const videoId=item.id.replace(/^video:/,'');
 if(!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw Error('Invalid YouTube video ID: '+videoId);
 const endpoint=new URL('https://www.youtube.com/oembed');
 endpoint.searchParams.set('url','https://www.youtube.com/watch?v='+videoId);
 endpoint.searchParams.set('format','json');
 let metadata;
 for(let attempt=0;attempt<3;attempt++) {
  try {
   const response=await fetch(endpoint,{signal:AbortSignal.timeout(10000)});
   if(!response.ok) throw Error('YouTube metadata HTTP '+response.status);
   metadata=await response.json();
   if(typeof metadata.title!=='string' || !metadata.title.trim()) throw Error('YouTube returned no video title');
   break;
  } catch(error) {
   if(attempt===2) throw Error(`Cannot prepare video ${videoId}: ${error.message}. It has not been marked as announced.`);
  }
 }
 const image=await widescreenThumbnail(videoId);
 return {id:item.key,title:'Video',body:metadata.title.trim(),url:item.url,...(image ? {image} : {})};
}
if(process.env.TEST_MODE === 'true') {
 const uid=(process.env.TEST_SUBSCRIBER_ID || '').trim();
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw Error('Enter the Firestore subscription document ID, not its token.');
 const subscriber=await db.doc('webPushSubscribers/'+uid).get();
 if(!subscriber.exists || !subscriber.data().token) throw Error('Subscription document missing or has no token.');
 const id='device-test-'+Date.now();
 let data={id,title:'LightCity device test',body:'Sent using the same format as automatic publishing alerts.',url:new URL('LightCity-Teaching-Fellowship/',origin).href};
 const minimal=process.env.TEST_BASIC === 'true';
 if(!minimal && process.env.TEST_VIDEO_ID?.trim()) {
  const videoId=process.env.TEST_VIDEO_ID.trim();
  data=await videoNotificationData({id:'video:'+videoId,key:id,url:new URL('Videos/',origin).href});
 }
 const payload=minimal
  ? {notification:{title:'LightCity basic test',body:'Title and message only, sent by GitHub.'}}
  : notificationMessage(data);
 await messaging.send({token:subscriber.data().token,...payload});
 console.log(`Test format: ${minimal ? 'basic title/body only' : 'automatic publishing format'}.`);
 console.log('Single-device test accepted by Firebase. This does not confirm device display.');
 console.log('Publication history was not changed; no other subscribers were targeted.');
 process.exit(0);
}

const response=await fetch(new URL('publication-feed.json',origin),{cache:'no-store'});
if(!response.ok) throw Error(`Feed returned ${response.status}`);
const feed=await response.json();
if(!Array.isArray(feed.posts)||!Array.isArray(feed.videos)) throw Error('Invalid publication feed');
const entries=[...new Map([...feed.posts,...feed.videos].map(item=>[item.id,item])).values()].map(item=>{
 if(!item.id||!item.title||!item.url) throw Error('Invalid publication');
 const url=new URL(item.url,origin);
 if(url.origin!==origin.origin || !url.pathname.startsWith(origin.pathname)) throw Error('Publication outside website');
 return {...item,url:url.href,key:createHash('sha256').update(item.id).digest('hex')};
});
const state=db.doc('webPushState/publications');
const initial=!(await state.get()).exists;
if(dryRun){
 console.log(`Validated ${entries.length} publications. ${initial ? 'First live run will save a baseline without sending.' : 'Existing baseline found.'}`);
 process.exit(0);
}
if(initial){
 for(let i=0;i<entries.length;i+=400){const batch=db.batch();for(const item of entries.slice(i,i+400)) batch.set(db.doc('webPushSent/'+item.key),{baseline:true});await batch.commit();}
 await state.set({initializedAt:FieldValue.serverTimestamp()});
 console.log('Baseline saved. No historical notifications sent.');process.exit(0);
}
if(baselineOnly){console.log('Baseline already exists. No notifications sent and no history changed.');process.exit(0);}
const pending=[];
for(const item of entries) if(!(await db.doc('webPushSent/'+item.key).get()).exists) pending.push(item);
if(!pending.length){console.log('No new publications.');process.exit(0);}
// Each video gets its own real title and thumbnail. Text resources retain a digest.
// Resolve every video before sending, so a metadata failure cannot silently
// replace a real title with generic text or mark that video as announced.
const plans=[];
const textItems=pending.filter(item=>item.kind!=='video');
if(textItems.length) {
 const latest=textItems.at(-1);
 plans.push({items:textItems,data:{id:latest.key,title:textItems.length===1?latest.title:`${textItems.length} new LightCity resources`,body:textItems.length===1?`A new ${latest.kind || 'resource'} is available.`:'New articles or summaries are available.',url:textItems.length===1?latest.url:new URL('LightCity-Teaching-Fellowship/',origin).href}});
}
for(const item of pending.filter(item=>item.kind==='video')) plans.push({items:[item],data:await videoNotificationData(item)});
const subscribers=await db.collection('webPushSubscribers').get();
for(const plan of plans) {
 let failed=false;
 for(let i=0;i<subscribers.docs.length;i+=500) {
  const docs=subscribers.docs.slice(i,i+500);
  const result=await messaging.sendEachForMulticast({tokens:docs.map(d=>d.data().token),...notificationMessage(plan.data)});
  console.log(`Push batch: ${result.responses.filter(r=>!r.error).length} accepted, ${result.responses.filter(r=>r.error).length} rejected. Acceptance does not confirm device display.`);
  for(let j=0;j<result.responses.length;j++) {
   const error=result.responses[j].error;
   if(error && ['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code)) await docs[j].ref.delete();
   else if(error){failed=true;console.error(error.code);}
  }
 }
 if(failed) throw Error('Some deliveries failed. Inspect before retrying; a retry can repeat successful deliveries.');
 for(let i=0;i<plan.items.length;i+=400) {
  const batch=db.batch();
  for(const item of plan.items.slice(i,i+400)) batch.set(db.doc('webPushSent/'+item.key),{sentAt:FieldValue.serverTimestamp()});
  await batch.commit();
 }
 console.log(`Announced ${plan.items.length} publications to ${subscribers.size} subscriptions.`);
}
