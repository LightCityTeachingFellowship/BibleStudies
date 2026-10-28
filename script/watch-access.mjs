export async function watchAccess(id,{publicIds=[],api}={}){

 try{await api?.ready;}catch{return false;}
 if((api?.publicLibrary?.map(v=>v.id)||publicIds).includes(id))return true;
 return !!api?.user&&!api.user.isAnonymous&&Array.isArray(api.library)&&api.library.some(v=>v.id===id);
}