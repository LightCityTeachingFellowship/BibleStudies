// Scheduled announcements use Nigeria local time, consistently with service schedules.
const DAY=86400000, HOUR=3600000;
function localDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw Error('Choose a valid date.');
 const d=new Date(value+'T00:00:00Z');if(!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==value)throw Error('Choose a valid date.');return d;
}
export function validateNotificationSchedule(input){
 if(!input||!['once','daily','weekly','monthly'].includes(input.frequency))throw Error('Choose a schedule.');
 const start=localDate(input.startDate);if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time||''))throw Error('Choose a valid time.');
 const end=input.endDate?localDate(input.endDate):null;if(end&&end<start)throw Error('The end date must follow the start date.');
 return {frequency:input.frequency,startDate:input.startDate,time:input.time,endDate:input.endDate||''};
}
// A monthly schedule runs only in months containing its chosen date.
export function notificationOccurrence(schedule,instant){
 const s=validateNotificationSchedule(schedule),local=new Date(instant+HOUR),date=local.toISOString().slice(0,10),time=local.toISOString().slice(11,16);
 if(date<s.startDate||(s.endDate&&date>s.endDate)||time!==s.time)return null;
 const start=localDate(s.startDate),day=localDate(date),difference=Math.round((day-start)/DAY);
 if(s.frequency==='once'&&difference!==0||s.frequency==='weekly'&&difference%7!==0||s.frequency==='monthly'&&day.getUTCDate()!==start.getUTCDate())return null;
 return date+'T'+s.time;
}
