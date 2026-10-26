/**
 * A lightweight youtube embed. Still should feel the same to the user, just MUCH faster to initialize and paint.
 *
 * Thx to these as the inspiration
 *   https://storage.googleapis.com/amp-vs-non-amp/youtube-lazy.html
 *   https://autoplay-youtube-player.glitch.me/
 *
 * Once built it, I also found these:
 *   https://github.com/ampproject/amphtml/blob/master/extensions/amp-youtube (👍👍)
 *   https://github.com/Daugilas/lazyYT
 *   https://github.com/vb/lazyframe
 */
// const liteVideosIds = document.querySelectorAll('lite-youtube');
// const videoIds = [];

// // Iterate over each button to extract the 'videoid' attribute value
// liteVideosIds.forEach((button, index) => {
//         const category = button.getAttribute('videoid');
//         if (category) {
//             videoIds.push(category);
//         }
// });

// // Create a formatted string with single quotes around each video ID
// const formattedVideoIds = videoIds.map(id => `${id}`).join(',\n');

// // Log the formatted string
// console.log(formattedVideoIds);

// // Copy the formatted string to the clipboard
// navigator.clipboard.writeText(formattedVideoIds)
//     .then(() => {
//         console.log('Copied to clipboard:', formattedVideoIds);
//     })
//     .catch(err => {
//         console.error('Error copying to clipboard:', err);
//     });


// function videoIds() {
    const ImportvideoIdsString = document.getElementById('videoIDS');
    const videoCategoryData = document.getElementById('video-category-data');
    const savedVideoCategories = videoCategoryData ? JSON.parse(videoCategoryData.textContent) : {};
    const publicVideoCategories = { ...savedVideoCategories };
    const savedVideoTitles = JSON.parse(document.getElementById('video-title-data')?.textContent || '{}');
    const publicVideoTitles = { ...savedVideoTitles };
    const videoIdsString = ImportvideoIdsString?.textContent?.trim() || Object.keys(savedVideoCategories).join(' ');
    // Convert the string to an array of video IDs
    // const videoIds = videoIdsString.split(',').map(id => id.trim());

    // Convert the multiline string to an array
    const publicVideoIds = videoIdsString.trim().split(/\s+/).filter(id => /^[\w-]{11}$/.test(id));
    const videoIds = [...publicVideoIds];
    let renderedAudience = null;
    // Function to create and append video cards
    let cardBuildVersion = 0;
    function createVideoCards(videoIds) {
        const generation = ++cardBuildVersion, ids = [...videoIds];
        const container = document.getElementById('All-Tab-content');
        container.innerHTML = '';
        syncVideoCategoryTab.copies = new Map();
        let index = 0;
        function batch() {
            if (generation !== cardBuildVersion) return;
            const end = Math.min(index + 24, ids.length), fragment = document.createDocumentFragment();
            for (; index < end; index++) {
                const videoId = ids[index], card = document.createElement('div');
                card.className = 'video-box homeResources-grid-containter bg-color';
                card.setAttribute('data-video-id', videoId); card.setAttribute('data-video-order', index);
                const viewport = document.createElement('div'); viewport.className = 'iframe-container';
                const player = document.createElement('lite-youtube');
                player.setAttribute('videoid', videoId); player.setAttribute('params', 'controls=1');
                viewport.appendChild(player); card.appendChild(viewport); fragment.appendChild(card);
            }
            container.appendChild(fragment);
            if (index < ids.length) setTimeout(batch, 0);
            else videoCloneToOtherTabs();
        }
        batch();
    }
    // Initial call to create the video cards
    setTimeout(() => {
      renderAudienceVideos();
    }, 1);    
    // Function to add a new video ID and update the structure
    function addVideoId(newVideoId) {
        videoIds.push(newVideoId.trim());
        createVideoCards(videoIds);
    }
// }

