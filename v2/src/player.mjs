// A single player belongs to the application, not to a route. The adapter
// encapsulates the existing website/Android playback implementation.
export function createPlayerService({ mount, authorize, createController }) {
 let current=null, request=0;const listeners=new Set();
 const snapshot=()=>current?{id:current.id,title:current.title,mode:current.mode,kind:current.kind,playing:current.controller.isPlaying?.()??false}:null;
 const publish=()=>{const state=snapshot();for(const listener of listeners)listener(state)};
 async function open({id,title,mode='video',kind='video',startSeconds=null}){
  if(kind==='archive'){if(!/^[a-f0-9]{32}$/.test(id)||mode!=='audio')throw Error('Invalid recording')}else if(kind!=='video'||!/^[A-Za-z0-9_-]{11}$/.test(id))throw Error('Invalid recording');
  if(!['video','audio'].includes(mode))throw Error('Invalid playback mode');
  const position=Number.isFinite(startSeconds)&&startSeconds>=0&&startSeconds<=172800?startSeconds:null;
  const token=++request;
  // Authorization is checked even if a card was rendered from cached data.
  const allowed=await authorize(id,kind);
  if(token!==request)return false;
  if(!allowed)throw Error('This recording is unavailable');
  if(current?.id===id&&current.kind===kind){if(current.mode!==mode){await current.controller.switchTo(mode);if(token!==request)return false;current.mode=mode;publish();}if(position!==null)await current.controller.seek?.(position);return true;}
  // Release the old controller before starting another: Android's audio
  // service is shared, and pausing the old element after loading a new item
  // would otherwise pause the new recording.
  const previous=current;current=null;previous?.controller.dispose();if(previous)publish();
  const controller=await createController({id,title,mode,kind,startSeconds:position,mount,onPlaybackChange:publish});
  if(token!==request){controller.dispose();return false;}
  current={id,title,mode,kind,controller};publish();return true;
 }
 function close(){const token=++request,previous=current;current=null;previous?.controller.dispose({stopNative:true,shouldStop:()=>request===token});publish();}
 return {open,close,videoPlaying(){return current?.mode==='video'&&!!current.controller.isVideoPlaying?.()},async toggle(){if(!current?.controller.toggle)return;await current.controller.toggle();publish()},subscribe(fn){listeners.add(fn);fn(snapshot());return()=>listeners.delete(fn)},get current(){return snapshot()},destroy(){close();listeners.clear();}};
}
