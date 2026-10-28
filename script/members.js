// Member identity is separate from anonymous device identity used by web push.
const settings = document.querySelector('script[data-lightcity-members]');
const api = globalThis.LightCityMembers = { enabled: settings?.dataset.enabled === 'true', library: null, publicLibrary: null, user: null, error: null, loading: settings?.dataset.enabled === 'true' };
let sdk, memberAuth, deviceAuth, functions, version = 0, mediaPrefetch = null;
const page = document.getElementById('member-page');
let busy = false, signup = false, notice = '';
const field = id => document.getElementById(id);
function publish(videos) {
  api.loading = false;
  api.library = videos;
  const reveal = () => {
    if (api.loading) return;
    // Deferred page scripts must render the chosen audience before it is visible.
    window.dispatchEvent(new CustomEvent('lightcity-members-changed', { detail: { videos: api.library } }));
    document.documentElement?.classList.remove('lc-member-restoring', 'lc-member-restore-slow');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reveal, { once: true });
  else reveal();
}
function renderPage() {
  if (!page) return;
  const signedIn = api.user && !api.user.isAnonymous;
  const verifiedAccess = Array.isArray(api.library);
  const verify = signedIn && api.error?.code === 'functions/failed-precondition';
  field('member-account').hidden = !signedIn;
  field('member-email-display').textContent = signedIn ? api.user.email : '';
  const googleAccount = signedIn && api.user.providerData?.some(provider => provider.providerId === 'google.com');
  field('member-form').hidden = verifiedAccess || verify || googleAccount;
  field('member-google-option').hidden = !!signedIn;
  field('member-google-form').hidden = !googleAccount || verifiedAccess || verify;
  field('member-verification').hidden = !verify;
  field('member-library-link').hidden = !verifiedAccess;
  field('member-code-row').hidden = !signup;
  field('member-code').required = signup;
  field('member-password').autocomplete = signup ? 'new-password' : 'current-password';
  field('member-submit').textContent = busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in';
  field('member-tab-signin').setAttribute('aria-pressed', String(!signup));
  field('member-tab-signup').setAttribute('aria-pressed', String(signup));
  page.querySelectorAll('.lc-member-card button,.lc-member-card input').forEach(node => { node.disabled = busy || !api.enabled; });
  // Account tabs are safe to preview even before the backend is activated.
  field('member-tab-signin').disabled = field('member-tab-signup').disabled = busy;
  field('member-status').textContent = !api.enabled ? 'Member access is being prepared. Please check back soon.' : notice || api.error?.message || (verifiedAccess ? 'You have access to the full LightCity library.' : 'Sign in, or create an account using the code shared with the church.');
}
async function call(name, data = {}) { return (await sdk.functions.httpsCallable(functions, name)(data)).data; }
async function linkDevice() {
  if (!Array.isArray(api.library) || !deviceAuth.currentUser) return;
  await call('linkChurchDevice', { deviceToken: await deviceAuth.currentUser.getIdToken() });
}
async function checkAccess({ preserveOnTransient = false } = {}) {
  const current = ++version;
  api.user = memberAuth.currentUser;
  api.error = null;
  try {
    const publicData = await call('getPublicVideoLibrary');
    if (current !== version) return;
    if (!Array.isArray(publicData.videos) || publicData.videos.some(v=>!/^[\w-]{11}$/.test(v.id)||v.visibility!=='public')) throw Error('Invalid public library');
    api.publicLibrary = publicData.videos;
    const metadata=document.getElementById('lc-public-video-data');
    if(metadata)metadata.textContent=JSON.stringify(Object.fromEntries(publicData.videos.map(v=>[v.id,v.title])));
  } catch { /* Bundled public cards remain available during connection failures. */ }
  if (!api.user || api.user.isAnonymous) { publish(null); renderPage(); return; }
  try {
    const data = await call('getChurchLibrary');
    if (current !== version) return;
    if (!Array.isArray(data.videos) || data.videos.some(video => !/^[\w-]{11}$/.test(video.id))) throw Error('The video library could not be loaded. Please try again.');
    const seen = new Set();
    publish(data.videos.filter(video => !seen.has(video.id) && seen.add(video.id)));
    try { await linkDevice(); } catch { notice = 'Video access is ready. Refresh access to finish setting up member notifications.'; }
  } catch (error) {
    if (current !== version) return;
    api.error = error;
    if (!(preserveOnTransient && Array.isArray(api.library) && /^(functions\/(unavailable|deadline-exceeded|internal|unknown)|auth\/network-request-failed)$/.test(error?.code || ''))) publish(null);
  }
  if (current === version) renderPage();
}
async function bootstrap() {
  if (!api.enabled) { api.loading = false; renderPage(); return; }
  try {
    // Module and deferred classic scripts can finish loading in different orders.
    // Explicitly load the shared public config when it is not available yet.
    if (!globalThis.LIGHTCITY_PUSH?.firebase) {
      try { await import(new URL('../pwa-config.js', import.meta.url).href); }
      catch { throw Error('Sign-in settings could not be loaded. Please reload the page and try again.'); }
    }
    const config = globalThis.LIGHTCITY_PUSH?.firebase;
    if (!config?.apiKey || !config?.projectId) throw Error('Sign-in settings are unavailable. Please reload the page and try again.');
    const root = 'https://www.gstatic.com/firebasejs/10.14.1/';
    const [app, auth, fn] = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-functions.js'].map(file => import(root + file)));
    sdk = { app, auth, functions: fn };
    const deviceApp = app.getApps().find(item => item.name === '[DEFAULT]') || app.initializeApp(config);
    const memberApp = app.getApps().find(item => item.name === 'lightcity-members') || app.initializeApp(config, 'lightcity-members');
    memberAuth = auth.getAuth(memberApp); deviceAuth = auth.getAuth(deviceApp);
    functions = fn.getFunctions(memberApp, 'us-central1');
    await Promise.all([memberAuth.authStateReady(), deviceAuth.authStateReady()]);
    await new Promise(resolve => {
      let initial = true;
      auth.onAuthStateChanged(memberAuth, async () => {
        const selector = '#videotab-container, #watch-player, .home-featured[data-video-id]';
        const surface = document.querySelector(selector);
        if (initial && surface?.matches?.(selector)) {
          const user = memberAuth.currentUser, members = !!user && !user.isAnonymous;
          mediaPrefetch = { uid: user?.uid || null, members };
          for (const name of ['getChurchAudio', 'getChurchLiveAudio']) {
            const pending = call(name, { includeMembers: members });
            void pending.catch(() => {}); mediaPrefetch[name] = pending;
          }
        }
        await checkAccess(); if (initial) { initial = false; resolve(); }
      });
    });
    auth.onAuthStateChanged(deviceAuth, () => { void linkDevice().catch(() => {}); });
  } catch (error) { api.error = error; publish(null); renderPage(); }
}
api.removeStudioVideo=async videoId=>{await api.ready;return call('removeChurchStudioVideo',{videoId,accountUid:api.user?.uid});};
api.ready = bootstrap();
let libraryPolling=false,lastLibraryPoll=Date.now();
async function refreshVideoCatalogue(){
 if(libraryPolling||document.visibilityState==='hidden'||Date.now()-lastLibraryPoll<30000)return;
 // Never rebuild the cards around an active video/audio player.
 if(document.querySelector('.lc-audio-mode, lite-youtube.lyt-activated, #videotab-container iframe'))return;
 libraryPolling=true;lastLibraryPoll=Date.now();
 try{
  await api.ready;if(!functions)return;
  const account=memberAuth.currentUser?.uid;
  const [publicData,privateData]=await Promise.all([call('getPublicVideoLibrary'),Array.isArray(api.library)?call('getChurchLibrary'):Promise.resolve(null)]);
  if(account!==memberAuth.currentUser?.uid||!Array.isArray(publicData.videos))return;
  const changed=JSON.stringify(publicData.videos)!==JSON.stringify(api.publicLibrary)||privateData&&JSON.stringify(privateData.videos)!==JSON.stringify(api.library);
  api.publicLibrary=publicData.videos;
  const metadata=document.getElementById('lc-public-video-data');if(metadata)metadata.textContent=JSON.stringify(Object.fromEntries(publicData.videos.map(v=>[v.id,v.title])));
  if(changed)publish(privateData?.videos||null);
 }catch{}finally{libraryPolling=false;}
}
setInterval(()=>void refreshVideoCatalogue(),30000);
document.addEventListener('visibilitychange',()=>void refreshVideoCatalogue());
api.getAudio = async (videoId, diagnose = false) => {
  await api.ready;
  if (!memberAuth || !functions) throw Error('Member sign-in is unavailable. Please reload the page.');
  if (videoId === undefined && mediaPrefetch?.uid === (memberAuth.currentUser?.uid || null) && mediaPrefetch.members === Array.isArray(api.library) && mediaPrefetch.getChurchAudio) {
    const pending = mediaPrefetch.getChurchAudio; delete mediaPrefetch.getChurchAudio; return pending;
  }
  return call('getChurchAudio', videoId === undefined ? { includeMembers: Array.isArray(api.library) } : { videoId, diagnose });
};
api.getLiveAudio = async videoId => {
  await api.ready;
  if (!memberAuth || !functions) throw Error('Live listening is unavailable.');
  if (videoId === undefined && mediaPrefetch?.uid === (memberAuth.currentUser?.uid || null) && mediaPrefetch.members === Array.isArray(api.library) && mediaPrefetch.getChurchLiveAudio) {
    const pending = mediaPrefetch.getChurchLiveAudio; delete mediaPrefetch.getChurchLiveAudio; return pending;
  }
  return call('getChurchLiveAudio', videoId === undefined ? { includeMembers: Array.isArray(api.library) } : { videoId });
};
api.signInForVideos = async () => {
  await api.ready;
  if (!memberAuth || !sdk) throw Error('Sign-in is unavailable.');
  const provider = new sdk.auth.GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
  await sdk.auth.signInWithPopup(memberAuth, provider); await checkAccess();
};
api.getVideoActivity = async data => { await api.ready; return call('getMyVideoActivity', data); };
api.updateVideoActivity = async data => { await api.ready; return call('updateMyVideoActivity', data); };
api.refresh = async ({ preserveOnTransient = false } = {}) => {
  await api.ready;
  if (!memberAuth) throw Error('Member access is unavailable. Please try again shortly.');
  if (memberAuth.currentUser) { await sdk.auth.reload(memberAuth.currentUser); await memberAuth.currentUser.getIdToken(true); }
  await checkAccess({ preserveOnTransient });
};
window.addEventListener('lightcity-push-ready', () => { void linkDevice().catch(() => {}); });
window.addEventListener('pageshow', event => {
  if (event.persisted && api.enabled) {
    // Revalidate quietly: the existing player and verified audience stay mounted.
    api.ready = api.refresh({ preserveOnTransient: true }).catch(error => {
      api.error = error;
      if (!/^(functions\/(unavailable|deadline-exceeded|internal|unknown)|auth\/network-request-failed)$/.test(error?.code || '')) publish(null);
    });
  }
});
async function action(task) {
  if (busy || !api.enabled) return;
  busy = true; notice = ''; api.error = null; renderPage();
  try { await api.ready; if (!sdk || !memberAuth || !functions) throw Error('Member access is unavailable. Please reload the page and try again.'); await task(); }
  catch (error) {
    const authFailure = ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(error.code);
    const messages = {
      'auth/popup-blocked': 'Your browser blocked Google sign-in. Allow pop-ups for this site, then try again.',
      'auth/popup-closed-by-user': 'Google sign-in was cancelled. You can try again.',
      'auth/cancelled-popup-request': 'Google sign-in was cancelled. You can try again.',
      'auth/operation-not-allowed': 'This sign-in method is not enabled yet. Please contact the church.',
      'auth/unauthorized-domain': 'Google sign-in is not configured for this website address yet.',
      'auth/account-exists-with-different-credential': 'This email already uses another sign-in method. Please sign in using that method.'
    };
    api.error = { code: error.code, message: messages[error.code] || (authFailure ? 'The email or password is incorrect. Please try again.' : error.message || 'Please try again shortly.') };
  }
  finally { busy = false; renderPage(); }
}
if (page) {
  field('member-google').onclick = () => void action(async () => {
    const provider = new sdk.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await sdk.auth.signInWithPopup(memberAuth, provider);
    await checkAccess();
  });
  field('member-google-form').addEventListener('submit', event => {
    event.preventDefault();
    void action(async () => {
      await call('registerGoogleChurchMember', { code: field('member-google-code').value });
      field('member-google-code').value = '';
      await checkAccess();
    });
  });
  field('member-tab-signin').onclick = () => { signup = false; notice = ''; renderPage(); };
  field('member-tab-signup').onclick = () => { signup = true; notice = ''; renderPage(); };
  field('member-form').addEventListener('submit', event => {
    event.preventDefault();
    void action(async () => {
      const email = field('member-email').value.trim(), password = field('member-password').value;
      if (signup) {
        if (!memberAuth.currentUser) await sdk.auth.signInAnonymously(memberAuth);
        const result = await call('registerChurchMember', { email, password, code: field('member-code').value });
        const credentials = await sdk.auth.signInWithEmailAndPassword(memberAuth, email, password);
        if (result.verificationRequired) await sdk.auth.sendEmailVerification(credentials.user);
      } else await sdk.auth.signInWithEmailAndPassword(memberAuth, email, password);
      field('member-password').value = ''; field('member-code').value = '';
      await checkAccess();
    });
  });
  field('member-reset').onclick = () => void action(async () => {
    const email = field('member-email').value.trim();
    if (!email) throw Error('Enter your email address first.');
    try { await sdk.auth.sendPasswordResetEmail(memberAuth, email); }
    catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    notice = 'If an account exists for this email, a password reset link has been sent.';
  });
  field('member-resend').onclick = () => void action(async () => { await sdk.auth.sendEmailVerification(memberAuth.currentUser); notice = 'Verification email sent. Please check your inbox and spam folder.'; });
  field('member-refresh').onclick = () => void action(() => api.refresh());
  field('member-check-email').onclick = () => void action(() => api.refresh());
  field('member-signout').onclick = () => void action(async () => {
    ++version; publish(null);
    if (deviceAuth.currentUser) await call('unlinkChurchDevice', { deviceToken: await deviceAuth.currentUser.getIdToken() });
    await sdk.auth.signOut(memberAuth);
    notice = 'You are signed out. Public content is still available.';
  });
  renderPage();
}

