(() => {
  const base = new URL(document.currentScript.dataset.base, location.origin);
  if (!('serviceWorker' in navigator)) return;
  let registrationRequest;
  function registerWorker() {
    if (!registrationRequest) {
      registrationRequest = withDeadline(
        navigator.serviceWorker.register(new URL('service-worker.js', base), { scope: base.pathname, updateViaCache: 'none' }),
        'LightCity could not start its notification service. Please try again.'
      ).catch(error => { registrationRequest = null; throw error; });
    }
    return registrationRequest;
  }
  function withDeadline(request, message, milliseconds = 12000) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error(message)), milliseconds);
    });
    return Promise.race([request, timeout]).finally(() => clearTimeout(timer));
  }
  void registerWorker().catch(console.error);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const config = globalThis.LIGHTCITY_PUSH;
  const allowInvitations = !document.getElementById('member-page') && !document.querySelector('#chooseCat,#QandA-section,#cat-bibleQuiz-inner');
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
  const quizEnable = button('Enable notifications on this device');
  quizEnable.onclick = async () => { settingsStatus.textContent = await enableNotifications(); };
  quizEnable.hidden = true;
  const settingsStatus = element('p', 'lc-device-status');
  settingsStatus.setAttribute('role', 'status');
  settings.append(summary, disable, settingsStatus);
  const isQuiz = Boolean(document.querySelector('#chooseCat,#QandA-section,#cat-bibleQuiz-inner,#CorrectedAnswers-section'));
  const quizSettings = document.querySelector('#settingsContent .settingsContentInner');
  if (isQuiz) {
    // Quiz screens keep device notification preferences in the main app only.
  } else if (quizSettings) {
    settings.classList.add('lc-quiz-notifications');
    settings.append(quizEnable);
    settings.append(element('p', 'lc-device-status', 'Applies to all LightCity notifications on this device, not just quizzes.'));
    quizSettings.append(settings);
  } else area.append(settings);
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
    settings.hidden = !canNotify || (!quizSettings && !active);
    if (quizSettings) { disable.hidden = !active; quizEnable.hidden = active; quizEnable.disabled = permissionBusy; }
    area.hidden = Boolean(quizSettings) || settings.hidden;
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
  const iosInstallHelp = 'Open Share, then Add to Home Screen. Open the installed LightCity app to enable notifications.';

  async function requestInstall() {
    if (installed) return 'LightCity is already installed.';
    if (ios) return iosInstallHelp;
    if (!prompt) return 'Open your browser menu and look for Install app or Add to Home Screen.';
    const request = prompt;
    prompt = null;
    install.disabled = true;
    try {
      await request.prompt();
      const choice = await request.userChoice;
      if (choice?.outcome === 'accepted') {
        installed = true;
        return 'LightCity was installed.';
      }
      snoozeInstall();
      return 'Installation canceled.';
    } catch (error) {
      console.error(error);
      return 'The install prompt could not open. Try installing from your browser menu.';
    } finally {
      install.disabled = false;
      render();
    }
  }

  globalThis.LightCityInstall = { request: requestInstall, isInstalled: () => installed };

  install.onclick = async () => {
    const message = await requestInstall();
    if (ios) {
      installCard.body.textContent = message;
      install.hidden = true;
    }
  };
  async function initialize() {
    if (modulesPromise) return modulesPromise;
    modulesPromise = (async () => {
      const root = 'https://www.gstatic.com/firebasejs/10.14.1/';
      const [app, auth, db, msg] = await withDeadline(
        Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js', 'firebase-messaging.js'].map(file => import(root + file))),
        'Notification services could not load. Check your connection and try again.'
      );
      if (!(await withDeadline(msg.isSupported(), 'The notification support check timed out. Please try again.'))) throw Error('Push notifications are not supported in this browser.');
      const instance = app.initializeApp(config.firebase);
      const authentication = auth.getAuth(instance);
      await withDeadline(authentication.authStateReady(), 'LightCity could not finish checking your sign-in. Please try again.');
      user = authentication.currentUser || (await withDeadline(
        auth.signInAnonymously(authentication), 'LightCity could not register this device. Check your connection and try again.'
      )).user;
      const messaging = msg.getMessaging(instance);
      msg.onMessage(messaging, payload => {
        window.dispatchEvent(new Event('lightcity-notification-arrived'));
        if (!active || Notification.permission !== 'granted') return;
        // One service worker coordinates displays across all open LightCity tabs.
        void registerWorker().then(async registration => {
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
    const registered = await registerWorker();
    const registration = registered.active ? registered : await withDeadline(
      navigator.serviceWorker.ready, 'LightCity’s notification service is still starting. Please try again.'
    );
    const token = await withDeadline(
      m.msg.getToken(m.messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration: registration }),
      'This device did not finish connecting to push notifications. Please try again.'
    );
    if (!token) throw Error('Could not enable notifications. Please try again.');
    await withDeadline(
      m.db.setDoc(m.db.doc(m.store, 'webPushSubscribers', user.uid), { token, updatedAt: m.db.serverTimestamp() }),
      'LightCity could not confirm that notifications were saved. Check your connection and try again.'
    );
    window.dispatchEvent(new Event('lightcity-push-ready'));
    return m;
  }
  const blockedHelp = 'Notifications are blocked. Allow notifications for LightCity in your phone or browser settings, then try again here.';

  // The snooze controls automatic invitations only. Settings can call this at any time.
  async function enableNotifications() {
    if (!canNotify) return 'Push notifications are unavailable on this device.';
    if (Notification.permission === 'denied') return blockedHelp;
    if (permissionBusy) return 'A notification request is already in progress.';
    notify.disabled = true;
    permissionBusy = true;
    render();
    notificationStatus.textContent = '';
    try {
      // Keep the native permission request directly attached to the user's click.
      const permission = Notification.permission === 'granted' ? 'granted' : await withDeadline(
        Notification.requestPermission(), 'The device permission request did not finish. Try again or check your notification permissions.', 45000
      );
      if (permission !== 'granted') {
        return permission === 'denied' ? blockedHelp : 'Notifications were not enabled. You can try again anytime.';
      }
      await subscribe();
      write(localStorage, 'lc-push-enabled', 'yes');
      active = true;
      pauseInstall();
      return '';
    } catch (error) {
      console.error(error);
      return error.message || 'Could not enable notifications. Please try again.';
    } finally {
      notify.disabled = false;
      permissionBusy = false;
      render();
    }
  }
  notify.onclick = async () => { notificationStatus.textContent = await enableNotifications(); };
  disable.onclick = async () => {
    disable.disabled = true;
    settingsStatus.textContent = '';
    try {
      const m = await initialize();
      await withDeadline(
        m.db.deleteDoc(m.db.doc(m.store, 'webPushSubscribers', user.uid)),
        'LightCity could not confirm that notifications were turned off. Check your connection and try again.'
      );
      await withDeadline(m.msg.deleteToken(m.messaging), 'The device did not finish turning off notifications. Please try again.');
      write(localStorage, 'lc-push-enabled', null);
      active = false;
      settings.open = false;
      render();
    } catch (error) { console.error(error); return settingsStatus.textContent = error.message || 'Could not disable notifications. Please try again.'; }
    finally { disable.disabled = false; }
  };
  render();
  globalThis.LightCityNotificationSettings={
    getState:()=>({supported:Boolean(canNotify),enabled:active,permission:typeof Notification==='undefined'?'unsupported':Notification.permission}),
    enable:enableNotifications,disable:()=>disable.onclick()
  };
  window.dispatchEvent(new Event('lightcity-notification-settings-ready'));
  // Existing subscribers still refresh their token and restore their device record.
  if (active) subscribe().catch(console.error);
})();
