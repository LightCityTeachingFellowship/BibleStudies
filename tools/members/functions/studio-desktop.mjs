import {createHash,timingSafeEqual} from 'node:crypto';
import {requireStudioAdmin} from './studio-publishing.mjs';
const validId=value=>/^[a-f0-9]{32}$/.test(value||'');
export const desktopChallenge=verifier=>createHash('sha256').update(verifier).digest('hex');
// Only the admin browser can approve a connection. The Windows app alone holds its verifier.
export function createDesktopLogin(deps){
 const {db,auth,fail,now=Date.now}=deps;
 return async request=>{
  const {action,id,challenge,verifier}=request.data||{};
  if(!validId(id))throw new fail('invalid-argument','Start sign-in again from the Windows app.');
  const ref=db.doc('churchStudioPublications/desktop-logins/requests/'+id);
  if(action==='approve'){
   const uid=await requireStudioAdmin(request,deps);
   if(!/^[a-f0-9]{64}$/.test(challenge||''))throw new fail('invalid-argument','Invalid desktop connection.');
   await db.runTransaction(async tx=>{
    const rate=db.doc('churchRateLimits/desktop-login-'+uid),[previous,limit]=await Promise.all([tx.get(ref),tx.get(rate)]);
    if(previous.exists)throw new fail('already-exists','This connection was already approved. Start again in Windows.');
    if(limit.data()?.nextAt>now())throw new fail('resource-exhausted','Wait a few seconds before approving again.');
    tx.set(rate,{nextAt:now()+10000});
    tx.set(ref,{uid,challenge,expiresAt:now()+180000});
   });
   return {approved:true};
  }
  if(action!=='redeem'||!/^[A-Za-z0-9_-]{43}$/.test(verifier||''))throw new fail('invalid-argument','Invalid desktop connection.');
  const snapshot=await ref.get(),row=snapshot.data();
  if(!snapshot.exists)return {state:'waiting'};
  if(row.consumedAt||row.expiresAt<now())throw new fail('deadline-exceeded','Connection expired. Start sign-in again in Windows.');
  if(!/^[a-f0-9]{64}$/.test(row.challenge||'')||!timingSafeEqual(Buffer.from(row.challenge,'hex'),Buffer.from(desktopChallenge(verifier),'hex')))throw new fail('permission-denied','Desktop connection does not match.');
  await requireStudioAdmin({auth:{uid:row.uid},data:{}},deps);
  await db.runTransaction(async tx=>{
   const fresh=(await tx.get(ref)).data();
   if(!fresh||fresh.consumedAt||fresh.expiresAt<now()||fresh.uid!==row.uid||fresh.challenge!==row.challenge)throw new fail('deadline-exceeded','Connection was already used. Start again in Windows.');
   tx.set(ref,{...fresh,consumedAt:now()});
  });
  try{return {state:'approved',token:await auth.createCustomToken(row.uid)};}
  catch{throw new fail('failed-precondition','Windows sign-in needs token-signing access. Run the desktop setup helper, then try again.');}
 };
}