const buttons = document.querySelectorAll('.videos-header-btns');
const videoCategories = [];
// Iterate over each button to extract the 'data-original-text' attribute value
buttons.forEach((button, index) => {
    if (index > 0) { // Start from the second button (index 1)
        const category = button.getAttribute('videoCategory-btn');
        if (category) {
            videoCategories.push(category);
        }
    }
});
// Keep the existing tab priority, with Programs covering titles that match no tab.
function getVideoCategory(title, categoryTitle = title) {
    const match = text => videoCategories.find(word => String(text).toLowerCase().includes(word.toLowerCase()));
    return match(categoryTitle) || match(title) || 'Program';
}

function syncVideoCategoryTab(videoBox) {
    const category = videoBox.getAttribute('videoCategoryTab');
    const target = document.getElementById(`${category}-Tab-content`);
    if (!target) return; // Metadata may still be loading; do not guess its visibility.
    const id = videoBox.getAttribute('data-video-id');
    const copies = syncVideoCategoryTab.copies ||= new Map();
    const previous = copies.get(id);
    if (previous && Array.from(previous.parentNode?.children || []).includes(previous)) previous.remove();
    const clone = videoBox.cloneNode(true);
    // Category copies start as previews, never as duplicate active players.
    clone.querySelectorAll('.lc-inline-audio').forEach(panel => panel.remove());
    clone.querySelectorAll('.lc-media-viewport').forEach(viewport => viewport.classList.remove('lc-media-viewport', 'lc-audio-mode'));
    clone.querySelectorAll('lite-youtube').forEach(lite => {
        lite.hidden = false; lite.classList.remove('lyt-activated');
        lite.querySelectorAll('iframe').forEach(frame => frame.remove());
    });
    clone.querySelectorAll('.lc-video-actions').forEach(holder => { delete holder.dataset.audioSignature; holder.replaceChildren(); });
    const order = Number(videoBox.getAttribute('data-video-order'));
    const children = target.children;
    const next = children.length && Number(children[children.length - 1].getAttribute('data-video-order')) > order ? Array.from(children).find(child => Number(child.getAttribute('data-video-order')) > order) : null;
    target.insertBefore(clone, next || null);
    copies.set(id, clone);
}
// Select the container element where the divs will be appended
const videoTabContainer = document.getElementById('videotab-container');

// Create and append div elements with ids from the videoCategories array
videoCategories.forEach(category => {
    const div = document.createElement('div');
    div.id = category + '-Tab-content';
    div.classList.add('videotab-content');
    videoTabContainer.appendChild(div);
});
function renderAudienceVideos() {
    if (globalThis.LightCityMembers?.loading) return;
    const library = globalThis.LightCityMembers?.library;
    const tabs = document.getElementById('video-category-tabs');
    if (tabs) {
        const hideTabs = tabs.dataset.publicOnly === 'true' && !Array.isArray(library);
        if (tabs.hidden !== hideTabs) {
            tabs.hidden = hideTabs;
            window.dispatchEvent(new Event('resize'));
        }
    }
    const ids = Array.isArray(library) ? library.map(video => video.id) : publicVideoIds;
    const signature = ids.join(',');
    if (signature === renderedAudience) return;
    renderedAudience = signature;
    videoIds.splice(0, videoIds.length, ...ids);
    Object.keys(savedVideoCategories).forEach(id => delete savedVideoCategories[id]);
    Object.keys(savedVideoTitles).forEach(id => delete savedVideoTitles[id]);
    Object.assign(savedVideoTitles, Array.isArray(library) ? Object.fromEntries(library.map(video => [video.id, video.title])) : publicVideoTitles);
    Object.assign(savedVideoCategories, Array.isArray(library) ? Object.fromEntries(library.map(video => [video.id, video.category])) : publicVideoCategories);
    videoCategories.forEach(category => { document.getElementById(category + '-Tab-content').innerHTML = ''; });
    document.querySelectorAll('.videos-header-btns').forEach(button => button.classList.toggle('active', button.id === 'All-Tab'));
    document.querySelectorAll('.videotab-content').forEach(tab => tab.classList.toggle('videotab-content--active', tab.id === 'All-Tab-content'));
    createVideoCards(videoIds);
}
window.addEventListener('lightcity-members-changed', renderAudienceVideos);
 // Function to strip HTML tags from a string
 function stripHtmlTags(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
}
const videoWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const metadataRequests = new Map(), metadataJobs = [];
let metadataActive = 0;
function pumpVideoMetadata() {
    while (metadataActive < 4 && metadataJobs.length) {
        const job = metadataJobs.shift(); metadataActive++;
        fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + job.id) + '&format=json', { signal: AbortSignal.timeout(10000) })
            .then(response => { if (!response.ok) throw Error('Title unavailable'); return response.json(); })
            .then(data => { if (typeof data.title !== 'string' || !data.title.trim()) throw Error('Title unavailable'); return data; })
            .then(job.resolve, job.reject).finally(() => { metadataActive--; pumpVideoMetadata(); });
    }
}
function queueVideoMetadata(player) {
    const card = player.closest('#All-Tab-content .video-box');
    const heading = document.createElement('h3'); heading.className = 'video-title'; heading.textContent = 'LightCity recording'; card.appendChild(heading);
    let pending = metadataRequests.get(player.videoId);
    if (!pending) {
        pending = new Promise((resolve, reject) => metadataJobs.push({ id: player.videoId, resolve, reject }));
        metadataRequests.set(player.videoId, pending); pumpVideoMetadata();
    }
    pending.then(data => { if (player.isConnected !== false) applyVideoMetadata.call(player, data); }).catch(() => {});
}

