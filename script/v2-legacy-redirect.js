// Existing content remains available to the embedded reader and as a fallback.
// Direct visits use the matching view in the unified app.
(() => {
  const tag = document.currentScript;
  if (!tag || window !== window.top) return;
  const current = new URL(window.location.href);
  if (current.searchParams.has('lc-preview-reader') || current.searchParams.get('lc-legacy') === '1') return;
  const layout = tag.dataset.layout;
  let destination;
  if (['articleTEMPLATE', 'summaryTEMPLATE', 'summaryTEMPLATE2', 'summaryTEMPLATE3'].includes(layout)) {
    destination = new URL('/v2/read/', current.origin);
    destination.searchParams.set('url', current.pathname);
    if (current.searchParams.get('continue') === 'reading') destination.searchParams.set('continue', 'reading');
    destination.hash = current.hash;
  } else if (layout === 'cat-homepageTEMPLATE' || layout === 'cat-homepageTEMPLATE-summary') {
    destination = new URL('/v2/categories/', current.origin);
    destination.searchParams.set('kind', layout === 'cat-homepageTEMPLATE' ? 'Article' : 'Summary');
    if (current.pathname.toLowerCase().replace(/\/+$/, '') === '/categories') {
      if (/^#[a-z0-9-]+$/i.test(current.hash)) destination.searchParams.set('name', current.hash.slice(1));
    } else if (tag.dataset.name) destination.searchParams.set('name', tag.dataset.name);
  }
  if (!destination) {
    let path;
    try { path = decodeURIComponent(current.pathname).toLowerCase().replace(/\/+$/, '') + '/'; } catch { return; }
    const routes = new Set(['/videos/','/listen/','/watch/','/teaching-articles/','/teaching-summary/','/mylibrary/','/myvideos/','/bible quiz/','/bible-quiz/','/calendar/','/about-us/','/about/','/join-us/','/doctrines/','/study-resources/']);
    if (routes.has(path)) {
      destination = new URL('/v2/', current.origin);
      destination.searchParams.set('open', current.href);
    }
  }
  if (destination) window.location.replace(destination.href);
})();
