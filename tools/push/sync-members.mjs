import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { fileURLToPath } from 'node:url';
import { loadVideoLibrary } from '../video-library.mjs';
import {appendFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {loadReplacements,reconcileReplacements,publicationRevisionDecision} from '../video-replacements.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url)),current=await loadVideoLibrary(root),declared=await loadReplacements(root);
const revision=process.env.GITHUB_ACTIONS==='true'?execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim():null;
const isAncestor=(a,b)=>{try{execFileSync('git',['merge-base','--is-ancestor',a,b],{cwd:root,stdio:'ignore'});return true;}catch(error){if(error.status===1)return false;throw Error('Cannot verify the publication revision. Fetch complete Git history before syncing.');}};
if (process.env.DRY_RUN === 'true') { console.log(`Validated ${current.length} library records. No remote changes.`); }
else {
 initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))});const db=getFirestore();
 const outcome=await db.runTransaction(async tx=>{const ref=db.doc('churchVideoLibrary/current'),previous=await tx.get(ref);
  if(publicationRevisionDecision(previous.exists?previous.data()?.revision:null,revision,isAncestor)==='skip')return {skipped:true,count:0};
  const result=reconcileReplacements(previous.exists?previous.data()?.videos:[],current,declared);
  if(Buffer.byteLength(JSON.stringify(result.videos))>850000)throw Error('Library is too large for one document; split it before syncing.');
  tx.set(ref,{videos:result.videos,...(revision?{revision}:{}),updatedAt:FieldValue.serverTimestamp()});return {skipped:false,count:result.inferred.length};
 });
 if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'skipped='+outcome.skipped+'\n');
 console.log(outcome.skipped?'Skipped an older deployment; newer replacement history is already published.':`Synced ${current.length} library records; detected ${outcome.count} silent replacements. No notifications sent by the sync step.`);
}
