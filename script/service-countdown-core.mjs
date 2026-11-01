export const NIGERIA_ZONE='Africa/Lagos';
export function viewerTimeZone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||NIGERIA_ZONE;}catch{return NIGERIA_ZONE;}}
export function offsetAt(instant,timeZone){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant));
 const values=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
 return Date.UTC(values.year,values.month-1,values.day,values.hour,values.minute,values.second)-Math.floor(instant/1000)*1000;
}
export function serviceClocks(instant,timeZone=viewerTimeZone(),locale){
 let zone=timeZone;try{offsetAt(instant,zone);}catch{zone=NIGERIA_ZONE;}
 const same=offsetAt(instant,zone)===offsetAt(instant,NIGERIA_ZONE);
 const format=z=>new Intl.DateTimeFormat(locale,{timeZone:z,weekday:'long',day:'numeric',month:'long',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(instant));
 return {primary:{label:same?'Service time':'Your time',zone,text:format(zone)},nigeria:same?null:{label:'Nigeria time',zone:NIGERIA_ZONE,text:format(NIGERIA_ZONE)}};
}
export function countdownParts(startAt,now){
 const seconds=Math.max(0,Math.ceil((startAt-now)/1000));
 return {days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),minutes:Math.floor(seconds%3600/60),seconds:seconds%60,started:startAt<=now};
}
