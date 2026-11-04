export async function watchAccess(id,{publicIds=[],api}={}){

 try{await api?.ready;}catch{return false;}
 if((api?.publicLibrary?.map(v=>v.id)||publicIds).includes(id))return true;
 if(api?.user&&!api.user.isAnonymous&&Array.isArray(api.library)&&api.library.some(v=>v.id===id))return true;
 try{const result=await api?.getSharedVideo?.(id);if(result?.video?.id===id){api.sharedVideo=result.video;return true;}}catch{}
 return false;
}
