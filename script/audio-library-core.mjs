const valid=id=>/^[\w-]{11}$/.test(id||'');
export const audioCategories={Sunday:'Sunday Fellowship',Meeting:'Prayer Meeting',Study:'Bible Study',Program:'Programs',Ceremonies:'Ceremonies',Excerpts:'Excerpts'};
function category(title){if(/excerpt/i.test(title))return'Excerpts';if(/ceremon|wedding|burial|funeral/i.test(title))return'Ceremonies';if(/sunday fellowship/i.test(title))return'Sunday';if(/prayer meeting/i.test(title))return'Meeting';if(/bible study/i.test(title))return'Study';return'Program';}
export function audioLibrary({publicVideos=[],memberVideos=null,recordings=[],live=[],now=Date.now()}){
 const source=Array.isArray(memberVideos)?memberVideos:publicVideos,allowed=new Map(source.filter(v=>valid(v.id)).map(v=>[v.id,v]));
 const available=new Map(recordings.filter(r=>valid(r.videoId)&&allowed.has(r.videoId)).map(r=>[r.videoId,r]));
 for(const r of live)if(valid(r.videoId)&&allowed.has(r.videoId)&&r.kind==='live'&&/^session-\d{13}$/.test(r.session||'')&&Number.isFinite(r.offsetSeconds)&&r.expiresAt>now){if(r.replay!==true||!available.has(r.videoId))available.set(r.videoId,r);}
 return [...allowed].flatMap(([id,metadata])=>{const r=available.get(id);if(!r)return[];const title=metadata.title&&metadata.title!==id?metadata.title:typeof r.title==='string'&&r.title!==id?r.title:'LightCity recording';return[{...r,videoId:id,title,category:audioCategories[metadata.category]?metadata.category:category(title)}];});
}
export function filterAudio(rows,query='',category='all'){
 const normal=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const terms=normal(query).trim().split(/\s+/).filter(Boolean);
 return rows.filter(r=>(category==='all'||r.category===category)&&terms.every(t=>normal(r.title).includes(t)));
}
