(() => {
 const settings=document.currentScript;
 const button=document.getElementById('admin-install');
 if(!button)return;
 const base=new URL(settings.dataset.base,location.href);
 if('serviceWorker' in navigator)navigator.serviceWorker.register(new URL('service-worker.js',base),{scope:base.pathname,updateViaCache:'none'}).catch(()=>{});
 let prompt=null;
 const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();if(standalone)return;prompt=event;button.hidden=false;
 });
 window.addEventListener('appinstalled',()=>{prompt=null;button.hidden=true;});
 button.addEventListener('click',async()=>{
  if(!prompt)return;const current=prompt;prompt=null;button.hidden=true;
  try{await current.prompt();await current.userChoice;}catch{}
 });
})();
