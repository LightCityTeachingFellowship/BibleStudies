// Studio entries stay authoritative until a GitHub build has observed their ID.
// Later deliberate source-file removals/replacements can then retire them.
export function mergeStudioVideos(source, studio = {}, { pending = false, sourceIds } = {}) {
 const removed=new Set((studio.removed||[]).map(r=>r.id));
 source=source.filter(v=>!removed.has(v.id));
 const ids = new Set(sourceIds || source.map(v => v.id));
 const extras = (studio.entries || []).filter(e => !removed.has(e.video.id) && (pending || e.state === 'ready') && (!e.sourceSeen || ids.has(e.video.id)));
 const overrides = new Map(extras.filter(e=>!e.sourceSeen).map(e => [e.video.id, e.video]));
 const aliases = new Set(extras.flatMap(e => e.video.replaces || []));
 // A replacement occupies its original video's slot, even in a stale build.
 const replacing = new Map();
 for (const entry of extras) for (const alias of entry.video.replaces || []) if (!replacing.has(alias)) replacing.set(alias, entry.video);
 const slotted = new Set();
 const existing = source.flatMap(v => {
  const replacement = replacing.get(v.id);
  if (replacement) { if (slotted.has(replacement.id)) return []; slotted.add(replacement.id); return [replacement]; }
  if (aliases.has(v.id)) return [];
  slotted.add(v.id); return [overrides.has(v.id) ? {...v,...overrides.get(v.id)} : v];
 });
 const fresh = extras.filter(e => !ids.has(e.video.id) && !aliases.has(e.video.id) && !slotted.has(e.video.id)).sort((a,b) => b.createdAt-a.createdAt);
 const rows = [...existing];
 for (const entry of [...fresh].reverse()) {
  const before = rows.findIndex(v => v.id === entry.placement?.beforeId);
  const after = rows.findIndex(v => v.id === entry.placement?.afterId);
  const index = before >= 0 ? before : after >= 0 ? after+1 : Number.isInteger(entry.placement?.index) ? Math.min(entry.placement.index, rows.length) : 0;
  rows.splice(index,0,entry.video);
 }
 return [...new Map(rows.map(v => [v.id,v])).values()];
}
export function acknowledgeStudio(studio, sourceIds) {
 const ids = new Set(sourceIds);
 return {...studio,entries:(studio.entries || []).filter(e => !e.sourceSeen || ids.has(e.video.id)).map(e => ({...e,sourceSeen:e.sourceSeen || ids.has(e.video.id)}))};
}
export const shareVideoUrl=(id,audio=false)=>`https://auth.lightcityfellowship.com/Share/${audio?'Audio':'Video'}/${id}/`;
export async function publicVideoLibrary(db) {
 const snapshot=await db.doc('churchVideoLibrary/current').get();
 if(!Array.isArray(snapshot.data()?.videos))throw Error('Video library unavailable');
 return snapshot.data().videos.filter(v=>v.visibility==='public').map(({replaces=[],replacementVisibility={},...v})=>{
  const safe=replaces.filter(id=>replacementVisibility[id]==='public');return {...v,replaces:safe,replacementVisibility:Object.fromEntries(safe.map(id=>[id,'public']))};
 });
}