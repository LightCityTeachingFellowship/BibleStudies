// Browser pages keep their existing playback and sign-in paths.
export const isAndroidApp=()=>!!(globalThis.androidBridge && globalThis.Capacitor?.nativePromise);
let runtime;
async function plugins(){
 if(!isAndroidApp())return null;
 return runtime??=import('./native/capacitor-core.mjs').then(({registerPlugin})=>({audio:registerPlugin('LightCityAudio'),auth:registerPlugin('FirebaseAuthentication')}));
}
export async function nativeGoogleCredential(){const p=await plugins();if(!p)return null;const result=await p.auth.signInWithGoogle();if(!result.credential?.idToken)throw Error('Google sign-in did not return an account. Please try again.');return result.credential;}
export async function nativeSignOut(){const p=await plugins();if(p){await p.audio.stop();await p.auth.signOut();}}
const engines=new WeakMap();
export async function nativeAudio(audio){if(!isAndroidApp())return null;if(!engines.has(audio))engines.set(audio,(async()=>{const [p,{connectNativeAudio}]=await Promise.all([plugins(),import('./native/audio-element.mjs')]);return connectNativeAudio(audio,p.audio);})());return engines.get(audio);}
export async function restoreNativeAudio(audio,videoId){const engine=await nativeAudio(audio);if(!engine)return null;const state=await engine.restore();return state.videoId===videoId&&!state.ended?state:null;}
export async function loadNativeAudio(audio,result,{videoId,title,live=false}={}){
 const engine=await nativeAudio(audio);if(!engine)return false;
 await engine.load({url:result.url,title:result.title||title,videoId,live,callable:live?'getChurchLiveAudio':'getChurchAudio',expiresAt:result.expiresAt,accountUid:globalThis.LightCityMembers?.user?.uid||'',artwork:'https://i.ytimg.com/vi/'+videoId+'/hqdefault.jpg'});
 audio.setAttribute('src',result.url);
 if(audio.readyState<1)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(Error('Android audio could not load. Please try Listen again.')),20000);const loaded=()=>finish(),failed=()=>finish(Error('Android audio connection interrupted.'));function finish(error){clearTimeout(timer);audio.removeEventListener('loadedmetadata',loaded);audio.removeEventListener('nativeerror',failed);error?reject(error):resolve();}audio.addEventListener('loadedmetadata',loaded,{once:true});audio.addEventListener('nativeerror',failed,{once:true});});
 return true;
}
