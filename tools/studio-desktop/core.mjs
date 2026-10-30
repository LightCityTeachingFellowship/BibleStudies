import {randomBytes,createHash} from 'node:crypto';
export const ORIGIN='https://lightcityfellowship.com';
export const STUDIO=ORIGIN+'/Admin/';
export const ENDPOINT='https://us-central1-perceptive-zoo-424115-j6.cloudfunctions.net/connectChurchStudioDesktop';
export function studioURL(value){try{const u=new URL(value);return u.origin===ORIGIN&&/^\/Admin\/?$/.test(u.pathname)&&!u.username&&!u.password;}catch{return false;}}
export function externalURL(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function pairing(){const id=randomBytes(16).toString('hex'),verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('hex');return {id,verifier,challenge,code:connectionCode(id),url:STUDIO+'?desktopSession='+id+'&desktopChallenge='+challenge};}
export function connectionCode(id){return id.slice(0,4).toUpperCase()+'-'+id.slice(4,8).toUpperCase();}
export function cleanReports(input){if(!Array.isArray(input))throw Error('Invalid alerts');return input.filter(r=>r&&!r.resolved&&/^[a-f0-9]{64}$/.test(r.id||'')).map(r=>({id:r.id,title:String(r.title||'LightCity stream').slice(0,300),issue:['ended','volume','message'].includes(r.issue)?r.issue:'message',message:String(r.message||'').slice(0,2000),sender:String(r.sender?.name||'A viewer').slice(0,100),count:Math.max(1,Number(r.count)||1),createdAt:Number(r.createdAt)||0,videoId:/^[\w-]{11}$/.test(r.videoId||'')?r.videoId:null}));}
export function reportHeading(row){return row.issue==='ended'?'Stream ended — confirmed':row.issue==='volume'?'Speaker volume request':'Message from '+row.sender;}
export function reconcile(previous,rows){const before=new Map(previous.map(r=>[r.id,r.count]));return {rows,newRows:rows.filter(r=>!before.has(r.id)||before.get(r.id)<r.count)};}
export function preferences(input={}){return {alwaysOnTop:input.alwaysOnTop===true,openAtLogin:input.openAtLogin===true,sound:input.sound!==false};}