function applyVideoMetadata(data) {

                        let videoTitleElement;
                        let videoTitleNoDate;
                        let videoTitleJustCategory;
                        let videoTitleOnly;
                        let videoDateElement;
                        // Get all video-box elements
                        const videoBoxElement = this.closest(`#All-Tab-content .video-box`);
                        if (!videoBoxElement) { return }
            
                        videoBoxElement.querySelector?.('.video-title')?.remove();
                        // Set up channel Logo
                        const channelLogoCon = document.createElement('div');
                        channelLogoCon.classList.add('channelLogo-container');
                        const channelLogo = document.createElement('div');
                        channelLogo.classList.add('lty-channelLogo');
                        channelLogoCon.prepend(channelLogo);
                        this.append(channelLogoCon);
            
                        // Set up video title
                        videoTitleElement = document.createElement('h3');
                        videoTitleElement.classList.add('video-title');
                        videoTitleElement.append(data.title);
                        videoBoxElement.append(videoTitleElement);
                        videoBoxElement.setAttribute('video-title', data.title);
            
                        // Extract date from video title
                        if (videoTitleElement) {
                            const videoTitleText = videoTitleElement.textContent;
                            const firstDateFormatMatch = videoTitleText.match(/(\d{1,2}(?:st|nd|rd|th)?)\s?(\w{3})\,\s?(\d{4})\.?/);
                            const secondDateFormatMatch = videoTitleText.match(/(\d{1,2}(?:st|nd|rd|th)?)\s?(\w{3})\.\s?(\d{4})\.?/);
                            const thirdDateFormatMatch = videoTitleText.match(/(?:\w{3},\s)?(\w{3})\s(\d{1,2}),\s(\d{4})\.?/);
            
                            let dateString, dateObject;
                            if (firstDateFormatMatch) {
                                const [dayMatch, monthMatch, yearMatch] = firstDateFormatMatch.slice(1);
                                dateString = `${monthMatch} ${dayMatch.replace(/\D/g, '')}, ${yearMatch}`;
                            } else if (secondDateFormatMatch) {
                                const [dayMatch, monthMatch, yearMatch] = secondDateFormatMatch.slice(1);
                                dateString = `${monthMatch} ${dayMatch.replace(/\D/g, '')}, ${yearMatch}`;
                            } else if (thirdDateFormatMatch) {
                                const [, monthMatch, dayMatch, yearMatch] = thirdDateFormatMatch;
                                dateString = `${monthMatch} ${dayMatch}, ${yearMatch}`;
                            }
                            if (dateString) {
                                dateObject = new Date(dateString);
                                if (!isNaN(dateObject)) {
                                    const dayOfWeek = videoWeekday.format(dateObject);
                                    videoDateElement = document.createElement('span');
                                    videoDateElement.classList.add('video-date');
                                    videoDateElement.textContent = dayOfWeek + ', ' + dateString + '.';
            
                                    videoTitleNoDate = document.createTextNode(videoTitleText.replace(firstDateFormatMatch ? firstDateFormatMatch[0] : secondDateFormatMatch ? secondDateFormatMatch[0] : thirdDateFormatMatch[0], ''));
                                    const videoTitleNoDateText = videoTitleNoDate.textContent;
                                    const lastDashIndex = videoTitleNoDateText.lastIndexOf('-');
                                    let beforeDash = '';
                                    let afterDash = videoTitleNoDateText;
                                    if (lastDashIndex !== -1) {
                                        beforeDash = videoTitleNoDateText.substring(0, lastDashIndex + 1).trim();
                                        afterDash = videoTitleNoDateText.substring(lastDashIndex + 1).trim();
                                    }
                                    videoTitleOnly = beforeDash + ' ';
                                    videoTitleJustCategory = document.createElement('span');
                                    videoTitleJustCategory.classList.add('video-category');
                                    videoTitleJustCategory.textContent = afterDash + ' ';
            
                                    videoTitleElement.innerHTML = '';
                                    videoTitleElement.appendChild(document.createTextNode(videoTitleOnly));
                                    videoTitleElement.appendChild(videoTitleJustCategory);
                                    videoTitleElement.appendChild(videoDateElement);
            
                                    videoBoxElement.setAttribute('video-title', videoTitleOnly);
                                    videoBoxElement.setAttribute('video-category', videoTitleJustCategory.textContent);
                                    videoBoxElement.setAttribute('date-posted', videoDateElement.textContent);
            
                                }
                            }
                        }

                        // Classification is independent of the optional date/title formatting.
                        videoBoxElement.setAttribute('videoCategoryTab', savedVideoCategories[this.videoId] || getVideoCategory(data.title, videoTitleJustCategory?.textContent || data.title));

                    this.hasFetchedVideoInfo = true; // Set the flag to true after processing
                    syncVideoCategoryTab(videoBoxElement);
}

