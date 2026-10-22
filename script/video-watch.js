(() => {
 const videoId=new URLSearchParams(location.search).get('v') || '';
 const title=document.getElementById('watch-title');
 const status=document.getElementById('watch-status');
 const container=document.getElementById('watch-player');
 const help=document.getElementById('watch-help');
 const youtube=document.getElementById('watch-youtube');
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
 const params=new URLSearchParams({autoplay:'1',playsinline:'1',controls:'1',rel:'0',origin:location.origin});
 player.src=`https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
 container.appendChild(player);
 container.hidden=false;
 help.hidden=false;
 status.textContent='';
 status.hidden=true;
 youtube.href=`https://www.youtube.com/watch?v=${videoId}`;
 youtube.hidden=false;
 const endpoint=new URL('https://www.youtube.com/oembed');
 endpoint.searchParams.set('url',youtube.href);
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
