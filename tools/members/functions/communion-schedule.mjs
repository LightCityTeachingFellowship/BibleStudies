import {nextService,nigeriaInstant} from './service-schedule.mjs';

// Follow the actual countdown schedule, including temporary replacements.
export function communionServiceOn(schedule,date){
 const start=nigeriaInstant(date+'T00:00'), end=start+86400000;
 let cursor=start;
 for(let count=0;count<32;count++){
  const service=nextService(schedule,cursor);
  if(!service||service.startAt>=end)return null;
  if(service.startAt>=start&&/\bcommunion\b/i.test(service.name))return service;
  cursor=Math.max(cursor+1,service.startAt+schedule.holdMinutes*60000);
 }
 return null;
}
