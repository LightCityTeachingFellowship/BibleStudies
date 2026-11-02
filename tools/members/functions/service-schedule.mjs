import {randomUUID} from 'node:crypto';
import {requireStudioAdmin} from './studio-publishing.mjs';
export const NIGERIA_ZONE='Africa/Lagos';
const HOUR=3600000,DAY=24*HOUR;
export const DEFAULT_SERVICE_SCHEDULE={
 revision:'initial',heading:'Welcome to church.',message:'We’re glad you’re here. Let’s prepare our hearts for worship.',startingMessage:'We’re starting shortly.',holdMinutes:30,
 weekly:[{id:'sunday',day:0,time:'08:00',name:'Sunday Fellowship',enabled:true},{id:'monday',day:1,time:'18:00',name:'Prayer Meeting',enabled:true},{id:'wednesday',day:3,time:'17:30',name:'Bible Study',enabled:true}],monthly:[],override:null,programme:null
};
function text(value,max,label){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error('Enter a valid '+label+'.');return value.trim();}
export function nigeriaInstant(local){
 const m=String(local).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);if(!m)throw Error('Choose a valid Nigeria date and time.');
 const [y,mo,d,h,mi]=m.slice(1).map(Number),date=new Date(Date.UTC(y,mo-1,d,h,mi));
 if(y<2020||y>2100||date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d||h>23||mi>59)throw Error('Choose a valid Nigeria date and time.');
 return date.getTime()-HOUR;
}
export function validateServiceSchedule(value){
 if(!value||!Array.isArray(value.weekly)||value.weekly.length>14)throw Error('Use up to 14 weekly service times.');
 const ids=new Set(),weekly=value.weekly.map(row=>{
  if(!row||!Number.isInteger(row.day)||row.day<0||row.day>6||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)||typeof row.enabled!=='boolean'||!/^[-\w]{1,60}$/.test(row.id||'')||ids.has(row.id))throw Error('Check each service day and time.');
  ids.add(row.id);return {id:row.id,day:row.day,time:row.time,name:text(row.name,80,'service name'),enabled:row.enabled};
 });
 if(value.monthly!==undefined&&(!Array.isArray(value.monthly)||value.monthly.length>24))throw Error('Use up to 24 monthly meetings.');
 const monthly=(value.monthly||[]).map(row=>{
  if(!row||!Number.isInteger(row.day)||row.day<0||row.day>6||![1,2,3,4,5,-1].includes(row.nth)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)||typeof row.enabled!=='boolean'||typeof row.replaceWeekly!=='boolean'||!/^[-\w]{1,60}$/.test(row.id||'')||ids.has(row.id))throw Error('Check each monthly meeting, week and time.');
  ids.add(row.id);return {id:row.id,day:row.day,nth:row.nth,time:row.time,name:text(row.name,80,'monthly meeting name'),enabled:row.enabled,replaceWeekly:row.replaceWeekly};
 });
 if(!Number.isInteger(value.holdMinutes)||value.holdMinutes<5||value.holdMinutes>180)throw Error('Keep the starting message for 5 to 180 minutes.');
 let override=null;if(value.override){override={name:text(value.override.name,80,'one-time service name'),local:text(value.override.local,16,'one-time service time')};nigeriaInstant(override.local);}
 let programme=null;if(value.programme){
  const p=value.programme;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(p.startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(p.endDate)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time))throw Error('Choose the programme start date, end date and daily Nigeria time.');
  const first=nigeriaInstant(p.startDate+'T00:00'),last=nigeriaInstant(p.endDate+'T00:00');
  if(last<first||last-first>365*DAY)throw Error('The programme end date must be on or after its start date, within a year.');
  if(p.exceptions!==undefined&&(!Array.isArray(p.exceptions)||p.exceptions.length>366))throw Error('Use one time change per programme date.');
  const dates=new Set(),exceptions=(p.exceptions||[]).map(row=>{
   if(!row||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)||dates.has(row.date))throw Error('Check each programme time change; dates must be unique.');
   const instant=nigeriaInstant(row.date+'T00:00');if(instant<first||instant>last)throw Error('Each time change must be within the programme dates.');
   dates.add(row.date);return {date:row.date,time:row.time};
  }).sort((a,b)=>a.date.localeCompare(b.date));
  programme={name:text(p.name,80,'programme name'),startDate:p.startDate,endDate:p.endDate,time:p.time,exceptions};
 }
 return {heading:text(value.heading,100,'welcome heading'),message:text(value.message,240,'welcome message'),startingMessage:text(value.startingMessage,100,'starting message'),holdMinutes:value.holdMinutes,weekly,monthly,override,programme};
}
function programmeTime(programme,date){return programme.exceptions?.find(row=>row.date===date)?.time||programme.time;}
function monthlyDate(year,month,row){
 const last=new Date(Date.UTC(year,month+1,0)).getUTCDate(),firstDay=new Date(Date.UTC(year,month,1)).getUTCDay();
 const date=row.nth===-1?last-(new Date(Date.UTC(year,month,last)).getUTCDay()-row.day+7)%7:1+(row.day-firstDay+7)%7+(row.nth-1)*7;
 return date<=last?Date.UTC(year,month,date):null;
}
export function nextService(schedule,now=Date.now()){
 const hold=schedule.holdMinutes*60000;
 if(schedule.override){const startAt=nigeriaInstant(schedule.override.local);if(startAt+hold>now)return {name:schedule.override.name,startAt,oneTime:true};}
 const programme=schedule.programme;
 if(programme){
  const begins=nigeriaInstant(programme.startDate+'T00:00'),last=nigeriaInstant(programme.endDate+'T'+programmeTime(programme,programme.endDate)),ends=last+hold;
  if(now<ends){
   let startAt;
   for(let day=begins;day<=nigeriaInstant(programme.endDate+'T00:00');day+=DAY){
    const date=new Date(day+HOUR).toISOString().slice(0,10),candidate=nigeriaInstant(date+'T'+programmeTime(programme,date));
    if(candidate+hold>now){startAt=candidate;break;}
   }
   if(now>=begins)return {name:programme.name,startAt,oneTime:false,programme:true};
   const regular=nextService({...schedule,programme:null},now);
   if(!regular||regular.startAt>=begins)return {name:programme.name,startAt,oneTime:false,programme:true};
   return regular;
  }
 }
 const nigeria=new Date(now+HOUR),midnight=Date.UTC(nigeria.getUTCFullYear(),nigeria.getUTCMonth(),nigeria.getUTCDate());
 const monthly=(schedule.monthly||[]).filter(row=>row.enabled),monthlyChoices=[],replacedDates=new Set();
 // Include this month and a full following year, including fifth-weekday gaps.
 for(let offset=0;offset<=13;offset++)for(const row of monthly){
  const date=monthlyDate(nigeria.getUTCFullYear(),nigeria.getUTCMonth()+offset,row);if(date===null)continue;
  if(row.replaceWeekly)replacedDates.add(date);
  const [hour,minute]=row.time.split(':').map(Number),startAt=date+hour*HOUR+minute*60000-HOUR;
  if(startAt+hold>now)monthlyChoices.push({name:row.name,startAt,oneTime:false,monthly:true});
 }
 const choices=schedule.weekly.filter(v=>v.enabled).map(row=>{
  const [hour,minute]=row.time.split(':').map(Number);
  let startAt=midnight+((row.day-nigeria.getUTCDay()+7)%7)*DAY+hour*HOUR+minute*60000-HOUR;
  if(startAt+hold<=now)startAt+=7*DAY;
  while(replacedDates.has(Math.floor((startAt+HOUR)/DAY)*DAY))startAt+=7*DAY;
  return {name:row.name,startAt,oneTime:false};
 });
 return [...monthlyChoices,...choices].sort((a,b)=>a.startAt-b.startAt)[0]||null;
}
export function createServiceSchedule(deps){
 const {db,fail,now=Date.now}=deps,ref=()=>db.doc('churchServiceSchedule/current');let cached=null,until=0;
 async function load(){if(cached&&until>now())return cached;const snapshot=await ref().get();cached=snapshot.exists?{...validateServiceSchedule(snapshot.data()),revision:snapshot.data().revision}:structuredClone(DEFAULT_SERVICE_SCHEDULE);until=now()+10000;return cached;}
 return {
  async publicSchedule(){const schedule=await load(),serverNow=now();return {schedule,next:nextService(schedule,serverNow),serverNow,timeZone:NIGERIA_ZONE};},
  async manage(request){
   await requireStudioAdmin(request,deps);
   if(request.data?.action==='get')return {schedule:await load(),serverNow:now()};
   if(request.data?.action!=='save')throw new fail('invalid-argument','Choose a schedule action.');
   let input;try{input=validateServiceSchedule(request.data.schedule);}catch(error){throw new fail('invalid-argument',error.message);}
   if(input.override&&(nigeriaInstant(input.override.local)+input.holdMinutes*60000<=now()||nigeriaInstant(input.override.local)>now()+366*DAY))throw new fail('invalid-argument','Choose a future or currently starting one-time service within the next year.');
   if(input.programme&&nigeriaInstant(input.programme.endDate+'T'+programmeTime(input.programme,input.programme.endDate))>now()+366*DAY)throw new fail('invalid-argument','Choose programme dates within the next year.');
   const schedule=await db.runTransaction(async tx=>{const old=await tx.get(ref());if((old.data()?.revision||'initial')!==request.data.expectedRevision)throw new fail('aborted','The schedule changed on another device. Reload it before saving.');const value={...input,revision:randomUUID(),updatedAt:now()};tx.set(ref(),value);return value;});
   cached=schedule;until=now()+10000;return {schedule,serverNow:now()};
  }
 };
}
