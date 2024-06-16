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
// Select the container element where the divs will be appended
const videoTabContainer = document.getElementById('videotab-container');

// Create and append div elements with ids from the videoCategories array
videoCategories.forEach(category => {
    const div = document.createElement('div');
    div.id = category + '-Tab-content';
    div.classList.add('videotab-content');
    videoTabContainer.appendChild(div);
});
 // Function to strip HTML tags from a string
 function stripHtmlTags(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
} 
// Parse duration
function parseDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) {
        return "0:00"; // Return a default value if duration format is unexpected
    }
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    return `${hours > 0 ? hours + ':' : ''}${minutes > 0 ? (hours > 0 && minutes < 10 ? '0' + minutes : minutes) + ':' : '0:'}${seconds < 10 ? '0' + seconds : seconds}`;
}
function runFirstPartOfCode() {
    class LiteYTEmbed extends HTMLElement {
        constructor() {
            super();
            this.hasFetchedVideoInfo = false;
        }
        connectedCallback() {
            this.videoId = this.getAttribute('videoid');

            let playBtnEl = this.querySelector('.lty-playbtn');
            // A label for the button takes priority over a [playlabel] attribute on the custom-element
            this.playLabel = (playBtnEl && playBtnEl.textContent.trim()) || this.getAttribute('playlabel') || 'Play';

            if (!this.style.backgroundImage) {
            this.style.backgroundImage = `url("https://i.ytimg.com/vi/${this.videoId}/maxresdefault.jpg")`;
            }

            // Set up video title
            const videoURL = `https://www.youtube.com/watch?v=${this.videoId}`;
            const oEmbedURL = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoURL)}&format=json`;
            
            // Ensure hasFetchedVideoInfo is in the correct scope and check its value
            if (!this.hasFetchedVideoInfo) {
                fetch(oEmbedURL)
                    .then(response => {
                        if (response.status === 200) {
                            return response.json();
                        } else {
                            throw new Error("Failed to retrieve video information.");
                        }
                    })
                    .then(data => {
                        let videoTitleElement;
                        let videoTitleNoDate;
                        let videoTitleJustCategory;
                        let videoTitleOnly;
                        let videoDateElement;
                        // Get all video-box elements
                        const videoBoxElement = this.closest(`#All-Tab-content .video-box`);
                        if (!videoBoxElement) { return }
            
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
                                    const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(dateObject);
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
                                    videoBoxElement.setAttribute('video-category', stripHtmlTags(videoTitleJustCategory.innerHTML));
                                    videoBoxElement.setAttribute('date-posted', stripHtmlTags(videoDateElement.innerHTML));
            
                                    const matchedCategory = videoCategories.find(word => videoTitleJustCategory.textContent.includes(word));
                                    if (matchedCategory) {
                                        videoBoxElement.setAttribute('videoCategoryTab', matchedCategory);
                                    }
                                } else {
                                    console.error('Invalid date object:', dateObject);
                                }
                            } else {
                                console.error('No date match found');
                            }
                        }

                        // Fetch additional video details from YouTube Data API v3
                        const apiKey = 'AIzaSyBQjKp7Xt5hFJHYwPCjM1wBXg6KBBZrayo';
                        const videoDetailsURL = `https://www.googleapis.com/youtube/v3/videos?id=${this.videoId}&part=snippet,contentDetails,liveStreamingDetails&key=${apiKey}`;            
                        fetch(videoDetailsURL, {
                            headers: {
                                'Referer': 'https://*.lightcityteachingfellowship.github.io/BibleStudies/' // Replace with your GitHub Pages URL
                            }
                        })
                        .then(response => response.json())
                        .then(detailsData => {
                            const duration = detailsData.items[0].contentDetails.duration;
                            const liveBroadcastContent = detailsData.items[0].snippet.liveBroadcastContent;
                            
                            function parseDuration(duration) {
                                const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
                                const hours = parseInt(match[1]) || 0;
                                const minutes = parseInt(match[2]) || 0;
                                const seconds = parseInt(match[3]) || 0;
                                return `${hours > 0 ? hours + ':' : ''}${minutes > 0 ? (hours > 0 && minutes < 10 ? '0' + minutes : minutes) + ':' : '0:'}${seconds < 10 ? '0' + seconds : seconds}`;
                            }
                            
                            if (liveBroadcastContent !== 'live') {
                                const videoDurationElement = document.createElement('div');
                                videoDurationElement.classList.add('video-duration');
                                videoDurationElement.textContent = parseDuration(duration);
                                this.append(videoDurationElement);
                            }
                            // Check if the video is live
                            if (liveBroadcastContent === 'live') {
                                videoBoxElement.setAttribute('live-status', 'live');
                                const liveIndicator = document.createElement('div');
                                liveIndicator.classList.add('live-indicator');
                                liveIndicator.innerHTML = `
                                <span class="live-icon">
                                    <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="style-scope tp-yt-iron-icon" style="pointer-events: none; display: block; width: 100%; height: 100%;">
                                        <g width="24" height="24" viewBox="0 0 24 24" class="style-scope tp-yt-iron-icon">
                                            <path d="M14 11.9999C14 13.0999 13.1 13.9999 12 13.9999C10.9 13.9999 10 13.0999 10 11.9999C10 10.8999 10.9 9.99992 12 9.99992C13.1 9.99992 14 10.8999 14 11.9999ZM8.48 8.44992L7.77 7.74992C6.68 8.82992 6 10.3399 6 11.9999C6 13.6599 6.68 15.1699 7.77 16.2499L8.48 15.5399C7.57 14.6399 7 13.3899 7 11.9999C7 10.6099 7.57 9.35992 8.48 8.44992ZM16.23 7.74992L15.52 8.45992C16.43 9.35992 17 10.6099 17 11.9999C17 13.3899 16.43 14.6399 15.52 15.5499L16.23 16.2599C17.32 15.1699 18 13.6599 18 11.9999C18 10.3399 17.32 8.82992 16.23 7.74992ZM5.65 5.62992L4.95 4.91992C3.13 6.72992 2 9.23992 2 11.9999C2 14.7599 3.13 17.2699 4.95 19.0799L5.66 18.3699C4.02 16.7399 3 14.4899 3 11.9999C3 9.50992 4.02 7.25992 5.65 5.62992ZM19.05 4.91992L18.34 5.62992C19.98 7.25992 21 9.50992 21 11.9999C21 14.4899 19.98 16.7399 18.35 18.3699L19.06 19.0799C20.87 17.2699 22 14.7599 22 11.9999C22 9.23992 20.87 6.72992 19.05 4.91992Z" class="style-scope tp-yt-iron-icon"></path>
                                        </g>
                                    </svg>
                                </span>`;
                                const liveText = document.createElement('span');
                                liveText.classList.add('live-text');
                                liveText.textContent = 'LIVE';

                                liveIndicator.appendChild(liveText);
                                this.append(liveIndicator);
                            }
                        })
                        .catch(error => {
                            console.error('Failed to fetch video details:', error);
                        });            
                    this.hasFetchedVideoInfo = true; // Set the flag to true after processing
                    })
                    .catch(error => {
                        console.error(error);
                    });
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

            // Once the user clicks, add the real iframe and drop our play button
            // TODO: In the future we could be like amp-youtube and silently swap in the iframe during idle time
            //   We'd want to only do this for in-viewport or near-viewport ones: https://github.com/ampproject/amphtml/pull/5003
            this.addEventListener('click', this.addIframe);

            // Chrome & Edge desktop have no problem with the basic YouTube Embed with ?autoplay=1
            // However Safari desktop and most/all mobile browsers do not successfully track the user gesture of clicking through the creation/loading of the iframe,
            // so they don't autoplay automatically. Instead we must load an additional 2 sequential JS files (1KB + 165KB) (un-br) for the YT Player API
            // TODO: Try loading the the YT API in parallel with our iframe and then attaching/playing it. #82
            this.needsYTApiForAutoplay = navigator.vendor.includes('Apple') || navigator.userAgent.includes('Mobi');
        }

        /**
         * Add a <link rel={preload | preconnect} ...> to the head
         */
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

        fetchYTPlayerApi() {
            if (window.YT || (window.YT && window.YT.Player)) return;

            this.ytApiPromise = new Promise((res, rej) => {
                var el = document.createElement('script');
                el.src = 'https://www.youtube.com/iframe_api';
                el.async = true;
                el.onload = _ => {
                    YT.ready(res);
                };
                el.onerror = rej;
                this.append(el);
            });
        }

        async addYTPlayerIframe(params) {
            this.fetchYTPlayerApi();
            await this.ytApiPromise;

            const videoPlaceholderEl = document.createElement('div')
            this.append(videoPlaceholderEl);

            const paramsObj = Object.fromEntries(params.entries());

            new YT.Player(videoPlaceholderEl, {
                width: '100%',
                videoId: this.videoId,
                playerVars: paramsObj,
                events: {
                    'onReady': event => {
                        event.target.playVideo();
                    }
                }
            });
        }

        async addIframe(){
            if (this.classList.contains('lyt-activated')) return;
            this.classList.add('lyt-activated');

            const params = new URLSearchParams(this.getAttribute('params') || []);
            params.append('autoplay', '1');
            params.append('playsinline', '1');

            if (this.needsYTApiForAutoplay) {
                return this.addYTPlayerIframe(params);
            }

            const iframeEl = document.createElement('iframe');
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

            // Set focus for a11y
            iframeEl.focus();
        }
    }
    // Register custom element
    customElements.define('lite-youtube', LiteYTEmbed);
}
// Run the first part of the code
runFirstPartOfCode();

