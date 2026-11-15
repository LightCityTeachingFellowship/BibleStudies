// Experimental persistent-page navigation. Production entry points remain untouched.
const base = new URL('../', import.meta.url);
const sections = new Map([
  ['home', 'Home/'], ['videos', 'Videos/'], ['audio', 'Listen/'],
  ['articles', 'Teaching-Articles/'], ['summaries', 'teaching-summary/']
]);
const paths = new Map([...sections].map(([key, path]) => [new URL(path, base).pathname.toLowerCase().replace(/\/$/, ''), key]));
export function sectionFor(url, origin = base.origin) {
  try {
    const target = new URL(url, base);
    if (target.origin !== origin || target.search || target.hash) return null;
    return paths.get(target.pathname.toLowerCase().replace(/\/$/, '')) || null;
  } catch { return null; }
}
export function pageFor(url, current = base.href) {
  try {
    const target = new URL(url, current);
    if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) return null;
    if (!/^https?:$/.test(target.protocol) && target.protocol !== 'file:') return null;
    const relative = target.pathname.slice(base.pathname.length);
    // These routes have authentication, player, file, or side-effect lifecycles
    // that have not yet been migrated. Keep their existing top-level behavior.
    if (/^(?:Admin|share|api|__|logout|signout)(?:\/|$)/i.test(relative)) return null;
    if (/\.[a-z0-9]{1,8}$/i.test(relative) && !/\.html?$/i.test(relative)) return null;
    return target;
  } catch { return null; }
}
export function shouldNavigate(event, link) {
  return !!link && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey &&
    !event.shiftKey && !event.altKey && !link.hasAttribute('download') && (!link.target || link.target === '_self');
}
if (typeof document !== 'undefined') {
  const container = document.getElementById('lightcity-pages');
  if (container) {
    // Native plugin calls must originate in the top window: Android delivers
    // plugin results there, not to a nested page.
    let nativeRuntime = null;
    const nativeReady = !!(globalThis.androidBridge && globalThis.Capacitor?.nativePromise);
    globalThis.LightCityNavigationShell = {
      isAndroid: nativeReady,
      async plugins() {
        if (!nativeReady) return null;
        return nativeRuntime ??= import('./native/capacitor-core.mjs').then(({registerPlugin}) => ({
          audio: registerPlugin('LightCityAudio'), auth: registerPlugin('FirebaseAuthentication')
        }));
      }
    };
    const frames = new Map();
    const routeStack = [];
    // Bound retained pages to avoid exhausting mobile WebView memory.
    const maxRetainedPages = 8;
    let active = '';
    const frameAccounts = new WeakMap();
    let sharedAccountSignature = '';
    let accountResetting = false;
    let playingPage = '';
    const miniActions = document.getElementById('lightcity-mini-actions');
    const miniReturn = document.getElementById('lightcity-mini-return');
    const miniClose = document.getElementById('lightcity-mini-close');
    const miniResize = document.getElementById('lightcity-mini-resize');
    const audioBar = document.getElementById('lightcity-audio-bar');
    const audioTitle = document.getElementById('lightcity-audio-title');
    const audioToggle = document.getElementById('lightcity-audio-toggle');
    const audioStop = document.getElementById('lightcity-audio-stop');
    const watchedAudio = new WeakSet();
    let displayedAudio = null;
    let miniWidth = Math.min(300, Math.max(120, (globalThis.innerWidth || 324) - 24));
    function setMiniWidth(value) {
      const maxWidth = Math.max(120, Math.min((globalThis.innerWidth || 324) - 24, ((globalThis.innerHeight || 800) - 190) * 16 / 9));
      miniWidth = Math.max(120, Math.min(value, maxWidth));
      document.documentElement?.style?.setProperty('--lc-mini-width', miniWidth + 'px');
      document.documentElement?.style?.setProperty('--lc-mini-height', miniWidth * 9 / 16 + 'px');
    }
    setMiniWidth(miniWidth);
    window.addEventListener('resize', () => setMiniWidth(miniWidth));
    if (miniResize) {
      miniResize.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.preventDefault();
        const startX = event.clientX, startWidth = miniWidth;
        miniResize.setPointerCapture(event.pointerId);
        const move = e => setMiniWidth(startWidth + startX - e.clientX);
        const end = () => { miniResize.removeEventListener('pointermove', move); miniResize.removeEventListener('pointerup', end); miniResize.removeEventListener('pointercancel', end); };
        miniResize.addEventListener('pointermove', move);
        miniResize.addEventListener('pointerup', end);
        miniResize.addEventListener('pointercancel', end);
      });
      miniResize.addEventListener('keydown', event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault(); setMiniWidth(miniWidth + (event.key === 'ArrowLeft' ? 20 : -20));
      });
    }
    function updateAudioBar() {
      if (audioToggle && displayedAudio) audioToggle.textContent = displayedAudio.paused ? 'Play' : 'Pause';
    }
    if (audioTitle) audioTitle.onclick = event => { event.preventDefault(); if (playingPage) open(playingPage); };
    if (audioToggle) audioToggle.onclick = async () => {
      if (!displayedAudio) return;
      try { if (displayedAudio.paused) await displayedAudio.play(); else displayedAudio.pause(); } catch { /* The full player can show playback errors. */ }
      updateAudioBar();
    };
    if (audioStop) audioStop.onclick = async () => {
      const key = playingPage, frame = frames.get(key);
      if (!frame) return;
      pauseWatch(frame);
      try {
        const plugin = (await globalThis.LightCityNavigationShell.plugins())?.audio;
        const state = await plugin?.state();
        if (state?.videoId && state.videoId === new URL(key).searchParams.get('v')) await plugin.stop();
      } catch { /* Pausing and closing still leaves the page usable. */ }
      if (frames.get(key) === frame) { frame.remove(); frames.delete(key); }
      if (playingPage === key) playingPage = '';
      paintFrames();
    };
    function isWatch(key) {
      try { return /^watch\/?$/i.test(new URL(key).pathname.slice(base.pathname.length)); }
      catch { return false; }
    }
    function pauseWatch(frame) {
      try {
        const player = frame.contentDocument?.getElementById('watch-player');
        player?.querySelector('audio')?.pause();
        player?.querySelector('iframe')?.contentWindow?.postMessage(JSON.stringify({event:'command',func:'pauseVideo',args:[]}), '*');
      } catch { /* The player may already have been removed. */ }
    }
    function paintFrames() {
      let showAudioBar = false, showMini = false;
      displayedAudio = null;
      for (const [name, frame] of frames) {
        const mini = name === playingPage && name !== active;
        let audio = false, element = null;
        try {
          const player = frame.contentDocument?.getElementById('watch-player');
          audio = !!player?.classList.contains('lc-audio-mode');
          element = audio ? player?.querySelector('audio') : null;
        } catch {}
        const nativeAudioBar = !!(mini && audio && element && nativeReady && audioBar);
        if (nativeAudioBar) {
          showAudioBar = true;
          displayedAudio = element;
          if (audioTitle) audioTitle.textContent = frame.contentDocument?.getElementById('watch-title')?.textContent?.trim() || 'LightCity audio';
          if (!watchedAudio.has(element)) {
            watchedAudio.add(element);
            for (const event of ['play', 'pause', 'timeupdate', 'ended']) element.addEventListener(event, updateAudioBar);
          }
        }
        frame.hidden = name !== active && (!mini || nativeAudioBar);
        frame.classList.toggle('lc-preview-mini', mini && !nativeAudioBar);
        frame.classList.toggle('lc-preview-mini-audio', mini && audio && !nativeAudioBar);
        try {
          frame.contentDocument?.body?.classList.toggle('lc-preview-shell-mini', mini);
          frame.contentDocument?.body?.classList.toggle('lc-watch-minimized', mini);
          frame.contentDocument?.body?.classList.toggle('lc-watch-mini-audio', mini && audio);
        } catch {}
        if (mini && !nativeAudioBar) {
          showMini = true;
          if (miniActions) miniActions.classList.toggle('audio', audio);
          if (miniResize) miniResize.hidden = audio;
        }
      }
      if (audioBar) audioBar.hidden = !showAudioBar;
      if (miniActions) miniActions.hidden = !showMini;
      updateAudioBar();
    }
    if (miniReturn) miniReturn.onclick = () => { if (playingPage) open(playingPage); };
    if (miniClose) miniClose.onclick = () => {
      const frame = frames.get(playingPage);
      if (frame) { pauseWatch(frame); frame.remove(); frames.delete(playingPage); }
      playingPage = '';
      paintFrames();
    };
    // A retained page does not run its startup theme code again when selected.
    // Keep its current controls and stylesheet consistent with the saved choice.
    function syncTheme(frame) {
      try {
        const doc = frame.contentDocument;
        if (!doc?.body) return;
        const saved = localStorage.getItem('theme');
        const dark = saved === 'darkMODE' || (saved !== 'lightMODE' && matchMedia('(prefers-color-scheme: dark)').matches);
        const sheet = doc.getElementById('theme-stylesheet');
        if (sheet?.href) sheet.href = new URL((dark ? 'darkMODE' : 'lightMODE') + '.css', sheet.href).href;
        doc.documentElement.toggleAttribute('data-lc-initial-dark', dark);
        doc.body.classList.toggle('darkmode', dark);
        const toggle = doc.getElementById('theme-toggle');
        if (toggle) toggle.checked = dark;
      } catch { /* Storage or a frame may be unavailable. */ }
    }
    window.addEventListener('storage', event => {
      if (event.key === 'theme') for (const frame of frames.values()) syncTheme(frame);
    });
    const initialURL = new URL(sections.get('home'), base);
    const memberDocuments = new WeakSet();
    function attachMemberSync(frame, key, doc) {
      if (memberDocuments.has(doc)) return;
      memberDocuments.add(doc);
      // Only a frame that was previously verified can signal a change of
      // identity. Startup guest/loading events from other frames cannot
      // evict or reveal another member's content.
      const onMemberChange = () => {
        if (accountResetting) return;
        const member = frame.contentWindow.LightCityMembers;
        if (!member || member.loading) return;
        const uid = member.user && !member.user.isAnonymous ? member.user.uid : null;
        const previous = frameAccounts.get(frame);
        frameAccounts.set(frame, uid);
        if (previous && previous !== uid) {
          // Clear inherited access immediately and remove retained pages
          // before another account can see the previous account's state.
          accountResetting = true;
          globalThis.LightCityMembers = null;
          sharedAccountSignature = '';
          window.dispatchEvent(new Event('lightcity-members-changed'));
          for (const [otherKey, other] of frames) {
            if (other === frame) continue;
            if (otherKey === playingPage) { pauseWatch(other); playingPage = ''; }
            other.remove(); frames.delete(otherKey);
          }
          if (!frames.has(active)) open(key, false);
          accountResetting = false;
          paintFrames();
          return;
        }
        if (!uid || !Array.isArray(member.library)) return;
        const signature = JSON.stringify([uid, member.library, member.publicLibrary]);
        if (signature === sharedAccountSignature) return;
        sharedAccountSignature = signature;
        globalThis.LightCityMembers = {
          user: member.user, library: member.library.slice(),
          publicLibrary: member.publicLibrary, loading: false
        };
        window.dispatchEvent(new Event('lightcity-members-changed'));
      };
      frame.contentWindow.addEventListener('lightcity-members-changed', onMemberChange);
      onMemberChange();
    }
    const attachedDocuments = new WeakSet();
    function attachNavigation(frame) {
      try {
        const doc = frame.contentDocument;
        const current = frame.contentWindow.location.href;
        if (!doc || current === 'about:blank' || new URL(current).origin !== base.origin || attachedDocuments.has(doc)) return false;
        attachedDocuments.add(doc);
        attachMemberSync(frame, frame.src, doc);
        doc.addEventListener('click', event => {
              const link = event.target.closest?.('a[href]');
              if (!shouldNavigate(event, link)) return;
              const current = frame.contentWindow.location.href;
              const destination = new URL(link.href, current);
              // Preserve in-page anchors and browser behavior for external URLs.
              const now = new URL(current);
              if (destination.origin !== now.origin || (destination.pathname === now.pathname && destination.search === now.search && destination.hash)) return;
              const page = pageFor(destination.href, current);
              if (!page) {
                if (destination.origin === location.origin) { event.preventDefault(); window.location.assign(destination.href); }
                return;
              }
              event.preventDefault();
              open(page.href);
        }, true);
        return true;
      } catch { return false; }
    }
    function open(input, push = true) {
      const target = pageFor(input) || initialURL;
      const key = target.href;
      if (active === key) return;
      let frame = frames.get(key);
      if (!frame) {
        frame = document.createElement('iframe');
        frame.title = 'LightCity page';
        frame.allow = 'autoplay; fullscreen; picture-in-picture';
        frame.src = key;
        let pollTimer;
        const stopAt = Date.now() + 30000;
        const attachEarly = () => {
          if (attachNavigation(frame) || frame.isConnected === false || Date.now() >= stopAt) return;
          pollTimer = setTimeout(attachEarly, 25);
          pollTimer?.unref?.();
        };
        frame.addEventListener('load', () => {
          clearTimeout(pollTimer);
          try {
            const doc = frame.contentDocument;
            syncTheme(frame);
            attachMemberSync(frame, key, doc);
            if (isWatch(key)) {
              const style = doc.createElement('style');
              style.textContent = 'body.lc-preview-shell-mini>*{visibility:hidden!important}body.lc-preview-shell-mini .watch-main,body.lc-preview-shell-mini #watch-player{visibility:visible!important}body.lc-preview-shell-mini .watch-main>*:not(#watch-player){visibility:hidden!important}body.lc-preview-shell-mini #watch-player{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;margin:0!important;border-radius:12px!important;overflow:hidden!important}body.lc-preview-shell-mini #watch-player iframe{height:100%!important;max-height:none!important}';
              doc.head.append(style);
              const player = doc.getElementById('watch-player');
              const updatePlayback = () => {
                if (!player || player.hidden) return;
                const audio = player.classList.contains('lc-audio-mode') && player.querySelector('audio');
                const video = player.querySelector('iframe');
                if (audio || (video && !video.hidden)) {
                  if (playingPage && playingPage !== key) pauseWatch(frames.get(playingPage));
                  playingPage = key;
                  paintFrames();
                }
              };
              if (player) new MutationObserver(updatePlayback).observe(player, {attributes:true,childList:true,subtree:true});
              updatePlayback();
            }
            attachNavigation(frame);
          } catch { /* Inaccessible documents retain normal browser behavior. */ }
        });
        frames.set(key, frame);
        container.append(frame);
        attachEarly();
      }

      // Move the selected page to the end so only the least recently used
      // inactive page is discarded when the cache reaches its limit.
      frames.delete(key);
      frames.set(key, frame);
      while (frames.size > maxRetainedPages) {
        const candidate = [...frames.entries()].find(([name]) => name !== key && name !== playingPage);
        if (!candidate) break;
        const [oldest, oldFrame] = candidate;
        oldFrame.remove();
        frames.delete(oldest);
      }
      active = key;
      paintFrames();
      syncTheme(frame);
      if (push) {
        routeStack.push(key);
        const url = new URL(location.href); url.searchParams.set('page', target.pathname + target.search + target.hash); url.searchParams.delete('section');
        history.pushState({ lightcityPage: key }, '', url);
      }
    }
    window.addEventListener('popstate', event => {
      const destination = event.state?.lightcityPage || initialURL.href;
      const position = routeStack.lastIndexOf(destination);
      if (position >= 0) routeStack.splice(position + 1);
      else routeStack.push(destination);
      open(destination, false);
    });
    globalThis.LightCityNavigationShell.refresh = () => {
      const frame = frames.get(active);
      if (!frame) return false;
      try {
        const doc = frame.contentDocument;
        if (!doc || (doc.scrollingElement?.scrollTop || 0) > 0) return false;
        // Reload just the visible page. The shell, navigation history, other
        // retained pages and any separate player continue to exist.
        frame.contentWindow.location.reload();
        return true;
      } catch { return false; }
    };
    globalThis.LightCityNavigationShell.back = () => {
      if (routeStack.length < 2) return false;
      routeStack.pop();
      const destination = routeStack[routeStack.length - 1];
      open(destination, false);
      const current = new URL(location.href), target = new URL(destination);
      current.searchParams.set('page', target.pathname + target.search + target.hash);
      current.searchParams.delete('section');
      history.replaceState({ ...history.state, lightcityPage: destination }, '', current);
      return true;
    };
    const args = new URL(location.href).searchParams;
    const start = (args.has('page') && pageFor(args.get('page'))) || new URL(sections.get(sections.has(args.get('section')) ? args.get('section') : 'home'), base);
    history.replaceState({ ...history.state, lightcityPage: start.href }, '', location.href);
    routeStack.push(start.href);
    open(start.href, false);
  }
}
