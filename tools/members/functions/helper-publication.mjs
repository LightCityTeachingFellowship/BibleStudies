// A completed local upload can belong to Studio or to the ordinary source lists.
// Source-list publications still need the existing audio-ready website workflow.
export async function publishAudioReadyVideo(id,{db,studio,recordings,kick,now=Date.now}) {
 const current=await db.doc('churchVideoLibrary/current').get();
 if(current.data()?.videos?.some(v=>v.id===id)||await studio.promote(id))return {requested:true,published:true,message:'Video and audio are available.'};
 const [source,audio]=await Promise.all([studio.source(),recordings()]);
 if(!source.some(v=>v.id===id))return {requested:false,published:false,message:'This video is no longer in the selected source lists.'};
 if(!audio.some(r=>r.videoId===id&&r.bytes>0&&/^[a-f0-9]{64}$/.test(r.sha256||'')))return {requested:false,published:false,message:'Waiting for matching audio.'};
 // Polling every minute must not start another full build while one is finishing.
 const ref=db.doc('churchRateLimits/audio-publication-'+id),leaseUntil=now()+10*60000;
 const claimed=await db.runTransaction(async tx=>{const state=(await tx.get(ref)).data();if(state?.leaseUntil>now())return false;tx.set(ref,{leaseUntil});return true;});
 if(claimed)try{
  const result=await kick();if(result?.requested!==true)throw Error('The audio-ready publishing trigger is unavailable.');
 }catch(error){
  await db.runTransaction(async tx=>{const state=(await tx.get(ref)).data();if(state?.leaseUntil===leaseUntil)tx.set(ref,{leaseUntil:0});});throw error;
 }
 return {requested:true,published:false,message:'Audio is ready. The website publication has been requested.'};
}
