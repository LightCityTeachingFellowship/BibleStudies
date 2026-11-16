/* Prepare safe same-site pages before they are needed. */
(() => {
  const connection = navigator.connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
  const prepared = new Set();
  function prepareAnchor(anchor) {
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    let url;
    try { url = new URL(anchor.href, location.href); } catch { return; }
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol) || url.username || url.password) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    // Account, admin, playback and parameterized URLs must keep their normal loading behavior.
    if (/^\/(?:Admin|members|api|__|logout|signout|Watch)(?:\/|$)/i.test(url.pathname)) return;
    if (url.search || url.hash || prepared.has(url.href) || prepared.size >= 8) return;
    prepared.add(url.href);
    const hint = document.createElement('link');
    hint.rel = 'prefetch'; hint.href = url.href; hint.as = 'document';
    document.head.appendChild(hint);
  }
  function prepare(event) {
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    prepareAnchor(anchor);
  }
  document.addEventListener('pointerover', prepare, { passive: true });
  document.addEventListener('touchstart', prepare, { passive: true });
  document.addEventListener('focusin', prepare);
  // The main sections are likely next destinations; warm them after the current
  // page has finished loading rather than waiting for the user's first tap.
  const warmNavigation = () => {
    if (document.hidden || window.frameElement?.hidden || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
    document.querySelectorAll('.home-bottom-nav a[href]').forEach(prepareAnchor);
  };
  const schedule = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(warmNavigation, { timeout: 5000 });
    else window.setTimeout(warmNavigation, 1500);
  };
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
})();
