export async function watchAccess(id,{publicIds=[],api}={}){
 if(publicIds.includes(id))return true;
 try{await api?.ready;}catch{return false;}
 return !!api?.user&&!api.user.isAnonymous&&Array.isArray(api.library)&&api.library.some(v=>v.id===id);
}