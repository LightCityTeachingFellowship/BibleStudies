import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GROUPS,DEFAULT_PRAYER_SETTINGS as defaults,prayerForDate,weekOwner,instant,dateKey,prayerRange,validatePrayerSettings,contentDate,monthBounds} from '../script/prayer-calendar-core.mjs';
import {createPrayerCalendar} from './members/functions/prayer-calendar.mjs';
assert.equal(readFileSync(new URL('../script/prayer-calendar-core.mjs',import.meta.url),'utf8'),readFileSync(new URL('./members/functions/prayer-calendar-core.mjs',import.meta.url),'utf8'),'browser and deployed schedule engines stay identical');
const settings=()=>structuredClone({...defaults,leaders:{},serviceReminders:false});

assert.equal(prayerForDate('2024-01-27',settings()),null);
assert.deepEqual(prayerRange('2024-01-28','2024-02-03',settings()).map(e=>[e.date,e.group]),[['2024-01-28','MAN'],['2024-01-30','MAN'],['2024-02-01','MAN'],['2024-02-02','MAN'],['2024-02-03','MAN']]);
assert.equal(prayerForDate('2024-02-04',settings()).group,'OX');
assert.deepEqual(prayerRange('2025-07-13','2025-07-19',settings()).map(e=>e.group),['MAN','MAN','OX','LION','EAGLE']);

