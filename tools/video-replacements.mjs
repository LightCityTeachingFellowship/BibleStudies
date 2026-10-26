import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const valid=id=>typeof id==='string'&&/^[\w-]{11}$/.test(id);
export function validateReplacements(rows){
 if(!Array.isArray(rows))throw Error('Video replacements must be a list.');const sources=new Set();
 for(const row of rows){if(!valid(row.from)||!valid(row.to)||row.from===row.to||sources.has(row.from)||!['public','members'].includes(row.visibility))throw Error('Invalid or duplicate video replacement.');sources.add(row.from);}
 if(rows.some(row=>sources.has(row.to)))throw Error('Replacement destinations must point directly to the final video. Use the replacement helper to update a video again.');
 return rows;
}
export async function loadReplacements(root='.') {try{return validateReplacements(JSON.parse(await readFile(join(root,'_data/video_replacements.json'),'utf8')));}catch(error){if(error.code==='ENOENT')return [];throw error;}}
export function attachReplacements(videos,rows){validateReplacements(rows);const active=new Set(videos.map(v=>v.id));if(rows.some(r=>active.has(r.from)))throw Error('A replaced video is still in the active video ID lists.');return videos.map(v=>{const replaces=rows.filter(r=>r.to===v.id).map(r=>r.from);const {replaces:oldAliases,...video}=v;return replaces.length?{...video,replaces,replacementVisibility:Object.fromEntries(rows.filter(r=>r.to===v.id).map(r=>[r.from,r.visibility]))}:video;});}
export function splitReplacementNotifications(entries){return {silent:entries.filter(e=>e.kind==='video'&&e.replaces?.length),notify:entries.filter(e=>e.kind!=='video'||!e.replaces?.length)};}
export function planReplacement({publicIds,memberIds,replacements=[],from,to}){
 if(!valid(from)||!valid(to)||from===to)throw Error('Supply two different valid video IDs.');validateReplacements(replacements);
 const wasMember=memberIds.includes(from),wasPublic=publicIds.includes(from);if(!wasMember&&!wasPublic)throw Error('The original ID is not in the active website lists.');
 const visibility=wasMember?'members':'public';if((memberIds.includes(to)&&!wasMember)||(publicIds.includes(to)&&!wasPublic))throw Error('The replacement is already listed for a different audience. Move it deliberately before replacing.');
 const links=replacements.filter(r=>r.from!==from).map(r=>r.to===from?{...r,to}:r);links.push({from,to,visibility});validateReplacements(links);
 const replace=ids=>[...new Set(ids.flatMap(id=>id===from?[to]:[id]))];
 return {publicIds:replace(publicIds),memberIds:replace(memberIds),replacements:links};
}

// Compare successful published snapshots, not titles or dates. Scope changes are not replacements.
export function reconcileReplacements(previous,current,declared=[]){
 validateReplacements(declared);const before=new Map((previous||[]).map(v=>[v.id,v])),after=new Map(current.map(v=>[v.id,v]));
 const removed=[...before.values()].filter(v=>!after.has(v.id)),added=[...after.values()].filter(v=>!before.has(v.id)),links=new Map();
 for(const video of before.values())for(const from of video.replaces||[])if(valid(from)&&!after.has(from))links.set(from,{from,to:video.id,visibility:video.replacementVisibility?.[from]==='public'?'public':'members'});
 // Old explicit records may refer to a version already replaced automatically. Do not undo that chain.
 for(const row of declared)if(after.has(row.to)||removed.some(v=>v.id===row.to))links.set(row.from,row);
 const handledFrom=new Set(),handledTo=new Set();for(const row of links.values())if(removed.some(v=>v.id===row.from)&&added.some(v=>v.id===row.to)){handledFrom.add(row.from);handledTo.add(row.to);}
 const inferred=[];
 for(const visibility of ['public','members']){
  const audience=v=>v.visibility==='public'?'public':'members';
  const old=removed.filter(v=>audience(v)===visibility&&!handledFrom.has(v.id)),fresh=added.filter(v=>audience(v)===visibility&&!handledTo.has(v.id));
  if(old.length&&fresh.length){if(old.length!==1||fresh.length!==1)throw Error('Ambiguous '+visibility+' video changes: replace one ID at a time, or use the explicit replacement helper for a mixed batch. No replacement or notification was guessed.');inferred.push({from:old[0].id,to:fresh[0].id,visibility});}
 }
 for(const pair of inferred){for(const [from,row]of links)if(row.to===pair.from)links.set(from,{...row,to:pair.to});links.set(pair.from,pair);}
 const rows=[...links.values()].filter(row=>after.has(row.to)&&!after.has(row.from));validateReplacements(rows);
 return {videos:attachReplacements(current,rows),inferred};
}
export function publishedNotificationLibrary(current,published){
 if(!Array.isArray(published))return current;const ids=new Map(published.map(v=>[v.id,v]));
 if(ids.size!==current.length||current.some(v=>!ids.has(v.id)||(ids.get(v.id).visibility==='public')!==(v.visibility==='public')))throw Error('The published video snapshot is not ready for these ID lists. Sync the protected library before sending notifications.');
 return published;
}

export function publicationRevisionDecision(previous,current,isAncestor){
 if(!previous||!current||previous===current)return 'apply';
 if(isAncestor(current,previous))return 'skip';
 if(!isAncestor(previous,current))throw Error('The published library comes from an unrelated revision. Review it before changing replacement history.');
 return 'apply';
}
