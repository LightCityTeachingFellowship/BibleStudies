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
  notification:{title:data.title,body:data.body},
  data,
  webpush:{
   headers:{TTL:'86400',Urgency:'high'},
   notification:{icon:new URL('images/pwa-192.png',origin).href,tag:data.id},
   fcmOptions:{link:data.url}
  }
 };
}
if(process.env.TEST_MODE === 'true') {
 const uid=(process.env.TEST_SUBSCRIBER_ID || '').trim();
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw Error('Enter the Firestore subscription document ID, not its token.');
 const subscriber=await db.doc('webPushSubscribers/'+uid).get();
 if(!subscriber.exists || !subscriber.data().token) throw Error('Subscription document missing or has no token.');
 const id='device-test-'+Date.now();
 const data={id,title:'LightCity device test',body:'Sent using the same format as automatic publishing alerts.',url:new URL('LightCity-Teaching-Fellowship/',origin).href};
 await messaging.send({token:subscriber.data().token,...notificationMessage(data)});
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
// A digest prevents notification floods when several items are published together.
const subscribers=await db.collection('webPushSubscribers').get();
const latest=pending.at(-1);
const data={id:latest.key,title:pending.length===1?latest.title:`${pending.length} new LightCity resources`,body:pending.length===1?`A new ${latest.kind || 'resource'} is available.`:'New articles, summaries or videos are available.',url:pending.length===1?latest.url:new URL('LightCity-Teaching-Fellowship/',origin).href};
let failed=false;
for(let i=0;i<subscribers.docs.length;i+=500){
 const docs=subscribers.docs.slice(i,i+500);
 // A notification payload lets Firebase display background alerts directly,
 // using the same mechanism as Firebase Console test messages.
 const result=await messaging.sendEachForMulticast({
  tokens:docs.map(d=>d.data().token),
  ...notificationMessage(data)
 });
 console.log(`Push batch: ${result.responses.filter(r=>!r.error).length} accepted, ${result.responses.filter(r=>r.error).length} rejected. Acceptance does not confirm device display.`);
 for(let j=0;j<result.responses.length;j++){
  const error=result.responses[j].error;
  if(error && ['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code)) await docs[j].ref.delete();
  else if(error){failed=true;console.error(error.code);}
 }
}
if(failed) throw Error('Some deliveries failed. Inspect before retrying; a retry can repeat successful deliveries.');
for(let i=0;i<pending.length;i+=400){const batch=db.batch();for(const item of pending.slice(i,i+400))batch.set(db.doc('webPushSent/'+item.key),{sentAt:FieldValue.serverTimestamp()});await batch.commit();}
console.log(`Announced ${pending.length} publications to ${subscribers.size} subscriptions.`);
