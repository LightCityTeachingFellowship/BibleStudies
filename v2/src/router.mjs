// Shared single-document router. Page modules own only their view lifecycle;
// authentication and playback live in the application, outside this container.
export function createRouter({ outlet, routes, history, location, onError = () => {}, onChange = () => {} }) {
  let current = null, generation = 0, pending = null, destroyed = false, historyIndex = 0;
  const scroll = new Map();
  const resolve = input => new URL(input, location.href);
  function matches(url) { return url.origin === location.origin && routes.some(route => route.match(url)); }
  async function navigate(input, { replace = false, pop = false } = {}) {
    const url = resolve(input), route = routes.find(item => item.match(url));
    if (destroyed || url.origin !== location.origin || !route) return false;
    const id = ++generation;
    pending?.abort();
    const controller = new AbortController(); pending = controller;
    try {
      // Fetch and construct before leaving the current view; failures keep it usable.
      const view = await route.load({ url, signal: controller.signal });
      if (destroyed || id !== generation || controller.signal.aborted) { view.dispose?.(); return false; }
      const old = current;
      if (old) scroll.set(old.url.href, outlet.scrollTop);
      // The view is detached while prepared so clicks and rendering never act on a partial page.
      await view.prepare?.({ signal: controller.signal });
      if (destroyed || id !== generation || controller.signal.aborted) { view.dispose?.(); return false; }
      old?.dispose?.();
      outlet.replaceChildren(view.element);
      current = { ...view, url };
      if (pop) historyIndex = Number.isInteger(history.state?.lightcityIndex) ? history.state.lightcityIndex : 0;
      else { if (!replace) historyIndex++; history[replace ? 'replaceState' : 'pushState']({ ...history.state, lightcityRoute: url.href, lightcityIndex: historyIndex }, '', url.href); }
      const restoredScroll = pop ? (scroll.get(url.href) || 0) : 0;
      outlet.scrollTop = restoredScroll;
      view.activate?.({scrollTop:restoredScroll,isHistory:pop});
      onChange(url);
      return true;
    } catch (error) {
      if (error?.name !== 'AbortError' && id === generation) onError(error, url);
      return false;
    } finally { if (pending === controller) pending = null; }
  }
  function destroy() { destroyed = true; ++generation; pending?.abort(); current?.dispose?.(); current = null; }
  function back() { if (historyIndex <= 0) return false; history.back(); return true; }
  return { navigate, matches, back, destroy, get currentURL() { return current?.url ?? null; } };
}
export function isOrdinaryLink(event, anchor) {
  return Boolean(anchor && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !anchor.hasAttribute('download') && (!anchor.target || anchor.target === '_self'));
}