api.getReadingActivity = async data => { await api.ready; return call('getMyReadingActivity', data); };
api.updateReadingActivity = async data => { await api.ready; return call('updateMyReadingActivity', data); };

api.getVideoReplacements=async()=>{await api.ready;return call('getVideoReplacements',{});};

api.getAdminDashboard=async()=>{await api.ready;return call('getChurchAdminDashboard',{accountUid:api.user?.uid});};
api.signOut=async()=>{
 await api.ready;if(!memberAuth||!sdk)return;
 ++version;api.user=null;publish(null);
 try{if(deviceAuth.currentUser)await call('unlinkChurchDevice',{deviceToken:await deviceAuth.currentUser.getIdToken()});}catch{}
 await sdk.auth.signOut(memberAuth);
};
api.publishStudioVideo=async data=>{await api.ready;return call('publishChurchStudioVideo',{...data,accountUid:api.user?.uid});};
api.getStudioPublication=async data=>{await api.ready;return call('getChurchStudioPublication',{...data,accountUid:api.user?.uid});};
api.manageStudioTest=async action=>{await api.ready;const device=deviceAuth?.currentUser;if(!device)throw Error('Device sign-in is not ready. Refresh and try again.');return call('manageChurchStudioTest',{action,deviceToken:await device.getIdToken(),accountUid:api.user?.uid});};