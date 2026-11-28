// Studio shows newest generated work first, with a stable order for older records.
export function filterLearningResources(resources,filter='all'){
 const list=(resources||[]).filter(r=>!r.legacy).filter(r=>filter==='all'||filter==='summary'&&r.kind==='Summary'||filter==='quiz'&&r.kind==='Quiz'||filter==='draft'&&['draft','approved'].includes(r.state)||filter==='processing'&&r.state==='awaiting-draft'||filter==='published'&&r.state==='published');
 const time=r=>Number.isFinite(Number(r.createdAt))&&Number(r.createdAt)>0?Number(r.createdAt):Number(r.publishedAt)||Number(r.teachingEndedAt)||Date.parse(r.teachingDate||'')||0;
 return list.sort((a,b)=>time(b)-time(a)||String(a.title||'').localeCompare(String(b.title||''),undefined,{numeric:true})||String(a.id||'').localeCompare(String(b.id||'')));
}
