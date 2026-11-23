import {randomUUID} from 'node:crypto';
import {requireStudioAdmin} from './studio-publishing.mjs';
import {validDate} from './prayer-calendar-core.mjs';

const START={id:'prayer-groups-start',date:'2024-01-28',title:'Prayer groups started',description:'The prayer groups began with MAN.',keywords:'prayer groups started beginning founded',visibility:'members',kind:'Event'};
const normalize=value=>String(value||'').toLocaleLowerCase('en').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\b(born|birthdays?|births)\b/g,'birth').replace(/\b(groups)\b/g,'group').replace(/\b(started|starting|began|beginning)\b/g,'start').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const stop=new Set(['when','was','were','is','the','a','an','did','on','what','date','of','for','please','tell','me','about']);
export function matchesCalendarQuestion(event,question){const terms=normalize(question).split(/\s+/).filter(x=>x&&!stop.has(x));if(!terms.length)return false;const words=normalize([event.title,event.description,event.keywords].join(' '));return terms.every(term=>words.split(' ').some(word=>word===term));}
export function createCalendarEvents(deps){
 const {db,auth,fail,now=Date.now}=deps,collection=()=>db.collection('churchStudioPublications/calendar/events');
 async function member(request){const uid=request.auth?.uid;if(!uid)return false;if(request.data?.accountUid!==uid)throw new fail('permission-denied','Your account changed. Refresh and try again.');const [user,record]=await Promise.all([auth.getUser(uid),db.doc('churchMembers/'+uid).get()]);return !user.disabled&&user.emailVerified&&user.providerData?.length&&record.data()?.active===true;}
 const visible=(row,isMember)=>row.visibility==='public'||isMember&&row.visibility==='members';
 const sanitize=(id,row)=>({id,kind:'Event',title:row.title,date:row.date,description:row.description||'',visibility:row.visibility});
 async function all(isMember=true){const query=isMember?collection():collection().where('visibility','==','public');const snapshot=await query.limit(5001).get();if(snapshot.docs.length>5000)throw new fail('resource-exhausted','There are too many events to search at once.');return snapshot.docs.map(d=>({id:d.id,...d.data()})).filter(x=>validDate(x.date)&&typeof x.title==='string'&&['members','public'].includes(x.visibility));}
 return {
  async range(isMember,start,end){const snapshot=await collection().where('date','>=',start).where('date','<=',end).limit(1001).get();if(snapshot.docs.length>1000)throw new fail('resource-exhausted','Too many calendar events in this month.');const rows=snapshot.docs.map(d=>({id:d.id,...d.data()})).filter(r=>validDate(r.date)&&typeof r.title==='string');return [...rows,...(isMember?[START]:[])].filter(r=>visible(r,isMember)&&r.date>=start&&r.date<=end).map(r=>sanitize(r.id,r));},
  async search(request){const isMember=await member(request),question=String(request.data?.query||'').trim();if(question.length<2||question.length>180)throw new fail('invalid-argument','Enter a question or event name.');const rows=await all(!!isMember);return {events:[...rows,...(isMember?[START]:[])].filter(r=>visible(r,isMember)&&matchesCalendarQuestion(r,question)).sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title)).slice(0,30).map(r=>sanitize(r.id,r))};},
  async manage(request){await requireStudioAdmin(request,deps);const data=request.data||{};
   if(data.action==='list')return {events:(await all()).map(r=>({...sanitize(r.id,r),keywords:r.keywords||'',revision:r.revision||''})).sort((a,b)=>b.date.localeCompare(a.date))};
   if(data.action==='save'){
    const event=data.event||{},title=String(event.title||'').trim(),description=String(event.description||'').trim(),keywords=String(event.keywords||'').trim(),visibility=event.visibility||'members',id=event.id||randomUUID();
    if(!/^[\w-]{1,80}$/.test(id)||!validDate(event.date)||!title||title.length>160||description.length>1000||keywords.length>500||!['members','public'].includes(visibility))throw new fail('invalid-argument','Check the event title, date, audience and text lengths.');
    const ref=collection().doc(id);await db.runTransaction(async tx=>{const prior=await tx.get(ref);if(prior.exists&&(!event.id||event.revision!==prior.data()?.revision))throw new fail('aborted','This event changed on another device. Reload it first.');if(event.id&&!prior.exists)throw new fail('not-found','This event no longer exists.');tx.set(ref,{title,date:event.date,description,keywords,visibility,revision:randomUUID(),updatedAt:now()});});return {ok:true};
   }
   if(data.action==='delete'){if(!/^[\w-]{1,80}$/.test(data.id||''))throw new fail('invalid-argument','Choose an event.');const ref=collection().doc(data.id);await db.runTransaction(async tx=>{const prior=await tx.get(ref);if(!prior.exists||prior.data()?.revision!==data.revision)throw new fail('aborted','This event changed. Reload before deleting.');tx.delete(ref);});return {ok:true};}
   throw new fail('invalid-argument','Choose a calendar action.');
  }
 };
}
