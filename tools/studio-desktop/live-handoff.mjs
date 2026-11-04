export function validBroadcast(row,now=Date.now()){
 const b=row?.broadcast;if(row?.version!==1||!Number.isFinite(row.updatedAt)||now-row.updatedAt>30000||row.updatedAt>now+5000||!/^stream-\d{13}$/.test(b?.session||'')||!Number.isFinite(b.startedAt)||b.startedAt>now+5000||now-b.startedAt>57600000)return null;
 try{const u=new URL(b.url);if(u.origin!=='https://youtube.com'||u.pathname!=='/watch'||!/^[-\w]{11}$/.test(u.searchParams.get('v')||'')||[...u.searchParams.keys()].some(k=>k!=='v'))return null;return {session:b.session,url:u.href,startedAt:b.startedAt};}catch{return null;}
}