for(const [sunday,owner,thu,fri,sat]of [['2026-11-01','MAN','OX','LION','EAGLE'],['2026-11-08','OX','LION','EAGLE','MAN'],['2026-11-15','LION','EAGLE','MAN','OX'],['2026-11-22','EAGLE','MAN','OX','LION'],['2026-11-29','MAN','OX','LION','EAGLE']]){
 const events=prayerRange(sunday,new Date(Date.parse(sunday+'T12:00Z')+6*86400000).toISOString().slice(0,10),settings());assert.deepEqual(events.map(e=>e.group),[owner,owner,thu,fri,sat]);assert.equal(weekOwner(sunday,settings()),owner);for(const event of events)assert.equal(event.startAt,instant(event.date,defaults.times[event.group]));
}
assert.equal(weekOwner('2026-10-25',settings()),'EAGLE','negative week offsets rotate correctly');assert.equal(prayerForDate('2026-11-02',settings()),null);assert.equal(prayerForDate('2026-11-04',settings()),null);
assert.equal(prayerForDate('2026-11-06',settings()).paused,true);assert.equal(prayerForDate('2026-11-07',settings()).paused,false);
assert.equal(prayerForDate('2026-11-05',{...settings(),forceDates:['2026-11-05']}).paused,false);
assert.equal(dateKey(instant('2026-11-08','04:00'),'America/Vancouver'),'2026-11-07','viewer calendar date can differ');assert.equal(dateKey(instant('2026-11-08','20:00'),'Pacific/Kiritimati'),'2026-11-09');
for(const title of ['21 October 2018','October 21st, 2018','21st Oct. 2018','Wed, Oct 21, 2018.','2018-10-21T12:00Z'])assert.equal(contentDate(title),'2018-10-21');assert.equal(contentDate('Day 21 - John 1-4'),null);assert.equal(contentDate('Feb 29, 2025'),null);assert.equal(monthBounds('2028-02').end,'2028-02-29');
for(const change of [{anchorSunday:'2026-11-02'},{anchorGroup:'OTHER'},{times:{...defaults.times,MAN:'25:00'}},{durationMinutes:0},{pauseUntil:'2026-02-30'}])assert.throws(()=>validatePrayerSettings({...settings(),...change}));
class Fail extends Error{constructor(code,message){super(message);this.code=code;}}
const store=new Map(),calls=[],users=new Map([['admin',{displayName:'Admin',email:'admin@example.com',emailVerified:true,providerData:[{}]}],['alice',{displayName:'Alice',email:'alice@example.com',emailVerified:true,providerData:[{}]}],['bob',{displayName:'Bob',email:'bob@example.com',emailVerified:true,providerData:[{}]}],['visitor',{displayName:'Visitor',emailVerified:true,providerData:[{}]}]]);let clock=instant('2026-11-02','10:00');
const snap=path=>({id:path.split('/').at(-1),exists:store.has(path),data:()=>structuredClone(store.get(path)),ref:ref(path)});
function ref(path){return {path,get:async()=>snap(path),set:async(value,options)=>store.set(path,options?.merge?{...store.get(path),...structuredClone(value)}:structuredClone(value)),delete:async()=>store.delete(path),collection:name=>query(path+'/'+name)};}
function query(path,filters=[]){return {doc:id=>ref(path+'/'+id),limit:()=>query(path,filters),where:(key,op,value)=>query(path,[...filters,[key,op,value]]),get:async()=>{const docs=[...store.keys()].filter(p=>p.startsWith(path+'/')&&!p.slice(path.length+1).includes('/')).filter(p=>filters.every(([key,op,value])=>op==='=='?store.get(p)[key]===value:op==='>='?store.get(p)[key]>=value:store.get(p)[key]<=value)).map(snap);return {docs,size:docs.length};}};}
const db={doc:ref,collection:query,getAll:async(...refs)=>Promise.all(refs.map(r=>r.get())),runTransaction:async fn=>fn({get:r=>r.get(),set:(r,v,o)=>r.set(v,o),delete:r=>r.delete()})};
const auth={getUser:async uid=>{if(!users.has(uid))throw Error('Unknown account');return users.get(uid);}};
const api=createPrayerCalendar({db,auth,fail:Fail,emails:()=> 'admin@example.com',now:()=>clock,messaging:{sendEachForMulticast:async payload=>{calls.push(payload);return {responses:[{}]};}},recordings:async()=>[{videoId:'public00001'}],send:async()=>({ok:true,json:async()=>({publications:[{kind:'Article',title:'Older article',date:'2018-10-21',url:'/Old/'},{kind:'Summary',title:'Public summary',date:'2026-11-01',url:'/Summary/'}]})}),privateCatalog:[{kind:'Summary',title:'Private summary',date:'2026-11-01',url:'/Private/'}]});
const request=(action,data={})=>({auth:{uid:'admin'},data:{action,accountUid:'admin',...data}}),member=(uid,data={})=>({auth:{uid},data:{accountUid:uid,...data}});
store.set('churchMembers/alice',{active:true});store.set('churchMembers/bob',{active:true});store.set('churchMembers/admin',{active:true});
store.set('churchVideoLibrary/current',{videos:[{id:'public00001',title:'Public video Nov 1, 2026',visibility:'public'},{id:'private0001',title:'Private video Nov 1, 2026',visibility:'members'},{id:'shadow00001',title:'Must stay private Nov 1, 2026',visibility:'public'},{id:'shadow00001',title:'Must stay private Nov 1, 2026',visibility:'members'}]});
const emptySettings=await api.manage(request('get'));await api.manage(request('save',{expectedRevision:emptySettings.settings.revision,settings:emptySettings.settings}));assert.ok(Array.isArray(store.get('churchStudioPublications/prayer-groups/settings/current').scheduleHistory),'first settings save records the historical schedule');store.delete('churchStudioPublications/prayer-groups/settings/current');
await api.reminders();assert.equal(calls.length,0,'deployment alone sends nothing');
await assert.rejects(api.manage({data:{action:'get'}}),e=>e.code==='unauthenticated');await assert.rejects(api.manage(member('alice',{action:'get'})),e=>e.code==='permission-denied');
const publicSearch=await api.searchEvents({data:{query:'when was Private video'}});assert.equal(publicSearch.events.length,0,'public search must not reveal private video dates');
const memberSearch=await api.searchEvents(member('alice',{query:'when was Private video'}));assert.ok(memberSearch.events.some(e=>e.title==='Private video Nov 1, 2026'&&e.date==='2026-11-01'));
const publicCalendar=await api.calendar({data:{month:'2026-11'}});assert.ok(!publicCalendar.prayer);assert.ok(!publicCalendar.events.some(e=>e.kind==='Prayer'||/Private|stay private/.test(e.title)));assert.equal(publicCalendar.events.find(e=>e.kind==='Video').audioUrl,'/Watch/?v=public00001&mode=audio');
assert.ok((await api.calendar({data:{month:'2018-10'}})).events.some(e=>e.title==='Older article'),'historical publications before 2020');
await assert.rejects(api.manage(request('assign',{uid:'visitor',group:'MAN'})),e=>e.code==='permission-denied');
await api.manage(request('assign',{uid:'alice',group:'MAN',whatsapp:'+2348012345678'}));await api.manage(request('assign',{uid:'bob',group:'OX'}));let state=await api.manage(request('get'));
await api.manage(request('save',{expectedRevision:state.settings.revision,settings:{...state.settings,serviceReminders:false,leaders:{MAN:{uid:'alice',whatsapp:'+2348012345678'}}}}));
await assert.rejects(api.manage(request('save',{expectedRevision:state.settings.revision,settings:state.settings})),e=>e.code==='aborted');
assert.equal((await api.mine(member('alice'))).self.leader,true);assert.ok(!JSON.stringify(await api.mine(member('alice'))).includes('+234'),'contact numbers are not in member feed');assert.ok((await api.calendar(member('alice',{month:'2026-11'}))).events.some(e=>e.title==='Private summary'));
await assert.rejects(api.mine(member('visitor')),e=>e.code==='permission-denied');
await assert.rejects(api.manage(request('today')),e=>e.code==='failed-precondition','no Monday group');
store.set('webPushSubscribers/a',{token:'alice-token'});store.set('webPushSubscribers/b',{token:'bob-token'});store.set('webPushSubscribers/unbound',{token:'unbound-token'});store.set('churchDevices/a',{memberUid:'alice'});store.set('churchDevices/b',{memberUid:'bob'});
clock=instant('2026-11-03','19:30');await api.reminders();assert.equal(calls.length,0,'forty-day pause prevents reminders');
clock=instant('2026-11-05','17:30');const sent=await api.manage(request('today'));assert.equal(sent.group,'OX');assert.deepEqual(calls.map(c=>c.tokens[0]),['bob-token']);await api.manage(request('today'));assert.equal(calls.length,1,'send today is idempotent');
assert.ok([...store.keys()].some(k=>k.startsWith('churchVideoActivity/bob/prayerInbox/')));assert.ok(![...store.keys()].some(k=>k.startsWith('churchVideoActivity/alice/prayerInbox/')));
clock=instant('2026-11-07','18:00');await api.reminders();assert.equal(calls.at(-1).tokens[0],'bob-token');assert.match(calls.at(-1).notification.title,/OX owns/);await api.reminders();assert.equal(calls.length,2,'scheduler rerun sends no duplicates');
clock=instant('2026-11-08','17:30');await api.reminders();assert.equal(calls.at(-1).tokens[0],'bob-token');assert.match(calls.at(-1).notification.title,/OX prayer/);
clock=instant('2026-11-08','18:10');const join=await api.join(member('alice',{date:'2026-11-08',group:'OX'})).catch(e=>e);assert.equal(join.code,'failed-precondition','missing leader never invents a phone');
state=await api.manage(request('get'));await api.manage(request('save',{expectedRevision:state.settings.revision,settings:{...state.settings,leaders:{...state.settings.leaders,OX:{uid:'bob',whatsapp:'+2348099999999'}}}}));
const joined=await api.join(member('alice',{date:'2026-11-08',group:'OX'}));assert.ok(joined.url.startsWith('https://wa.me/2348099999999?text='));assert.match(decodeURIComponent(joined.url),/Alice/);
store.set('churchMembers/bob',{active:false});await assert.rejects(api.join(member('alice',{date:'2026-11-08',group:'OX'})),e=>e.code==='failed-precondition');store.set('churchMembers/bob',{active:true});
await api.manage(request('assign',{uid:'alice',group:'EAGLE'}));state=await api.manage(request('get'));assert.ok(!state.settings.leaders.MAN,'moving a leader clears stale leadership');
let dateRequests=0;const dateApi=()=>createPrayerCalendar({db,auth,fail:Fail,now:()=>clock,youtubeKey:()=> 'test-key',send:async address=>{if(String(address).startsWith('https://www.googleapis.com/')){dateRequests++;assert.equal(new URL(address).searchParams.get('id'),'undated0001');return {ok:true,json:async()=>({items:[{id:'undated0001',snippet:{publishedAt:'2018-10-20T23:30:00Z'}}]})};}return {ok:true,json:async()=>({publications:[]})};}});
store.set('churchVideoLibrary/current',{videos:[{id:'undated0001',title:'Undated public recording',visibility:'public'},{id:'secretdate1',title:'Undated private recording',visibility:'members'},{id:'titled00001',title:'Recording Oct 21, 2018',publishedAt:'2026-11-01T00:00:00Z',visibility:'public'}]});
const dated=await dateApi().calendar({data:{month:'2018-10'}});assert.equal(dated.events.filter(e=>e.kind==='Video').length,2);assert.equal(dated.events.find(e=>e.id==='video-undated0001').date,'2018-10-21');assert.equal(dateRequests,1);await dateApi().calendar({data:{month:'2018-10'}});assert.equal(dateRequests,1,'persistent dates survive function restarts without another lookup');
// The morning reminder uses Nigeria time, targets only the assigned group,
// is delivered to the member inbox, and is idempotent across scheduler runs.
clock=instant('2026-11-13','08:59');const beforeMorning=calls.length;await api.reminders();assert.equal(calls.length,beforeMorning,'morning reminder is not early');
clock=instant('2026-11-13','09:00');await api.reminders();assert.equal(calls.length,beforeMorning+1);assert.equal(calls.at(-1).tokens[0],'alice-token');assert.match(calls.at(-1).notification.title,/EAGLE group prayer today/);assert.match(calls.at(-1).notification.body,/scheduled to pray today/);assert.ok([...store.entries()].some(([key,value])=>key.startsWith('churchVideoActivity/alice/prayerInbox/')&&value.title==='EAGLE group prayer today'));await api.reminders();assert.equal(calls.length,beforeMorning+1,'morning reminder does not duplicate');
clock=instant('2026-11-13','15:30');await api.reminders();assert.equal(calls.length,beforeMorning+2,'the existing 30-minute reminder remains separate');
clock=instant('2026-11-14','09:00');const settingsPath='churchStudioPublications/prayer-groups/settings/current',beforePause=structuredClone(store.get(settingsPath));store.set(settingsPath,{...beforePause,paused:true});await api.reminders();assert.equal(calls.length,beforeMorning+2,'paused group prayer sends no morning reminder');store.set(settingsPath,beforePause);
console.log('PASS: complete rotation, per-group hours, pauses, local dates, historical contents, access control, contacts, leader moves, revisions, targeted reminders, account inbox, manual override and scheduler deduplication.');

