//this for tables in articles and summaries to fit into view or overflow nicely
var getTables = document.querySelectorAll('main>table');
var getTablesArray = [...getTables];
getTablesArray.forEach(element => {
  var createElemApTable = document.createElement('div')
  createElemApTable.classList.add('table-container');
  // Get the parent of the element
  var parentElement = element.parentElement;
  // Insert createElemApTable before the element
  parentElement.insertBefore(createElemApTable, element);
  // Move the table into createElemApTable
  createElemApTable.appendChild(element);
});

// Remove the the last element in the archive page
const archiveElements = document.getElementsByClassName('archive');
// Ensure there are elements with the class "archive" before attempting to remove.
if (archiveElements.length > 0) {
  const lastArchiveElement = archiveElements[archiveElements.length - 1];
  const lastChild = lastArchiveElement.lastElementChild;
  if (lastChild) {
    // Check if there is a last child element to remove.
    lastArchiveElement.removeChild(lastChild);
  }
}

//search
const searchInput = document.getElementById("search-input");
const searchResultsContainer = document.getElementById("results-container");
const searchResultsContainerInner = document.getElementById("results-container-inner");
let observer; // Declare observer variable

// Event listener for highlighting and updating search results count
searchInput?.addEventListener("input", () => {
    const searchQuery = searchInput.value.toLowerCase();
    updateSearchResults(searchQuery);
    handleHighLight(searchQuery);
});

// Function to highlight text in articles and summaries
function highlightText(text, searchQuery) {
    const escapedSearchQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedSearchQuery, 'gi');
    return text.replace(regex, (match) => `<span class="highlighted">${match}</span>`);
}

// Function to handle video highlight
function handleHighLight(searchQuery) {
    // Disconnect the observer if it's already connected
    if (observer) {
        observer.disconnect();
    }
    const artSumLinks = searchResultsContainerInner.querySelectorAll("li");
    artSumLinks.forEach((artSumLink) => {
        const artSumLinkElement = artSumLink.querySelector("a");
        if (artSumLinkElement) {
            const artSumLinkElementText = artSumLinkElement.textContent;
            if (artSumLinkElementText) {
                const highlightedTitle = highlightText(artSumLinkElementText, searchQuery);
                artSumLinkElement.innerHTML = highlightedTitle;
            }
        }
    });
    // Create the observer if it doesn't exist
    if (!observer) {
        observer = new MutationObserver(() => {
            handleHighLight(searchInput.value.toLowerCase());
        });
    }
    // Reconnect the observer to detect further changes
    observer.observe(searchResultsContainerInner, { childList: true, subtree: true, attributes: true });
}

// Function to update search results count
function updateSearchResults(searchQuery) {
    // Clear previous result count element if it exists
    const previousCountElement = searchResultsContainer.querySelector('.displayedLinkCountElement');
    if (previousCountElement) previousCountElement.remove();

    if (searchQuery) {
        const artSumLinks = searchResultsContainerInner.querySelectorAll("li");
        let displayedLinkCount = 0;

        artSumLinks.forEach((artSumLink) => {
            const artSumLinkElement = artSumLink.querySelector("a");
            if (artSumLinkElement) {
                const artSumLinkElementText = artSumLinkElement.textContent.toLowerCase();
                if (artSumLinkElementText.includes(searchQuery)) {
                    artSumLink.style.display = ""; // Show matching results
                    displayedLinkCount++;
                } else {
                    artSumLink.style.display = "none"; // Hide non-matching results
                }
            }
        });

        const displayedLinkCountElement = document.createElement('em');
        displayedLinkCountElement.classList.add('displayedLinkCountElement');
        if (displayedLinkCount === 0) {
            displayedLinkCountElement.innerHTML = 'Search Result: No match found...';
            searchResultsContainerInner.style.maxHeight = '0';
        } else if (displayedLinkCount === 1) {
            displayedLinkCountElement.innerHTML = 'Search Result: 1 result.';
        } else {
            displayedLinkCountElement.innerHTML = `Search Result: ${displayedLinkCount} results.`;
            applyStyles();
            window.addEventListener('resize', applyStyles);
        }

        searchResultsContainer.prepend(displayedLinkCountElement);
        searchResultsContainer.style.paddingTop = '30px';
        searchResultsContainerInner.style.marginTop = displayedLinkCount === 0 ? '0' : '6px';
    } else {
        searchResultsContainer.style.removeProperty('padding-top');
        searchResultsContainerInner.style.removeProperty('margin-top');
        searchResultsContainerInner.style.maxHeight = '0';
        searchResultsContainerInner.innerHTML = '';
    }
}

