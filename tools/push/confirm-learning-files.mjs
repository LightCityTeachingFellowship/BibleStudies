import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))});
const db=getFirestore(),rows=await db.collection('churchVideoActivity/learning/resources').where('state','==','published').get();
for(const doc of rows.docs){const r=doc.data();if(!r.filePath||!r.fileHash)continue;if(!/^(Posts-Summaries\/_posts|QuizQuestions-Adult)\/[\w-]+\.html$/.test(r.filePath))throw Error('Invalid generated file path.');
 let content;try{content=await readFile(new URL('../../'+r.filePath,import.meta.url));}catch(e){if(e.code==='ENOENT')continue;throw e;}
 if(createHash('sha256').update(content).digest('hex')!==r.fileHash)continue;
 await db.runTransaction(async tx=>{const fresh=(await tx.get(doc.ref)).data();if(fresh?.state==='published'&&fresh.fileHash===r.fileHash)tx.set(doc.ref,{filePublished:true},{merge:true});});
}
console.log('Generated summary and quiz page links verified after website deployment. No notifications requested.');