clock=instant('2026-11-23','12:00');
const historical=await api.calendar(member('alice',{month:'2024-01'}));
assert.ok(historical.events.some(e=>e.kind==='Prayer'&&e.date==='2024-01-28'&&e.group==='MAN'&&e.historical&&!e.startAt),'historical prayer begins on January 28 with no invented time');
assert.ok(!historical.events.some(e=>e.kind==='Prayer'&&e.date<'2024-01-28'));
const july=await api.calendar(member('alice',{month:'2025-07'}));
assert.deepEqual(july.events.filter(e=>e.kind==='Prayer'&&e.date>='2025-07-13'&&e.date<='2025-07-19').map(e=>e.group),['MAN','MAN','OX','LION','EAGLE']);
assert.ok(!((await api.calendar({data:{month:'2024-01'}})).events.some(e=>e.kind==='Prayer')),'prayer history stays member-only');
const beforeRevision=await api.manage(request('get'));await api.manage(request('save',{expectedRevision:beforeRevision.settings.revision,settings:{...beforeRevision.settings,anchorGroup:'OX'}}));
const afterRevision=await api.calendar(member('alice',{month:'2025-07'}));assert.equal(afterRevision.events.find(e=>e.kind==='Prayer'&&e.date==='2025-07-13').group,'MAN','later settings changes do not rewrite previous prayer days');
const search=await api.searchEvents(member('alice',{query:'when was prayer groups started'}));assert.equal(search.events[0].date,'2024-01-28');
console.log('PASS: historical calendar ranges and schedule changes.');

