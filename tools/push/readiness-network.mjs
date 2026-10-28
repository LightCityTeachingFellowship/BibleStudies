// Only idempotent readiness/credential reads are retried. Never log headers,
// response bodies or URLs, which can contain private credentials or metadata.
export async function readinessJson(label,url,{headers={},timeoutMs=30000,attempts=4,send=fetch,wait=ms=>new Promise(ok=>setTimeout(ok,ms)),warn=message=>console.warn(message),httpError}={}){
 let cause='network request failed';
 for(let attempt=0;attempt<attempts;attempt++){
  try{
   const response=await send(url,{headers,signal:AbortSignal.timeout(timeoutMs),redirect:'error'});
   if(!response.ok){
    await response.body?.cancel();
    if(![408,429,500,502,503,504].includes(response.status)){
     const error=Error(httpError||`${label}: HTTP ${response.status}. The existing deployment is preserved.`);error.permanent=true;throw error;
    }
    cause='HTTP '+response.status;
   }else{
    try{return await response.json();}catch{cause='unreadable JSON response';}
   }
  }catch(error){
   if(error.permanent)throw error;
   const code=String(error.cause?.code||error.code||'');cause='network request failed'+(/^[A-Z0-9_]+$/.test(code)?' ('+code+')':'');
  }
  if(attempt+1<attempts){warn(`${label}: ${cause}; retry ${attempt+2}/${attempts}.`);await wait(1000*2**attempt);}
 }
 throw Error(`${label}: ${cause} after ${attempts} attempts. The existing deployment is preserved.`);
}