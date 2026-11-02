export const GROUPS=['MAN','OX','LION','EAGLE'];
export const DAY=86400000,ZONE='Africa/Lagos';
export const DEFAULT_PRAYER_SETTINGS={revision:'initial',anchorSunday:'2026-11-01',anchorGroup:'MAN',times:{MAN:'20:00',OX:'18:00',LION:'20:00',EAGLE:'16:00'},durationMinutes:60,weeklyReminderTime:'18:00',paused:false,pauseUntil:'2026-11-06',serviceReminders:true,forceDates:[]};
export function dateKey(instant,zone=ZONE){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant));}
export function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const t=Date.parse(value+'T12:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===value&&value>='1900-01-01'&&value<='2100-12-31';}
export const instant=(date,time)=>Date.parse(date+'T'+time+':00+01:00');
export const addDays=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*DAY).toISOString().slice(0,10);
export const weekday=date=>new Date(date+'T12:00:00Z').getUTCDay();
export function weekOwner(date,settings){const sunday=addDays(date,-weekday(date)),weeks=Math.round((Date.parse(sunday+'T12:00:00Z')-Date.parse(settings.anchorSunday+'T12:00:00Z'))/(7*DAY));return GROUPS[((GROUPS.indexOf(settings.anchorGroup)+weeks)%4+4)%4];}
export function prayerForDate(date,settings){const day=weekday(date);if(day===1||day===3)return null;const owner=weekOwner(date,settings),offset=day===0||day===2?0:day-3,group=GROUPS[(GROUPS.indexOf(owner)+offset)%4],startAt=instant(date,settings.times[group]);return {id:'prayer-'+date,kind:'Prayer',title:group+' group prayer',date,group,owner,startAt,endAt:startAt+settings.durationMinutes*60000,paused:prayerPaused(date,settings)};}
export function prayerPaused(date,settings){return !settings.forceDates?.includes(date)&&(settings.paused||!!settings.pauseUntil&&date<=settings.pauseUntil);}
export function prayerRange(start,end,settings){const result=[];for(let d=start;d<=end;d=addDays(d,1)){const event=prayerForDate(d,settings);if(event)result.push(event);}return result;}
export function validatePrayerSettings(value){
 const time=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
 if(!value||!validDate(value.anchorSunday)||weekday(value.anchorSunday)!==0||!GROUPS.includes(value.anchorGroup))throw Error('Choose a Sunday and the group owning that week.');
 if(!value.times||GROUPS.some(g=>!time(value.times[g]))||!time(value.weeklyReminderTime))throw Error('Check the Nigeria prayer times and Saturday reminder time.');
 if(!Number.isInteger(value.durationMinutes)||value.durationMinutes<15||value.durationMinutes>360)throw Error('Choose a prayer duration from 15 to 360 minutes.');
 if(typeof value.paused!=='boolean'||typeof value.serviceReminders!=='boolean'||value.pauseUntil&&!validDate(value.pauseUntil))throw Error('Check the reminder pause settings.');
 return {anchorSunday:value.anchorSunday,anchorGroup:value.anchorGroup,times:Object.fromEntries(GROUPS.map(g=>[g,value.times[g]])),durationMinutes:value.durationMinutes,weeklyReminderTime:value.weeklyReminderTime,paused:value.paused,pauseUntil:value.pauseUntil||'',serviceReminders:value.serviceReminders};
}
export function contentDates(...values) {
  const dates=new Set();
  const add=(year,month,day)=>{year=Number(year);month=Number(month);day=Number(day);if(year<1000||year>2999||month<1||month>12||day<1||day>31)return;const value=new Date(Date.UTC(year,month-1,day));if(value.getUTCFullYear()===year&&value.getUTCMonth()===month-1&&value.getUTCDate()===day)dates.add(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`);};
  const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const month='(January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sept|Sep|October|Oct|November|Nov|December|Dec)\\.?';
  for(const value of values){if(typeof value!=='string')continue;
    for(const match of value.matchAll(/\b([12]\d{3})-(\d{2})-(\d{2})(?=T\d{2}:|\b)/g))add(match[1],match[2],match[3]);
    for(const match of value.matchAll(new RegExp('\\b'+month+'\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+)([12]\\d{3})\\b','gi')))add(match[3],months.indexOf(match[1].slice(0,3).toLowerCase())+1,match[2]);
    for(const match of value.matchAll(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+'+month+'(?:,?\\s+)([12]\\d{3})\\b','gi')))add(match[3],months.indexOf(match[2].slice(0,3).toLowerCase())+1,match[1]);
  }
  return dates;
}
export function contentDate(value){return [...contentDates(value)].find(validDate)||null;}
export function monthBounds(month){if(!/^(?:19|20)\d{2}-\d{2}$/.test(month||'')||!validDate(month+'-01'))throw Error('Choose a valid month.');const [y,m]=month.split('-').map(Number);return {start:month+'-01',end:new Date(Date.UTC(y,m,0,12)).toISOString().slice(0,10)};}
