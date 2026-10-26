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
export function attachReplacements(videos,rows){validateReplacements(rows);const active=new Set(videos.map(v=>v.id));if(rows.some(r=>active.has(r.from)))throw Error('A replaced video is still in the active video ID lists.');return videos.map(v=>{const replaces=rows.filter(r=>r.to===v.id).map(r=>r.from);const {replaces:oldAliases,...video}=v;return replaces.length?{...video,replaces}:video;});}
export function splitReplacementNotifications(entries){return {silent:entries.filter(e=>e.kind==='video'&&e.replaces?.length),notify:entries.filter(e=>e.kind!=='video'||!e.replaces?.length)};}
export function planReplacement({publicIds,memberIds,replacements=[],from,to}){
 if(!valid(from)||!valid(to)||from===to)throw Error('Supply two different valid video IDs.');validateReplacements(replacements);
 const wasMember=memberIds.includes(from),wasPublic=publicIds.includes(from);if(!wasMember&&!wasPublic)throw Error('The original ID is not in the active website lists.');
 const visibility=wasMember?'members':'public';if((memberIds.includes(to)&&!wasMember)||(publicIds.includes(to)&&!wasPublic))throw Error('The replacement is already listed for a different audience. Move it deliberately before replacing.');
 const links=replacements.filter(r=>r.from!==from).map(r=>r.to===from?{...r,to}:r);links.push({from,to,visibility});validateReplacements(links);
 const replace=ids=>[...new Set(ids.flatMap(id=>id===from?[to]:[id]))];
 return {publicIds:replace(publicIds),memberIds:replace(memberIds),replacements:links};
}
