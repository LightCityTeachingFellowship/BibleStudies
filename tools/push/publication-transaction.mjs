// Firestore does not classify an expired transaction token as retryable.
// Retry the entire transaction so every attempt reads the latest library/studio state.
export async function publicationTransaction(db,update,{sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),report=()=>{}}={}){
 for(let attempt=1;attempt<=3;attempt++){
  try{return await db.runTransaction(update);}
  catch(error){
   const expired=Number(error?.code)===3&&/referenced transaction has expired|transaction.*no longer valid/i.test(error?.details||error?.message||'');
   if(!expired||attempt===3)throw error;
   report('Publication transaction expired. Retrying with fresh library data ('+attempt+'/2).');
   await sleep(attempt*2000);
  }
 }
}
