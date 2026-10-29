import {createHash,randomUUID} from 'node:crypto';
import {publishedReadingCatalog} from './reading-activity.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const validVideo=id=>typeof id==='string'&&/^[\w-]{11}$/.test(id);
const validReading=id=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
const validList=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
const millis=value=>typeof value?.toMillis==='function'?value.toMillis():value instanceof Date?value.getTime():Number(value)||0;
export function createPersonalHub({auth,db,fail,privateCatalog=[],catalog=publishedReadingCatalog(),now=Date.now}){
 async function identity(request,guest=false){
  const uid=request.auth?.uid;
  if(uid&&request.auth.token?.firebase?.sign_in_provider!=='anonymous'){
   if(request.data?.accountUid!==uid)throw new fail('permission-denied','Your account changed. Please try again.');
   const user=await auth.getUser(uid);
   if(user.disabled||!user.emailVerified||!user.providerData?.length)throw new fail('permission-denied','Sign in with a verified account.');
   return {uid,member:(await db.doc('churchMembers/'+uid).get()).data()?.active===true};
  }
  if(guest){try{const token=request.data?.deviceToken;if(typeof token!=='string'||token.length>10000)throw Error();const user=await auth.verifyIdToken(token,true);if(user.firebase?.sign_in_provider!=='anonymous')throw Error();return {uid:user.uid,member:false};}catch{throw new fail('unauthenticated','Refresh the page to load notifications.');}}
  throw new fail('unauthenticated','Sign in to create and sync playlists.');
 }
 async function resources(person){
  const snapshot=await db.doc('churchVideoLibrary/current').get(),videos=snapshot.data()?.videos;
  if(!Array.isArray(videos))throw new fail('unavailable','The library is temporarily unavailable.');
  const map=new Map(),announcements=new Map(),current=new Set(videos.map(v=>v.id));
  const restricted=new Set(videos.filter(v=>v.visibility!=='public').map(v=>v.id));
  for(const v of videos){
   if(!validVideo(v.id)||(restricted.has(v.id)&&!person.member))continue;
   const item={type:'media',id:v.id,title:String(v.title||'LightCity video').slice(0,300),kind:'Video',url:'/Watch/?v='+v.id};map.set('media:'+v.id,item);announcements.set(hash('video:'+v.id),item);
   for(const old of v.replaces||[])if(validVideo(old)&&!current.has(old)){
    map.set('media:'+old,item);
    if(person.member||v.replacementVisibility?.[old]==='public')announcements.set(hash('video:'+old),item);
   }
  }
  const readings=new Map(await catalog());
  if(person.member)for(const r of privateCatalog){try{const u=new URL(r.url,'https://lightcityfellowship.com');if(u.origin!=='https://lightcityfellowship.com'||/%2f|%5c/i.test(u.pathname))continue;readings.set(hash(decodeURI(u.pathname).normalize('NFC')),r);}catch{}}
  for(const [id,r]of readings){
   if(!validReading(id)||!['Article','Summary'].includes(r.kind))continue;
   const u=new URL(r.url,'https://lightcityfellowship.com');if(u.origin!=='https://lightcityfellowship.com'||/%2f|%5c/i.test(u.pathname))continue;
   const item={type:'reading',id,title:r.title,kind:r.kind,url:u.pathname};map.set('reading:'+id,item);
   for(const path of new Set([r.url,u.pathname,decodeURI(u.pathname)]))announcements.set(hash(path),item);
  }
  return {map,announcements};
 }
 let sentPage,sentUntil=0,sentFlight;
 async function announced(){if(sentPage&&sentUntil>now())return sentPage;if(sentFlight)return sentFlight;sentFlight=db.collection('webPushSent').orderBy('sentAt','desc').limit(100).get().then(page=>{sentPage=page;sentUntil=now()+45000;return page;});try{return await sentFlight;}finally{sentFlight=null;}}
 const lists=uid=>db.collection('churchVideoActivity/'+uid+'/playlists');
 const inbox=uid=>db.doc('churchVideoActivity/'+uid+'/settings/notifications');
 function title(value){if(typeof value!=='string')throw new fail('invalid-argument','Enter a playlist name.');const name=value.replace(/[\u0000-\u001f\u007f]/g,' ').trim();if(!name||name.length>80)throw new fail('invalid-argument','Use a playlist name between 1 and 80 characters.');return name;}
 function selected(value,access){
  if(!value||!['media','reading'].includes(value.type)||(value.type==='media'?!validVideo(value.id):!validReading(value.id))||value.type==='media'&&!['video','audio'].includes(value.mode))throw new fail('invalid-argument','Choose a valid resource.');
  const item=access.get(value.type+':'+value.id);if(!item)throw new fail('not-found','This resource is no longer available to your account.');
  return {type:item.type,id:item.id,...(item.type==='media'?{mode:value.mode}:{})};
 }
 const itemKey=item=>item.type+':'+item.id+':'+(item.mode||'reading');
 return {
  async collections(request){
   const person=await identity(request),{map}=await resources(person),page=await lists(person.uid).orderBy('updatedAt','desc').limit(100).get();
   return {playlists:page.docs.map(doc=>{const row=doc.data(),items=[];for(const stored of row.items||[]){try{const chosen=selected(stored,map),meta=map.get(chosen.type+':'+chosen.id);if(!items.some(i=>itemKey(i)===itemKey(chosen)))items.push({...meta,...chosen,url:meta.url+(chosen.mode==='audio'?'&mode=audio':'')});}catch{}}
    return {id:doc.id,name:row.name,createdAt:row.createdAt,updatedAt:row.updatedAt,items,unavailableCount:(row.items||[]).length-items.length};})};
  },
  async updateCollection(request){
   const person=await identity(request),data=request.data||{},collection=lists(person.uid);
   if(data.action==='create'){
    const name=title(data.name),existing=await collection.limit(100).get();if(existing.size>=100)throw new fail('resource-exhausted','You can have up to 100 playlists.');
    const id=randomUUID().replaceAll('-','');await collection.doc(id).set({name,items:[],createdAt:now(),updatedAt:now()});return {id};
   }
   if(!validList(data.playlistId)||!['rename','delete','add','remove'].includes(data.action))throw new fail('invalid-argument','Choose a playlist action.');
   const ref=collection.doc(data.playlistId);
   const access=['add','remove'].includes(data.action)?(await resources(person)).map:null;
   const chosen=data.action==='add'?selected(data.item,access):null;
   await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);if(!snap.exists)throw new fail('not-found','Playlist not found.');const row=snap.data();
    if(data.action==='delete'){tx.delete(ref);return;}
    if(data.action==='rename'){tx.set(ref,{...row,name:title(data.name),updatedAt:now()});return;}
    let items=(row.items||[]).map(item=>({...item,id:access?.get(item.type+':'+item.id)?.id||item.id}));
    if(data.action==='add'){if(items.some(item=>itemKey(item)===itemKey(chosen)))return;if(items.length>=200)throw new fail('resource-exhausted','A playlist can contain up to 200 resources.');items=[...items,chosen];}
    else{const value=data.item;if(!value||!['media','reading'].includes(value.type)||(value.type==='media'?!validVideo(value.id):!validReading(value.id)))throw new fail('invalid-argument','Choose the resource to remove.');items=items.filter(item=>itemKey(item)!==itemKey(value));}
    tx.set(ref,{...row,items,updatedAt:now()});
   });return {ok:true};
  },
  async notifications(request){
   const person=await identity(request,true),{announcements}=await resources(person),page=await announced();
   const ref=inbox(person.uid);const state=await db.runTransaction(async tx=>{const old=await tx.get(ref);if(old.exists)return old.data();const initial={seenThrough:now(),readIds:[]};tx.set(ref,initial);return initial;});
   const items=[];for(const doc of page.docs){const row=doc.data(),item=announcements.get(doc.id);if(!item||row.silent||row.baseline||!millis(row.sentAt))continue;items.push({...item,notificationId:doc.id,sentAt:millis(row.sentAt),read:millis(row.sentAt)<=state.seenThrough||(state.readIds||[]).includes(doc.id)});}
   return {items,unread:items.filter(item=>!item.read).length};
  },
  async updateNotifications(request){
   const person=await identity(request,true),data=request.data||{};if(!['read','readAll'].includes(data.action)||data.action==='read'&&!validReading(data.notificationId))throw new fail('invalid-argument','Choose a notification.');
   const ref=inbox(person.uid);await db.runTransaction(async tx=>{const row=(await tx.get(ref)).data()||{seenThrough:0,readIds:[]};tx.set(ref,data.action==='readAll'?{seenThrough:now(),readIds:[]}:{...row,readIds:[...new Set([...(row.readIds||[]),data.notificationId])].slice(-200)});});return {ok:true};
  }
 };
}
