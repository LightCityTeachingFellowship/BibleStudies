// Connect the shared player to LightCity's existing playback and access code.
export function watchFullscreenOrientation(document,viewport){
 const orientation=document.defaultView?.screen?.orientation;let requested=false,disposed=false;
 const active=()=>{const element=document.fullscreenElement||document.webkitFullscreenElement;return !!element&&(element===viewport||viewport.contains(element))};
 const release=()=>{if(!requested)return;requested=false;try{orientation?.unlock?.()}catch{}};
 const update=async()=>{if(!active()){release();return}if(requested||typeof orientation?.lock!=='function')return;requested=true;try{await orientation.lock('landscape');if(disposed||!active()){requested=false;orientation.unlock?.()}}catch{requested=false}};
 document.addEventListener('fullscreenchange',update);document.addEventListener('webkitfullscreenchange',update);
 return()=>{disposed=true;document.removeEventListener('fullscreenchange',update);document.removeEventListener('webkitfullscreenchange',update);release()};
}
export function createLightCityPlayerAdapter({document,media,api,watchAccess,publicIds=[],lookupRecording=async()=>null,getResume=async()=>null}){
 if(!document||!media?.mount||!api||!watchAccess)throw Error('Playback services are unavailable');
 return {
  authorize:id=>watchAccess(id,{publicIds,api}),
  async createController({id,title,mode,startSeconds=null,mount,onPlaybackChange=()=>{}}){
   const saved=startSeconds??await getResume(id);const position=Number.isFinite(saved)&&saved>0&&saved<=172800?saved:0;
   const viewport=document.createElement('div');viewport.className='lc-shared-player-viewport';
   const frame=document.createElement('iframe');frame.title=title;frame.allow='accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
   const query=new URLSearchParams({enablejsapi:'1',origin:document.location.origin,playsinline:'1',controls:'1',rel:'0',autoplay:mode==='video'?'1':'0'});
   if(position&&mode==='video')query.set('start',String(Math.floor(position)));frame.src='https://www.youtube-nocookie.com/embed/'+id+'?'+query;viewport.append(frame);mount.append(viewport);
   let controller,videoPlayer;const stopFullscreenWatch=watchFullscreenOrientation(document,viewport);
   try {
    const recording=await lookupRecording(id);
    controller=media.mount({viewport,videoId:id,title,recording});
    // Signed audio storage does not send CORS headers; ordinary media playback does not need them.
    controller.audio?.removeAttribute('crossorigin');
    if(mode==='audio'){if(position)controller.resumeCheckpoint={seconds:position,rate:1,playing:true};try{await controller.switchTo('audio');if(controller.mode!=='audio')throw Error('Audio could not be prepared')}finally{delete controller.resumeCheckpoint}if(controller.audio?.play)try{await controller.audio.play()}catch(error){if(error?.name!=='NotAllowedError')throw error}}
    else {videoPlayer=await media.trackYouTube(frame,{autoplay:true});videoPlayer?.playVideo?.();}
    const audio=controller.audio;audio?.addEventListener('play',onPlaybackChange);audio?.addEventListener('pause',onPlaybackChange);return {switchTo:async mode=>{await controller.switchTo(mode);if(controller.mode!==mode)throw Error('Playback could not be switched');if(mode==='video'){const currentFrame=viewport.querySelector('iframe');if(currentFrame)videoPlayer=await media.trackYouTube(currentFrame)}},seek:seconds=>{if(controller.mode==='audio'&&audio)audio.currentTime=seconds;else videoPlayer?.seekTo?.(seconds,true)},isPlaying:()=>!!audio&&!audio.paused,isVideoPlaying:()=>{try{return videoPlayer?.getPlayerState?.()===1}catch{return false}},toggle:async()=>{if(!audio)return;if(audio.paused)await audio.play();else audio.pause()},dispose(options={}){stopFullscreenWatch();audio?.removeEventListener('play',onPlaybackChange);audio?.removeEventListener('pause',onPlaybackChange);const stopNative=options.stopNative&&controller.mode==='audio'&&audio;controller.dispose();viewport.remove();if(stopNative)void import('/script/native-app.mjs?v=navigation-shell-1').then(async native=>{if(!native.isAndroidApp()||!options.shouldStop?.())return;const engine=await native.nativeAudio(audio);if(!engine||!options.shouldStop?.())return;const state=await engine.restore();if(state.videoId===id&&options.shouldStop?.())await engine.stop()}).catch(()=>{});}};
   }catch(error){stopFullscreenWatch();controller?.dispose();viewport.remove();throw error;}
  }
 };
}
