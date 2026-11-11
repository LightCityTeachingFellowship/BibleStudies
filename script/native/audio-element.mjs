// A DOM audio element remains the presentation surface; Android owns playback.
export async function connectNativeAudio(audio, plugin) {
 let state={position:0,duration:0,playing:false,volume:1,rate:1,readyState:0};let boundId='',metadata=false;
 const emit=type=>audio.dispatchEvent(new Event(type));
 const update=next=>{if(boundId&&next.videoId&&next.videoId!==boundId)return;if(next.error)audio.dispatchEvent(new CustomEvent('nativeerror',{detail:next.error}));state={...state,...next};if(state.readyState>=1&&!metadata){metadata=true;emit('loadedmetadata');emit('canplay');}for(const name of ['timeupdate','durationchange','volumechange'])emit(name);if(next.ended)emit('ended');};
 const listener=await plugin.addListener('state',update);
 const command=(name,options={})=>plugin[name](options).catch(error=>{audio.dispatchEvent(new CustomEvent('nativeerror',{detail:error.message}));});
 const ranges=()=>({length:state.duration>0?1:0,start:()=>0,end:()=>state.duration});
 Object.defineProperties(audio,{
  currentTime:{get:()=>state.position,set:value=>{state.position=value;void command('seek',{seconds:value});}},
  readyState:{get:()=>state.readyState},networkState:{get:()=>state.readyState?1:2},error:{get:()=>null},seekable:{get:ranges},buffered:{get:ranges},
  duration:{get:()=>state.duration},paused:{get:()=>!state.playing},ended:{get:()=>!!state.ended},
  volume:{get:()=>state.volume,set:value=>{state.volume=value;void command('volume',{value});}},
  muted:{get:()=>state.volume===0,set:value=>{if(value)void command('volume',{value:0});else if(state.volume===0)void command('volume',{value:1});}},
  playbackRate:{get:()=>state.rate,set:value=>{void command('rate',{value});}}
 });
 audio.preload='none'; audio.load=()=>{};
 audio.play=async()=>{await plugin.play();state.playing=true;emit('play');};
 audio.pause=()=>{if(!boundId)return;void command('pause');state.playing=false;emit('pause');};
 return {async load(item){boundId=item.videoId||'';metadata=false;state.readyState=0;await plugin.load(item);update(await plugin.state());if(state.readyState>=1)emit('loadedmetadata');},async restore(){const snapshot=await plugin.state();update(snapshot);return snapshot;},stop:()=>plugin.stop(),dispose:()=>listener.remove()};
}
