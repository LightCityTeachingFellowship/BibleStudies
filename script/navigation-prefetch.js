/* Prepare same-site pages when a user shows intent to open them. */
(() => {
  const connection = navigator.connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
  const prepared = new Set();
  function prepare(event) {
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    let url;
    try { url = new URL(anchor.href, location.href); } catch { return; }
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol) || url.username || url.password) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    // Never speculate on administrative, authentication or potentially state-changing routes.
    if (/^\/(?:Admin|members|api|__|logout|signout)(?:\/|$)/i.test(url.pathname)) return;
    if (url.search || url.hash || prepared.has(url.href) || prepared.size >= 8) return;
    prepared.add(url.href);
    const hint = document.createElement('link');
    hint.rel = 'prefetch'; hint.href = url.href; hint.as = 'document';
    document.head.appendChild(hint);
  }
  document.addEventListener('pointerover', prepare, { passive: true });
  document.addEventListener('touchstart', prepare, { passive: true });
  document.addEventListener('focusin', prepare);
})();