function runFirstPartOfCode() {
    class LiteYTEmbed extends HTMLElement {
        constructor() {
            super();
            this.hasFetchedVideoInfo = false;
        }
        connectedCallback() {
            if (this.initialized) { LiteYTEmbed.observeThumbnail(this); return; }
            this.initialized = true;
            this.videoId = this.getAttribute('videoid');

            let playBtnEl = this.querySelector('.lty-playbtn');
            // A label for the button takes priority over a [playlabel] attribute on the custom-element
            this.playLabel = (playBtnEl && playBtnEl.textContent.trim()) || this.getAttribute('playlabel') || 'Play';

            LiteYTEmbed.observeThumbnail(this);

            if (!this.hasFetchedVideoInfo && this.closest('#All-Tab-content .video-box')) {
                const title = savedVideoTitles[this.videoId];
                if (title) applyVideoMetadata.call(this, { title });
                else queueVideoMetadata(this);
            }

            // Set up play button, and its visually hidden label
            if (!playBtnEl) {
                playBtnEl = document.createElement('button');
                playBtnEl.type = 'button';
                playBtnEl.classList.add('lty-playbtn');
                this.append(playBtnEl);
            }
            if (!playBtnEl.textContent) {
                const playBtnLabelEl = document.createElement('span');
                playBtnLabelEl.className = 'lyt-visually-hidden';
                playBtnLabelEl.textContent = this.playLabel;
                playBtnEl.append(playBtnLabelEl);
            }
            playBtnEl.removeAttribute('href');

            // On hover (or tap), warm up the TCP connections we're (likely) about to use.
            this.addEventListener('pointerover', LiteYTEmbed.warmConnections, {once: true});
            this.addEventListener('pointerdown', LiteYTEmbed.warmConnections, {once: true});
            this.addEventListener('focusin', LiteYTEmbed.warmConnections, {once: true});

            // Once the user clicks, add the real iframe and drop our play button
            // TODO: In the future we could be like amp-youtube and silently swap in the iframe during idle time
            //   We'd want to only do this for in-viewport or near-viewport ones: https://github.com/ampproject/amphtml/pull/5003
            this.addEventListener('click', this.addIframe);

            // Chrome & Edge desktop have no problem with the basic YouTube Embed with ?autoplay=1
            // However Safari desktop and most/all mobile browsers do not successfully track the user gesture of clicking through the creation/loading of the iframe,
            // so they don't autoplay automatically. Instead we must load an additional 2 sequential JS files (1KB + 165KB) (un-br) for the YT Player API
            // TODO: Try loading the the YT API in parallel with our iframe and then attaching/playing it. #82

        }

        /**
         * Add a <link rel={preload | preconnect} ...> to the head
         */
        static observeThumbnail(player) {
            if (player.style.backgroundImage) return;
            const load = item => { item.style.backgroundImage = 'url("https://i.ytimg.com/vi/' + item.videoId + '/hqdefault.jpg")'; };
            if (typeof IntersectionObserver === 'undefined') { load(player); return; }
            if (!LiteYTEmbed.thumbnails) LiteYTEmbed.thumbnails = new IntersectionObserver(entries => {
                for (const entry of entries) if (entry.isIntersecting) { load(entry.target); LiteYTEmbed.thumbnails.unobserve(entry.target); }
            }, { rootMargin: '600px' });
            LiteYTEmbed.thumbnails.observe(player);
        }
        disconnectedCallback() { LiteYTEmbed.thumbnails?.unobserve(this); }

        static addPrefetch(kind, url, as) {
            const linkEl = document.createElement('link');
            linkEl.rel = kind;
            linkEl.href = url;
            if (as) {
                linkEl.as = as;
            }
            document.head.append(linkEl);
        }

        /**
         * Begin pre-connecting to warm up the iframe load
         * Since the embed's network requests load within its iframe,
         *   preload/prefetch'ing them outside the iframe will only cause double-downloads.
         * So, the best we can do is warm up a few connections to origins that are in the critical path.
         *
         * Maybe `<link rel=preload as=document>` would work, but it's unsupported: http://crbug.com/593267
         * But TBH, I don't think it'll happen soon with Site Isolation and split caches adding serious complexity.
         */
        static warmConnections() {
            if (LiteYTEmbed.preconnected) return;

            // The iframe document and most of its subresources come right off youtube.com
            LiteYTEmbed.addPrefetch('preconnect', 'https://www.youtube-nocookie.com');
            // The botguard script is fetched off from google.com
            LiteYTEmbed.addPrefetch('preconnect', 'https://www.google.com');

            // Not certain if these ad related domains are in the critical path. Could verify with domain-specific throttling.
            LiteYTEmbed.addPrefetch('preconnect', 'https://googleads.g.doubleclick.net');
            LiteYTEmbed.addPrefetch('preconnect', 'https://static.doubleclick.net');

            LiteYTEmbed.preconnected = true;
        }

        async addIframe(request = {}){
            if (this.classList.contains('lyt-activated')) return;
            this.classList.add('lyt-activated');

            const params = new URLSearchParams(this.getAttribute('params') || []);
            const autoplay = request.autoplay !== false;
            params.set('autoplay', autoplay ? '1' : '0');
            params.append('playsinline', '1');

            params.set('enablejsapi', '1');
            params.set('origin', location.origin);

            const iframeEl = document.createElement('iframe');
            iframeEl.referrerPolicy = 'strict-origin-when-cross-origin';
            LiteYTEmbed.warmConnections();
            iframeEl.width = 560;
            iframeEl.height = 315;
            // No encoding necessary as [title] is safe. https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html#:~:text=Safe%20HTML%20Attributes%20include
            iframeEl.title = this.playLabel;
            iframeEl.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
            iframeEl.allowFullscreen = true;
            // AFAIK, the encoding here isn't necessary for XSS, but we'll do it only because this is a URL
            // https://stackoverflow.com/q/64959723/89484
            iframeEl.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(this.videoId)}?${params.toString()}`;
            this.append(iframeEl);
            globalThis.LightCityMedia?.trackYouTube(iframeEl, { autoplay }).catch(() => {});

            // Set focus for a11y
            if (autoplay) iframeEl.focus({ preventScroll: true });
        }
    }
    // Register custom element
    customElements.define('lite-youtube', LiteYTEmbed);
}
// Run the first part of the code
setTimeout(runFirstPartOfCode, 1);

function videoCloneToOtherTabs() {
    // Get all video boxes
    const categoryTabs = document.querySelectorAll('.videotab-content');
    const categoryButtons = document.querySelectorAll('.videos-header-btns-cont button');
    
    // Loop through each video box to clone it into the appropriate category tab
    // Category previews are created once when their metadata is applied.
    // Array to store the latest video box from each tab by date and arrange their corresponding tab button accordingly 
    const videoBoxArray = [];
    Array.from(categoryTabs).slice(1).forEach((tab) => {
        const linkId = tab.id;
        const videoBox = document.querySelector(`#${linkId} .video-box`);        
        if (videoBox) {
            const dateAttribute = videoBox.getAttribute('date-posted') || '';
            const currentDate = new Date(dateAttribute.replace(/(\d{1,2})(st|nd|rd|th)?/, '$1'));

            videoBoxArray.push({ date: currentDate, videoBox, tab });
        }
    });
    // Sort the array by date in descending order
    const sortedVideoBoxes = videoBoxArray.sort((a, b) => b.date - a.date);
    const latestVideoBox = sortedVideoBoxes[0]?.videoBox;
    const previousVideoBoxes = sortedVideoBoxes.slice(1);

    let moved = false; // Flag to track whether the buttons have been moved
    const btnArray = Array.from(categoryButtons);
    // Iterate over buttons
    for (let elem of btnArray.slice(1)) {
        let btnId = elem.id;
        let theButtonMatch;
        // Check and move buttons based on the corresponding video box's parent ID
        const moveButton = (videoBox, position) => {
            const parentId = videoBox.parentNode.id;
            if (parentId.includes(btnId)) {
                theButtonMatch = btnArray.find((btn) => btn.id === elem.id);
                const indexToMove = btnArray.indexOf(theButtonMatch);
                if (indexToMove !== -1) {
                    const movedElement = btnArray.splice(indexToMove, 1)[0];
                    btnArray.splice(position, 0, movedElement);
                    moved = true; // Set the flag to true
                }
            }
        };
        // Move latest video box button
        if (latestVideoBox) moveButton(latestVideoBox, 1);
        // Move previous video boxes buttons
        previousVideoBoxes.forEach((item, index) => {
            if (item?.videoBox) moveButton(item.videoBox, index + 2);
        });
    }
    // Remove existing buttons from the DOM and insert buttons in the updated order
    if (moved) {
        const parentElement = document.querySelector('.videos-header-btns-cont');
        
        // Remove existing buttons from the DOM
        document.querySelectorAll('.videos-header-btns').forEach((button) => {
            button.remove();
        });        
        // Insert buttons in the updated order
        btnArray.forEach((button) => {
            parentElement.appendChild(button);
        });
    }
}