// Communion reminders go only to approved members and are deduplicated.
clock=instant('2026-12-20','10:00');
store.set('churchServiceSchedule/current',{heading:'Welcome',message:'Welcome',startingMessage:'Starting',holdMinutes:30,weekly:[],monthly:[{id:'communion',name:'Communion',nth:3,day:1,time:'18:00',enabled:true,replaceWeekly:true}],override:null,programme:null});
await assert.rejects(api.manage(member('alice',{action:'communion-send'})),e=>e.code==='permission-denied');
await api.manage(request('communion-schedule',{date:'2026-12-22'}));
clock=instant('2026-12-21','08:59');let beforeCommunion=calls.length;await api.reminders();assert.equal(calls.length,beforeCommunion);
clock=instant('2026-12-21','09:00');await api.reminders();assert.deepEqual(calls.slice(beforeCommunion).map(c=>c.tokens[0]).sort(),['alice-token','bob-token']);assert.ok(calls.slice(beforeCommunion).every(c=>c.notification.title==='Communion service today'));await api.reminders();assert.equal(calls.length,beforeCommunion+2);
clock=instant('2026-12-22','09:00');beforeCommunion=calls.length;await api.reminders();assert.equal(calls.length,beforeCommunion+2,'additional date sends at 9 a.m.');await api.manage(request('communion-send'));assert.equal(calls.length,beforeCommunion+2,'manual send cannot duplicate a reminder already sent');
clock=instant('2026-12-23','12:00');beforeCommunion=calls.length;await api.manage(request('communion-send'));assert.equal(calls.length,beforeCommunion+2,'manual reminder reaches members');await assert.rejects(api.manage(request('communion-schedule',{date:'2026-12-23'})),e=>e.code==='invalid-argument');
console.log('PASS: communion reminders, member privacy, additional dates, timing and deduplication.');

const defaultCommunion=await api.manage(request('communion-settings-get'));
assert.equal(defaultCommunion.settings.body,'We shall eat and drink of the body and blood of our LORD today. God God bless us greatly');
await assert.rejects(api.manage(member('alice',{action:'communion-settings-save',title:'Test',body:'Test'})),e=>e.code==='permission-denied');
await assert.rejects(api.manage(request('communion-settings-save',{title:'',body:'Test'})),e=>e.code==='invalid-argument');
await api.manage(request('communion-settings-save',{title:'Special Communion',body:'Please prepare.'}));
clock=instant('2026-12-24','12:00');beforeCommunion=calls.length;await api.manage(request('communion-send'));assert.equal(calls.length,beforeCommunion+2);assert.ok(calls.slice(beforeCommunion).every(c=>c.notification.title==='Special Communion'&&c.notification.body==='Please prepare.'));
assert.equal((await api.manage(request('communion-settings-get'))).settings.title,'Special Communion');
console.log('PASS: communion wording defaults, edits, validation and authorization.');
