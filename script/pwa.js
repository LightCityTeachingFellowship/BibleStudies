(() => {
  const base = new URL(document.currentScript.dataset.base, location.origin);
  if (!('serviceWorker' in navigator)) return;
  const ready = navigator.serviceWorker.register(new URL('service-worker.js', base), { scope: base.pathname, updateViaCache: 'none' });
  ready.catch(console.error);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const config = globalThis.LIGHTCITY_PUSH;
  const allowInvitations = !document.getElementById('member-page');
  const canNotify = config?.enabled && 'Notification' in window && 'PushManager' in window && !(ios && !standalone);
  const read = (storage, key) => { try { return storage.getItem(key); } catch { return null; } };
  const write = (storage, key, value) => { try { value == null ? storage.removeItem(key) : storage.setItem(key, value); } catch {} };
  const area = document.createElement('aside');
  area.className = 'lc-device-prompts';
  area.setAttribute('aria-label', 'LightCity on your device');
  area.hidden = true;
  const navigation = document.querySelector('.home-bottom-nav');
  if (navigation) navigation.before(area); else document.body.append(area);
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function button(text) { const node = element('button', 'lc-device-button', text); node.type = 'button'; return node; }
  function card(title, description) {
    const node = element('section', 'lc-device-card');
    const copy = element('div', 'lc-device-copy');
    const heading = element('strong', 'lc-device-title', title);
    const body = element('p', 'lc-device-description', description);
    copy.append(heading, body);
    const actions = element('div', 'lc-device-actions');
    node.append(copy, actions);
    node.hidden = true;
    return { node, body, actions };
  }
  const installCard = card('Install LightCity App', 'Add LightCity to your home screen for quick access.');
  const install = button(ios ? 'How to install' : 'Install App');
  const dismiss = button('×');
  dismiss.className = 'lc-device-dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss installation prompt');
  const later = button('Not now');
  later.className = 'lc-device-later';
  installCard.actions.append(install, later, dismiss);
  const installPopup = element('aside', 'lc-device-prompts lc-install-popup');
  installPopup.setAttribute('aria-label', 'Install LightCity App');
  installPopup.setAttribute('aria-live', 'polite');
  installPopup.hidden = true;
  installPopup.append(installCard.node);
  document.body.append(installPopup);
  const notificationCard = card('Stay up to date', 'Get alerts for new videos, articles and summaries.');
  const notificationPopup = element('aside', 'lc-device-prompts lc-notification-popup');
  notificationPopup.setAttribute('aria-label', 'LightCity notifications');
  notificationPopup.hidden = true;
  notificationPopup.append(notificationCard.node);
  document.body.append(notificationPopup);
  const notify = button('Enable notifications');
  const notificationLater = button('Not now');
  notificationLater.className = 'lc-device-later';
  const notificationDismiss = button('×');
  notificationDismiss.className = 'lc-device-dismiss';
  notificationDismiss.setAttribute('aria-label', 'Dismiss notification invitation');
  const notificationStatus = element('p', 'lc-device-status');
  notificationStatus.setAttribute('role', 'status');
  notificationCard.actions.append(notify, notificationLater, notificationDismiss);
  notificationCard.node.append(notificationStatus);
  const settings = element('details', 'lc-notification-settings');
  settings.hidden = true;
  const summary = element('summary', '', 'Notification settings');
  const disable = button('Disable notifications');
  const settingsStatus = element('p', 'lc-device-status');
  settingsStatus.setAttribute('role', 'status');
  settings.append(summary, disable, settingsStatus);
  area.append(settings);
  let prompt, installed = Boolean(standalone), active = Boolean(canNotify && Notification.permission === 'granted' && read(localStorage, 'lc-push-enabled') === 'yes');
  let modulesPromise, user;
  const visits = (Number(read(sessionStorage, 'lc-install-page-views')) || 0) + 1;
  write(sessionStorage, 'lc-install-page-views', String(visits));
  let engaged = visits >= 2, notificationEngaged = false, installPaused = false, permissionBusy = false, retryPopup;
  function pauseInstall() {
    installPaused = true;
    setTimeout(() => { installPaused = false; render(); }, 20000);
  }
  function snoozeNotifications() {
    const until = String(Date.now() + 7 * 24 * 60 * 60 * 1000);
    write(localStorage, 'lc-notification-snooze-until', until);
    write(sessionStorage, 'lc-notification-snooze-until', until);
    pauseInstall();
    render();
  }
  function snoozeInstall() {
    const until = String(Date.now() + 7 * 24 * 60 * 60 * 1000);
    write(localStorage, 'lc-install-snooze-until', until);
    write(sessionStorage, 'lc-install-snooze-until', until);
    render();
  }
  function render() {
    clearTimeout(retryPopup);
    const dismissed = Number(read(localStorage, 'lc-install-snooze-until')) > Date.now() || Number(read(sessionStorage, 'lc-install-snooze-until')) > Date.now() || read(sessionStorage, 'lc-install-dismissed') === 'yes';
    const eligible = !installed && !dismissed && engaged && Boolean(prompt || ios);
    const busy = permissionBusy || document.hidden || Boolean(document.querySelector('dialog[open]'));
    const notificationsSnoozed = Number(read(localStorage, 'lc-notification-snooze-until')) > Date.now() || Number(read(sessionStorage, 'lc-notification-snooze-until')) > Date.now();
    notificationPopup.hidden = notificationCard.node.hidden = !allowInvitations || !canNotify || Notification.permission === 'denied' || active || !notificationEngaged || notificationsSnoozed || busy;
    installPopup.hidden = installCard.node.hidden = !allowInvitations || !eligible || busy || installPaused || !notificationPopup.hidden;
    if (allowInvitations && (eligible || notificationEngaged) && busy && !document.hidden) retryPopup = setTimeout(render, 5000);
    settings.hidden = !canNotify || !active;
    area.hidden = settings.hidden;
  }
  if (!engaged && !installed) setTimeout(() => { engaged = true; render(); }, 20000);
  if (canNotify && !active && Notification.permission !== 'denied') setTimeout(() => { notificationEngaged = true; render(); }, 10000);
  document.addEventListener('visibilitychange', render);
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (!notificationPopup.hidden) snoozeNotifications();
    else if (!installPopup.hidden) snoozeInstall();
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); prompt = event; render();
  });
  window.addEventListener('appinstalled', () => { installed = true; prompt = null; render(); });
  dismiss.onclick = snoozeInstall;
  later.onclick = snoozeInstall;
  notificationLater.onclick = notificationDismiss.onclick = snoozeNotifications;
  install.onclick = async () => {
    if (ios) {
      installCard.body.textContent = 'Open Share, then Add to Home Screen. Open the installed LightCity app to enable notifications.';
      install.hidden = true;
      return;
    }
    if (!prompt) return;
    install.disabled = true;
    const request = prompt;
    try {
      await request.prompt();
      const choice = await request.userChoice;
      if (choice?.outcome === 'accepted') installed = true;
      else snoozeInstall();
    }
    catch (error) { console.error(error); }
    finally { prompt = null; install.disabled = false; render(); }
  };
  async function initialize() {
    if (modulesPromise) return modulesPromise;
    modulesPromise = (async () => {
      const root = 'https://www.gstatic.com/firebasejs/10.14.1/';
      const [app, auth, db, msg] = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js', 'firebase-messaging.js'].map(file => import(root + file)));
      if (!(await msg.isSupported())) throw Error('Push notifications are not supported in this browser.');
      const instance = app.initializeApp(config.firebase);
      const authentication = auth.getAuth(instance);
      await authentication.authStateReady();
      user = authentication.currentUser || (await auth.signInAnonymously(authentication)).user;
      const messaging = msg.getMessaging(instance);
      msg.onMessage(messaging, payload => {
        window.dispatchEvent(new Event('lightcity-notification-arrived'));
        if (!active || Notification.permission !== 'granted') return;
        // One service worker coordinates displays across all open LightCity tabs.
        void ready.then(async registration => {
          const worker = registration.active || (await navigator.serviceWorker.ready).active;
          worker?.postMessage({ type: 'LIGHTCITY_FOREGROUND_PUSH', payload });
        }).catch(console.error);
      });
      return { db, msg, store: db.getFirestore(instance), messaging };
    })().catch(error => { modulesPromise = null; throw error; });
    return modulesPromise;
  }
  async function subscribe() {
    const m = await initialize();
    const registration = await ready;
    const token = await m.msg.getToken(m.messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
    if (!token) throw Error('Could not enable notifications. Please try again.');
    await m.db.setDoc(m.db.doc(m.store, 'webPushSubscribers', user.uid), { token, updatedAt: m.db.serverTimestamp() });
    window.dispatchEvent(new Event('lightcity-push-ready'));
    return m;
  }
  notify.onclick = async () => {
    notify.disabled = true;
    permissionBusy = true;
    render();
    notificationStatus.textContent = '';
    try {
      // Keep the native permission request directly attached to the user's click.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        notificationStatus.textContent = permission === 'denied' ? 'Notifications are blocked. You can change this in your browser settings.' : 'Notifications were not enabled.';
        return;
      }
      await subscribe();
      write(localStorage, 'lc-push-enabled', 'yes');
      active = true;
      pauseInstall();
      notificationStatus.textContent = '';
      render();
    } catch (error) { console.error(error); notificationStatus.textContent = error.message || 'Could not enable notifications. Please try again.'; }
    finally { notify.disabled = false; permissionBusy = false; render(); }
  };
  disable.onclick = async () => {
    disable.disabled = true;
    settingsStatus.textContent = '';
    try {
      const m = await initialize();
      await m.db.deleteDoc(m.db.doc(m.store, 'webPushSubscribers', user.uid));
      await m.msg.deleteToken(m.messaging);
      write(localStorage, 'lc-push-enabled', null);
      active = false;
      settings.open = false;
      render();
    } catch (error) { console.error(error); settingsStatus.textContent = error.message || 'Could not disable notifications. Please try again.'; }
    finally { disable.disabled = false; }
  };
  render();
  globalThis.LightCityNotificationSettings={
    getState:()=>({supported:Boolean(canNotify),enabled:active,permission:typeof Notification==='undefined'?'unsupported':Notification.permission}),
    enable:()=>notify.onclick(),disable:()=>disable.onclick()
  };
  window.dispatchEvent(new Event('lightcity-notification-settings-ready'));
  // Existing subscribers still refresh their token and restore their device record.
  if (active) subscribe().catch(console.error);
})();