// Function to apply styles based on screen size
function applyStyles() {
  let maxHeight;
      if (window.matchMedia("(max-width: 600px)").matches) {
          maxHeight = '300px';
      } else {
          maxHeight = '350px';
      }
      searchResultsContainerInner.style.maxHeight = maxHeight;
  }

//Reverse the arrangement of summary categories (could not achive this with Jekyll at this time)
// Enhance the featured home video without affecting other content pages.
(() => {
  const video = document.querySelector('.home-featured[data-video-id]');
  if (!video) return;
  const initial = { id: video.dataset.videoId, title: video.querySelector('.home-video-title').textContent, url: video.dataset.watchUrl || video.href };
  let controller;
  function updateFeatured(item = initial) {
  const id = item.id;
  controller?.abort();
  if (!/^[\w-]{11}$/.test(id || '')) { video.hidden = true; return; }
  const changed = video.dataset.videoId !== id;
  video.hidden = false;
  video.dataset.videoId = id;
  const link = new URL(initial.url, location.href); link.searchParams.set('v', id); video.href = link.href;
  video.dataset.watchUrl = link.href;
  video.querySelectorAll?.('[data-featured-watch]').forEach(anchor => { anchor.href = link.href; });
  video.querySelector('.home-video-title').textContent = item.title || 'LightCity’s latest teaching';
  // YouTube can return a small placeholder instead of an HTTP error for a
  // missing HD thumbnail. Check its actual width before keeping that source.
  const thumbnail = video.querySelector('.home-video-image');
  if (thumbnail) {
    const variants = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault'];
    let variant = 0;
    function useNextThumbnail() {
      if (variant >= variants.length - 1) return;
      thumbnail.src = 'https://i.ytimg.com/vi/' + id + '/' + variants[++variant] + '.jpg';
    }
    thumbnail.onerror = useNextThumbnail;
    thumbnail.onload = () => {
      if (thumbnail.naturalWidth < 320) useNextThumbnail();
    };
    if (changed) thumbnail.src = 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg';
    if (thumbnail.complete && thumbnail.naturalWidth < 320) useNextThumbnail();
  }
  controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id) + '&format=json', { signal: controller.signal })
    .then(response => { if (!response.ok) throw new Error('Video metadata unavailable'); return response.json(); })
    .then(data => {
      if (video.dataset.videoId === id && typeof data.title === 'string' && data.title.trim()) {
        video.querySelector('.home-video-title').textContent = data.title;
      }
    })
    .catch(() => { /* Keep the direct video link usable when metadata is unavailable. */ })
    .finally(() => clearTimeout(timeout));
  }
  function renderFeaturedAudience() {
    if (globalThis.LightCityMembers?.loading) return;
    updateFeatured(globalThis.LightCityMembers?.library?.[0] || globalThis.LightCityMembers?.publicLibrary?.[0] || initial);
  }
  renderFeaturedAudience();
  window.addEventListener('lightcity-members-changed', renderFeaturedAudience);
})();

const categories = document.getElementsByClassName('postCategories')[0];
const categoriesChildrenToRev = categories ? Array.from(categories?.getElementsByClassName('homeResources-grid-containter')) : [];
categoriesChildrenToRev?.reverse();
for (const homeResourcesGridContainter of categoriesChildrenToRev) {
  categories.appendChild(homeResourcesGridContainter);

}



