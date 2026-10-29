import {requireStudioAdmin} from './studio-publishing.mjs';
const timestamp=value=>{const parsed=Date.parse(value||'');return Number.isFinite(parsed)?parsed:null;};
export function createAdminUsers(deps){
 const {auth,db,fail}=deps;
 return async request=>{
  await requireStudioAdmin(request,deps);
  const token=request.data?.pageToken;
  if(token!==undefined&&(typeof token!=='string'||!token||token.length>4096))throw new fail('invalid-argument','Refresh the account list and try again.');
  let page;
  try{page=await auth.listUsers(250,token);}catch(error){throw new fail(error.code==='auth/invalid-page-token'?'invalid-argument':'unavailable','The account list could not load. Please refresh.');}
  // Anonymous identities are used for push devices, not people who signed in.
  const people=page.users.filter(user=>user.providerData?.length||user.email||user.phoneNumber);
  const memberships=people.length?await db.getAll(...people.map(user=>db.doc('churchMembers/'+user.uid))):[];
  return {users:people.map((user,index)=>({
   uid:user.uid,name:String(user.displayName||'').slice(0,160),email:String(user.email||'').slice(0,320),
   emailVerified:user.emailVerified===true,disabled:user.disabled===true,
   membership:memberships[index].exists?(memberships[index].data()?.active===true?'active':'removed'):'none',
   createdAt:timestamp(user.metadata?.creationTime),lastSignInAt:timestamp(user.metadata?.lastSignInTime)
  })),nextPageToken:page.pageToken||null};
 };
}
