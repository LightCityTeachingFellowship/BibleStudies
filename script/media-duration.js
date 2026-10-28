// Uses the existing audience-scoped audio catalogue; never fetches media or YouTube metadata.
(() => {
 function format(seconds){
  if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<1)return '';
  const total=Math.floor(seconds),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),rest=String(total%60).padStart(2,'0');
  return hours?hours+':'+String(minutes).padStart(2,'0')+':'+rest:minutes+':'+rest;
 }
 function set(viewport,seconds,{live=false}={}){
  if(!viewport)return;
  const text=live?'':format(seconds);
  let badge=viewport.querySelector('.lc-duration-badge');
  if(!text){if(badge&&!badge.hidden)badge.hidden=true;return;}
  if(!badge){badge=viewport.ownerDocument.createElement('span');badge.className='lc-duration-badge';viewport.appendChild(badge);}
  // Avoid child-list observer loops on the video library.
  if(badge.textContent!==text){badge.textContent=text;badge.setAttribute('aria-label','Duration '+text);}
  const playing=!!viewport.classList?.contains('lc-audio-mode')||!!viewport.querySelector('iframe')||!!viewport.querySelector('lite-youtube')?.classList?.contains('lyt-activated');
  if(badge.hidden!==playing)badge.hidden=playing;
 }
 globalThis.LightCityDurations={format,set};
 globalThis.window?.dispatchEvent?.(new Event('lightcity-durations-ready'));
})();