// Homepage search: one accessible panel for every content type.
(() => {
  const dialog = document.getElementById('home-search-dialog');
  if (!dialog) return;
  const desktop = document.getElementById('home-search-desktop');
  const query = document.getElementById('home-search-query');
  const results = document.getElementById('home-search-results');
  const status = document.getElementById('home-search-status');
  const warning = document.getElementById('home-search-warning');
  const retry = document.getElementById('home-search-retry');
  const more = document.getElementById('home-search-more');
  const filters = [...dialog.querySelectorAll('[data-kind]')];
  const scope = ['Video', 'Article', 'Summary'].includes(dialog.dataset.scope) ? dialog.dataset.scope : 'All';
  const includeVideos = scope === 'All' || scope === 'Video';
  const normalize = text => String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  let items = [], kind = scope, limit = 30, loading = false, loadPromise, pendingVideos = 0, loadVersion = 0;
  let problems = [];
  const key = 'lightcity-video-search-v1';
  const videoCache = new Map();
  try {
    const cached = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(cached)) cached.forEach(item => {
      if (/^[\w-]{11}$/.test(item.id) && typeof item.title === 'string') videoCache.set(item.id, item);
    });
  } catch {}
  function prepare(item) {
    return { ...item, titleKey: normalize(item.title), metadataKey: normalize((item.categories || '') + ' ' + (item.tags || '')), textKey: normalize(item.text) };
  }
  function localLink(value) {
    try {
      const link = new URL(value, location.href);
      return link.origin === location.origin && /^https?:$/.test(link.protocol) ? link.href : null;
    } catch { return null; }
  }
  function videoItem(item) {
    const link = new URL(dialog.dataset.watch, location.href);
    link.searchParams.set('v', item.id);
    return prepare({ title: item.title, url: link.href, kind: 'Video', videoId: item.id, text: '' });
  }
  function addText(parent, tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    parent.appendChild(node);
    return node;
  }
  function render() {
    const term = normalize(query.value);
    const tokens = term.split(' ').filter(Boolean);
    results.replaceChildren();
    more.hidden = true;
    warning.hidden = problems.length === 0;
    warning.textContent = problems.join(' ');
    retry.hidden = problems.length === 0 || loading;
    if (!tokens.length) {
      status.textContent = dialog.dataset.description || 'Search video titles, articles and summaries.';
      return;
    }
    const matches = items.filter(item => (scope === 'All' || item.kind === scope) && (kind === 'All' || item.kind === kind))
      .filter(item => tokens.every(token => (item.titleKey + ' ' + item.metadataKey + ' ' + item.textKey).includes(token)))
      .map(item => ({ item, score: (item.titleKey === term ? 100 : 0) + (item.titleKey.includes(term) ? 30 : 0) + tokens.reduce((score, token) => score + (item.titleKey.includes(token) ? 8 : item.metadataKey.includes(token) ? 3 : 0), 0) }))
      .sort((a, b) => b.score - a.score);
    status.textContent = loading && !items.length ? 'Loading search…' : matches.length + (matches.length === 1 ? ' result' : ' results') + (loading ? ' · Loading…' : pendingVideos ? ' · Updating video titles…' : '');
    if (!matches.length && !loading) status.textContent = pendingVideos ? 'No matches yet. Updating video titles…' : scope === 'All' ? 'No matches found. Try another word or choose All.' : 'No matches found. Try another word.';
    for (const { item } of matches.slice(0, limit)) {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = item.url;
      addText(link, 'span', item.kind, 'home-result-kind');
      addText(link, 'strong', item.title);
      const text = String(item.text || '').replace(/\s+/g, ' ').trim();
      if (text) {
        const index = text.toLowerCase().indexOf(query.value.trim().toLowerCase());
        const start = Math.max(0, index - 45);
        addText(link, 'span', (start ? '…' : '') + text.slice(start, start + 170) + (text.length > start + 170 ? '…' : ''), 'home-result-excerpt');
      }
      if(item.videoId){li.dataset.videoId=item.videoId;li.className='lc-search-video-result';}
      else if(['Article','Summary'].includes(item.kind)){li.dataset.studyUrl=item.url;li.className='lc-search-reading-result';}
      li.appendChild(link);
      results.appendChild(li);
    }
    more.hidden = matches.length <= limit;
    if(matches.length&&typeof Event!=='undefined')window.dispatchEvent?.(new Event('lightcity-search-results'));
  }
  async function json(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Search data unavailable');
    return response.json();
  }
  async function updateMissing(ids, current, publicIds) {
    const missing = ids.filter(id => !videoCache.has(id));
    pendingVideos = missing.length;
    let failed = 0;
    await Promise.all(Array.from({ length: Math.min(4, missing.length) }, async () => {
      while (missing.length) {
        if (current !== loadVersion) return;
        const id = missing.shift();
        try {
          const data = await json('https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id) + '&format=json');
          if (current !== loadVersion) return;
          if (typeof data.title !== 'string' || !data.title.trim()) throw new Error('Missing title');
          videoCache.set(id, { id, title: data.title });
          items.push(videoItem({ id, title: data.title }));
        } catch { failed++; }
        if (current !== loadVersion) return;
        pendingVideos--;
        if (dialog.open) render();
      }
    }));
    if (current !== loadVersion) return;
    // Member metadata stays in memory and is never written to the persistent search cache.
    try { localStorage.setItem(key, JSON.stringify(publicIds.flatMap(id => videoCache.has(id) ? [videoCache.get(id)] : []))); } catch {}
    if (failed) problems.push('Some video titles could not be loaded. Retry when you are online.');
    if (dialog.open) render();
  }
  async function load() {
    if (loadPromise) return loadPromise;
    const current = ++loadVersion;
    loading = true;
    problems = [];
    render();
    loadPromise = (async () => {
      if (includeVideos) await globalThis.LightCityMembers?.ready;
      if (current !== loadVersion) return;
      const fetched = await Promise.allSettled([json(dialog.dataset.index), includeVideos ? json(dialog.dataset.videos) : Promise.resolve([])]);
      if (current !== loadVersion) return;
      const main = fetched[0].status === 'fulfilled' ? fetched[0].value : null;
      const catalogue = fetched[1].status === 'fulfilled' ? fetched[1].value : null;
      if (Array.isArray(catalogue)) catalogue.forEach(item => {
        if (/^[\w-]{11}$/.test(item.id) && typeof item.title === 'string') videoCache.set(item.id, item);
      });
      const validMain = main && Array.isArray(main.publications) && Array.isArray(main.videoIds);
      // Fall back only to the current catalogue, never to old cached member IDs.
      const publicIds = includeVideos ? [...new Set(validMain ? main.videoIds.filter(id => /^[\w-]{11}$/.test(id)) : (Array.isArray(catalogue) ? catalogue.filter(item => /^[\w-]{11}$/.test(item.id)).map(item => item.id) : []))] : [];
      const memberLibrary = includeVideos && Array.isArray(globalThis.LightCityMembers?.library) ? globalThis.LightCityMembers.library : null;
      if (memberLibrary) memberLibrary.forEach(item => { if (/^[\w-]{11}$/.test(item.id) && typeof item.title === 'string') videoCache.set(item.id, item); });
            const publicLibrary=globalThis.LightCityMembers?.publicLibrary;
      if(!memberLibrary&&Array.isArray(publicLibrary))publicLibrary.forEach(item=>videoCache.set(item.id,item));
      const ids = memberLibrary ? memberLibrary.map(item => item.id) : Array.isArray(publicLibrary)?publicLibrary.map(item=>item.id):publicIds;
      items = validMain ? main.publications.flatMap(item => {
        const url = localLink(item.url);
        return url && typeof item.title === 'string' && ['Article', 'Summary'].includes(item.kind) && (scope === 'All' || item.kind === scope) ? [prepare({ ...item, url })] : [];
      }) : [];
      if (!validMain && scope !== 'Video') problems.push((scope === 'All' ? 'Articles and summaries' : scope === 'Article' ? 'Articles' : 'Summaries') + ' could not be loaded. Retry when you are online.');
      items.push(...ids.flatMap(id => videoCache.has(id) ? [videoItem(videoCache.get(id))] : []));
      loading = false;
      render();
      if (includeVideos) await updateMissing(ids, current, publicIds);
      if (current !== loadVersion) return;
      if (includeVideos && !catalogue && !ids.length) problems.push('Videos could not be loaded. Retry when you are online.');
      if (dialog.open) render();
    })();
    return loadPromise;
  }
  function openSearch(value = '') {
    query.value = value;
    limit = 30;
    if (!dialog.open) dialog.showModal();
    query.focus();
    query.setSelectionRange?.(query.value.length, query.value.length);
    render();
    void load();
  }
  desktop.addEventListener('input', () => openSearch(desktop.value));
  desktop.closest('form').addEventListener('submit', event => { event.preventDefault(); openSearch(desktop.value); });
  document.querySelector('.home-search-mobile').addEventListener('click', () => openSearch(desktop.value));
  dialog.querySelector('.home-search-close').addEventListener('click', () => dialog.close());
  // Native dialog backdrops target the dialog itself. Check its bounds so clicks
  // on panel padding stay open, and drags beginning inside never dismiss it.
  const outsideSearch = event => {
    const bounds = dialog.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom;
  };
  let searchBackdropPointer = false;
  dialog.addEventListener('pointerdown', event => {
    searchBackdropPointer = event.target === dialog && outsideSearch(event);
  });
  dialog.addEventListener('pointercancel', () => { searchBackdropPointer = false; });
  dialog.addEventListener('click', event => {
    if (searchBackdropPointer && event.target === dialog && outsideSearch(event)) dialog.close();
    searchBackdropPointer = false;
  });
  dialog.addEventListener('close', () => { searchBackdropPointer = false; desktop.value = query.value; });
  let debounce;
  query.addEventListener('input', () => {
    desktop.value = query.value;
    limit = 30;
    clearTimeout(debounce);
    debounce = setTimeout(render, 120);
  });
  filters.forEach(button => button.addEventListener('click', () => {
    kind = scope === 'All' ? button.dataset.kind : scope;
    limit = 30;
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    render();
  }));
  more.addEventListener('click', () => { limit += 30; render(); });
  retry.addEventListener('click', () => { loadPromise = null; void load(); });
  window.addEventListener('lightcity-members-changed', () => {
    ++loadVersion; loadPromise = null; items = []; pendingVideos = 0; loading = false; problems = [];
    videoCache.clear(); render();
    if (dialog.open) void load();
  });
})();
