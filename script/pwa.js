(() => {
 const base = new URL(document.currentScript.dataset.base, location.origin);
 if (!('serviceWorker' in navigator)) return;
 const ready = navigator.serviceWorker.register(new URL('service-worker.js', base), {scope:base.pathname,updateViaCache:'none'});
 ready.catch(console.error);
 const bar = document.createElement('aside'); bar.className = 'lc-app-controls'; bar.setAttribute('aria-label','App settings');
 const status = document.createElement('p'); status.setAttribute('role','status');
 const install = document.createElement('button'); install.textContent = 'Install app'; install.hidden = true;
 const notify = document.createElement('button'); notify.textContent = 'Enable notifications';
 bar.append(status,install); document.body.append(bar);
 let prompt, modules, user;
 const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
 const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
 status.textContent = ios && !standalone ? 'To install: open Share, then Add to Home Screen. Open the installed app to enable notifications.' : 'LightCity on your device';
 window.addEventListener('beforeinstallprompt', e => {e.preventDefault();prompt=e;install.hidden=false;});
 install.onclick = async () => {await prompt.prompt(); await prompt.userChoice;install.hidden=true;};
 window.addEventListener('appinstalled',()=>{install.hidden=true;status.textContent='LightCity is installed.';});
 const config = globalThis.LIGHTCITY_PUSH;
 if (!config?.enabled || (ios && !standalone)) return;
 bar.append(notify);
 async function initialize() {
  if (modules) return modules;
  const root='https://www.gstatic.com/firebasejs/10.14.1/';
  const [app,auth,db,msg] = await Promise.all(['firebase-app.js','firebase-auth.js','firebase-firestore.js','firebase-messaging.js'].map(f=>import(root+f)));
  if (!(await msg.isSupported())) throw Error('Push notifications are not supported in this browser.');
  const instance=app.initializeApp(config.firebase);
  const authentication=auth.getAuth(instance);
  await authentication.authStateReady();
  user=authentication.currentUser || (await auth.signInAnonymously(authentication)).user;
  modules={db,msg,store:db.getFirestore(instance),messaging:msg.getMessaging(instance)};
  msg.onMessage(modules.messaging,payload=>{status.textContent=payload.notification?.title || payload.data?.title || 'New content available. Refresh to see it.';});
  return modules;
 }
 notify.onclick=async()=>{
  notify.disabled=true;
  try {
   // Request permission directly from the click, before network requests.
   const disabling = notify.dataset.active === 'yes';
   if (!disabling) {
    if (!('Notification' in window) || !('PushManager' in window)) throw Error('Push notifications are not supported in this browser.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw Error('Notifications are not enabled. You can change this in your device’s notification settings.');
   }
   const m=await initialize();
   await ready;
   const registration=await navigator.serviceWorker.ready;
   if (notify.dataset.active === 'yes') {
    await m.db.deleteDoc(m.db.doc(m.store,'webPushSubscribers',user.uid));
    await m.msg.deleteToken(m.messaging);
    notify.dataset.active='';notify.textContent='Enable notifications';status.textContent='Notifications disabled on this device.';localStorage.removeItem('lc-push-enabled');return;
   }
   const token=await m.msg.getToken(m.messaging,{vapidKey:config.vapidKey,serviceWorkerRegistration:registration});
   await m.db.setDoc(m.db.doc(m.store,'webPushSubscribers',user.uid),{token,updatedAt:m.db.serverTimestamp()});
   localStorage.setItem('lc-push-enabled','yes');notify.dataset.active='yes';notify.textContent='Disable notifications';status.textContent='You’ll receive alerts for new articles, summaries and videos.';
  } catch(error) {console.error(error);status.textContent=error.message || 'Could not enable notifications. Please try again.';}
  finally{notify.disabled=false;}
 };
 if(localStorage.getItem('lc-push-enabled')==='yes' && 'Notification' in window && Notification.permission==='granted') {
  notify.dataset.active='yes';notify.textContent='Disable notifications';
  initialize().then(async m=>{const token=await m.msg.getToken(m.messaging,{vapidKey:config.vapidKey,serviceWorkerRegistration:await ready});await m.db.setDoc(m.db.doc(m.store,'webPushSubscribers',user.uid),{token,updatedAt:m.db.serverTimestamp()});}).catch(console.error);
 }
})();