function videoCloneToOtherTabs() {
    // Get all video boxes
    const videoBoxes = document.querySelectorAll('.video-box');
    
    // Loop through each video box to clone it into the appropriate category tab
    videoBoxes.forEach(function(videoBox) {
        const videoCategoryTabAtt = videoBox.getAttribute('videoCategoryTab');
        const targetCategoryDivId = `${videoCategoryTabAtt}-Tab-content`;
        const targetCategoryDiv = document.getElementById(targetCategoryDivId);
        
        if (targetCategoryDiv) {
            const clonedVideoBox = videoBox.cloneNode(true);
            targetCategoryDiv.appendChild(clonedVideoBox);
        }
    });
    // Array to store the latest video box from each tab by date and arrange their corresponding tab button accordingly 
    const videoBoxArray = [];
    Array.from(allTabs).slice(1).forEach((tab) => {
        const linkId = tab.id;
        const videoBox = document.querySelector(`#${linkId} .video-box`);        
        if (videoBox) {
            const dateAttribute = videoBox.getAttribute('date-posted');
            const currentDate = new Date(dateAttribute.replace(/(\d{1,2})(st|nd|rd|th)?/, '$1'));

            videoBoxArray.push({ date: currentDate, videoBox, tab });
        }
    });
    // Sort the array by date in descending order
    const sortedVideoBoxes = videoBoxArray.sort((a, b) => b.date - a.date);
    const latestVideoBox = sortedVideoBoxes[0]?.videoBox;
    const previousVideoBoxes = sortedVideoBoxes.slice(1);

    let moved = false; // Flag to track whether the buttons have been moved
    const btnArray = Array.from(allBtns);
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
} setTimeout(videoCloneToOtherTabs, 3500);
