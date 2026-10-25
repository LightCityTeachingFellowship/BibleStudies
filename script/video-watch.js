(() => {
 const videoId=new URLSearchParams(location.search).get('v') || '';
 const title=document.getElementById('watch-title');
 const status=document.getElementById('watch-status');
 const container=document.getElementById('watch-player');
 const help=document.getElementById('watch-help');
 const startWithAudio=new URLSearchParams(location.search).get('mode')==='audio';
 if(!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
  title.textContent='Video unavailable';
  status.textContent='This video link is incomplete or invalid. Choose a video from All videos.';
  return;
 }
 const player=document.createElement('iframe');
 player.title='LightCity video player';
 player.allow='accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
 player.allowFullscreen=true;
 player.referrerPolicy='strict-origin-when-cross-origin';
 const params=new URLSearchParams({autoplay:startWithAudio?'0':'1',playsinline:'1',controls:'1',rel:'0',enablejsapi:'1',origin:location.origin});
 player.src=`https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
 container.appendChild(player);
 globalThis.LightCityMedia?.trackYouTube(player, { autoplay: !startWithAudio }).catch(() => {});
 // Fullscreen and screen orientation are separate browser capabilities.
 // A cross-origin player exposes its iframe as the fullscreen element here.
 const orientation=globalThis.screen?.orientation;
 let landscapeRequested=false;
 function playerIsFullscreen() {
  const active=document.fullscreenElement || document.webkitFullscreenElement;
  return !!active && (active===player || active===container || container.contains(active));
 }
 function releaseLandscape() {
  if(!landscapeRequested) return;
  landscapeRequested=false;
  try { orientation?.unlock?.(); } catch {}
 }
 async function updateFullscreenOrientation() {
  if(!playerIsFullscreen()) {
   releaseLandscape();
   return;
  }
  if(landscapeRequested || typeof orientation?.lock!=='function') return;
  landscapeRequested=true;
  try {
   await orientation.lock('landscape');
   // The user may have exited fullscreen while the request was pending.
   if(!playerIsFullscreen()) {
    landscapeRequested=false;
    orientation.unlock?.();
   }
  } catch {
   // Unsupported or denied rotation must not interrupt video playback.
  }
 }
 document.addEventListener('fullscreenchange',updateFullscreenOrientation);
 document.addEventListener('webkitfullscreenchange',updateFullscreenOrientation);
 container.hidden=false;
 help.hidden=false;
 status.textContent='';
 status.hidden=true;
 const endpoint=new URL('https://www.youtube.com/oembed');
 endpoint.searchParams.set('url',`https://www.youtube.com/watch?v=${videoId}`);
 endpoint.searchParams.set('format','json');
 fetch(endpoint,{signal:AbortSignal.timeout(10000)}).then(response=> {
  if(!response.ok) throw Error('Video title unavailable');
  return response.json();
 }).then(metadata=> {
  if(typeof metadata.title==='string' && metadata.title.trim()) {
   title.textContent=metadata.title;
   document.title=metadata.title+' | LightCity';
   player.title=metadata.title;
  }
 }).catch(()=>{});
})();
