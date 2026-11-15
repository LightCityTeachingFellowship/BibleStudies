// Enter the persistent shell on the first ordinary same-site navigation.
// Direct URLs, authentication, administration, downloads and Watch playback
// retain their existing top-level behavior.
(() => {
  if (window !== window.top) return;
  const script = document.currentScript;
  const base = new URL(script?.dataset.base || '/', location.origin);
  const shell = new URL('app/', base);
  const ownPath = location.pathname.slice(base.pathname.length).replace(/^\/+/, '');
  if (/^(?:app|Watch|Admin|members|share|api|__|logout|signout)(?:\/|$)/i.test(ownPath)) return;
  window.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    let target;
    try { target = new URL(link.href, location.href); } catch { return; }
    if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) return;
    const route = target.pathname.slice(base.pathname.length).replace(/^\/+/, '');
    if (/^(?:app|Admin|members|share|api|__|logout|signout)(?:\/|$)/i.test(route)) return;
    if (/\.[a-z0-9]{1,8}$/i.test(route) && !/\.html?$/i.test(route)) return;
    if (target.pathname === location.pathname && target.search === location.search) return;
    const destination = new URL(shell);
    destination.searchParams.set('page', target.pathname + target.search + target.hash);
    event.preventDefault();
    location.assign(destination.href);
  });
})();
