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
                        var videoTitleNoDate;
                        var videoTitleJustCategory;
                        var videoTitleOnly;
                        var videoDateElement;             
                        // Get all video-box elements
                        const videoBoxElement = this.closest(`#All-Tab-content .video-box`);
                        if (!videoBoxElement) {return}
                            // Set up channel Logo
                            var channelLogoCon = document.createElement('div');
                            channelLogoCon.classList.add('channelLogo-container');
                            var channelLogo = document.createElement('div');
                            channelLogo.classList.add('lty-channelLogo');
                            channelLogoCon.prepend(channelLogo);
                            this.append(channelLogoCon);

                            // Set up video title
                            videoTitleElement = document.createElement('h3');
                            videoTitleElement.classList.add('video-title');
                            videoTitleElement.append(data.title);
                            videoBoxElement.append(videoTitleElement);
            
                            // Get the video title element within the current video-box
                            if (videoTitleElement) {
                                // Get the text content of the video-title (h3) element
                                const videoTitleText = videoTitleElement.textContent;        
                                // Extract the date from the video title
                                const firstDateFormatMatch = videoTitleText.match(/(\d{1,2}(?:st|nd|rd|th)?)\s?(\w{3})\,\s?(\d{4})\.?/);
                                const SecondDateFormatMatch = videoTitleText.match(/(\d{1,2}(?:st|nd|rd|th)?)\s?(\w{3})\.\s?(\d{4})\.?/);
                                const thirdDateFormatMatch = videoTitleText.match(/(?:\w{3},\s)?(\w{3})\s(\d{1,2}),\s(\d{4})\.?/);
        
                                let dateString, dateObject;        
                                if (firstDateFormatMatch && firstDateFormatMatch.length > 0) {
                                    const [dayMatch, monthMatch, yearMatch] = firstDateFormatMatch.slice(1);
                                    dateString = `${monthMatch} ${dayMatch.replace(/\D/g, '')}, ${yearMatch}`;
                                } else if (SecondDateFormatMatch && SecondDateFormatMatch.length > 0) {
                                    const [dayMatch, monthMatch, yearMatch] = SecondDateFormatMatch.slice(1);
                                    dateString = `${monthMatch} ${dayMatch.replace(/\D/g, '')}, ${yearMatch}`;
                                } else if (thirdDateFormatMatch && thirdDateFormatMatch.length > 0) {
                                    const [, monthMatch, dayMatch, yearMatch] = thirdDateFormatMatch;
                                    dateString = `${monthMatch} ${dayMatch}, ${yearMatch}`;
                                }        
                                if (dateString) {
                                    dateObject = new Date(dateString);        
                                    if (!isNaN(dateObject)) {
                                        const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(dateObject);        
                                        // Create a span element
                                        videoDateElement = document.createElement('span');
                                        videoDateElement.classList.add('video-date');
                                        videoDateElement.textContent = dayOfWeek + ', ' + dateString + '.';
                                        // Create a new text node with the modified text (excluding the date)
                                        videoTitleNoDate = document.createTextNode(videoTitleText.replace(firstDateFormatMatch ? firstDateFormatMatch[0] : SecondDateFormatMatch ? SecondDateFormatMatch[0] : thirdDateFormatMatch[0], ''));
                                        // Extract the words from videoTitleNoDate until the last '-'
                                        const videoTitleNoDateText = videoTitleNoDate.textContent;
                                        const lastDashIndex = videoTitleNoDateText.lastIndexOf('-');
                                        // If a dash is found, split the text accordingly
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
                                        // Append the modified text and the span element to the video title
                                        videoTitleElement.appendChild(document.createTextNode(videoTitleOnly));
                                        videoTitleElement.appendChild(videoTitleJustCategory);
                                        videoTitleElement.appendChild(videoDateElement);
                                        // Add the modified video title content (without HTML tags) as a new attribute
                                        videoBoxElement.setAttribute('video-title', videoTitleOnly);
                                        // Add the modified video category content (without HTML tags) as a new attribute
                                        videoBoxElement.setAttribute('video-category', stripHtmlTags(videoTitleJustCategory.innerHTML));
                                        // Add the date as an attribute to the current video-box (without HTML tags)
                                        videoBoxElement.setAttribute('date-posted', stripHtmlTags(videoDateElement.innerHTML));
                                        // Check if any of the target words are present in the video title text
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
    // Loop through each video box
    videoBoxes.forEach(function(videoBox) {
        // Get the videoCategoryTab attribute value
        const videoCategoryTabAtt = videoBox.getAttribute('videoCategoryTab');
        // Construct the ID of the target div based on the videoCategoryTab value
        const targetCategoryDivId = videoCategoryTabAtt + '-Tab-content';
        // Get the target div by ID
        const targetCategoryDiv = document.getElementById(targetCategoryDivId);
        // If the target div exists, clone the video box and append it to the target div
        if (targetCategoryDiv) {
            const clonedVideoBox = videoBox.cloneNode(true);
            targetCategoryDiv.appendChild(clonedVideoBox);
        }
    });
    // Create an array to store all video boxes from all tabs
    const allVideoBoxes = [];
    let latestVideoBox;
    let latestDate = new Date(0); // Initialize with a very early date
    let tabOfLatestVideoBox;
    let previousVideoBoxOne;
    let previousDateOne;
    let tabOfpreviousVideoBoxOne;
    let previousVideoBoxTwo;
    let previousDateTwo;
    let tabOfpreviousVideoBoxTwo;
    let previousVideoBoxThree;
    let previousDateThree;
    let tabOfpreviousVideoBoxThree;    
    let previousVideoBoxFour;
    let previousDateFour;
    let tabOfpreviousVideoBoxFour;    
    // Assuming allTabs is a NodeList or an array of tabs
    Array.from(allTabs).slice(1).forEach((tab) => {
        const linkId = tab.id;
        // Retrieve all video boxes for the current tab
        const allVideoBox = document.querySelectorAll(`#${linkId} .video-box`);
        // Push video boxes into the array
        allVideoBoxes.push(...allVideoBox);
        // Iterate over video boxes for the current tab
        allVideoBoxes.forEach((videoBox) => {
        const dateAttribute = videoBox.getAttribute('date-posted');
        const currentDate = new Date(dateAttribute.replace(/(\d{1,2})(st|nd|rd|th)?/, '$1'));
        // Check if the current video box has a later date than the latest one
        if (currentDate > latestDate) {
            // Update the latest video box information
            previousVideoBoxFour = previousVideoBoxThree;
            previousDateFour = previousDateThree;
            tabOfpreviousVideoBoxFour = tabOfpreviousVideoBoxThree;

            previousVideoBoxThree = previousVideoBoxTwo;
            previousDateThree = previousDateTwo;
            tabOfpreviousVideoBoxThree = tabOfpreviousVideoBoxTwo;

            previousVideoBoxTwo = previousVideoBoxOne;
            previousDateTwo = previousDateOne;
            tabOfpreviousVideoBoxTwo = tabOfpreviousVideoBoxOne;
    
            previousVideoBoxOne = latestVideoBox;
            previousDateOne = latestDate;
            tabOfpreviousVideoBoxOne = tabOfLatestVideoBox;
    
            latestDate = currentDate;
            latestVideoBox = videoBox;
            tabOfLatestVideoBox = tab;
        } else if (currentDate > previousDateOne && currentDate < latestDate) {
            // Update the previous video box information
            previousVideoBoxFour = previousVideoBoxThree;
            previousDateFour = previousDateThree;
            tabOfpreviousVideoBoxFour = tabOfpreviousVideoBoxThree;

            previousVideoBoxThree = previousVideoBoxTwo;
            previousDateThree = previousDateTwo;
            tabOfpreviousVideoBoxThree = tabOfpreviousVideoBoxTwo;

            previousVideoBoxTwo = previousVideoBoxOne;
            previousDateTwo = previousDateOne;
            tabOfpreviousVideoBoxTwo = tabOfpreviousVideoBoxOne;
    
            previousDateOne = currentDate;
            previousVideoBoxOne = videoBox;
            tabOfpreviousVideoBoxOne = tab;
        } else if (currentDate > previousDateTwo && currentDate < previousDateOne && currentDate < latestDate) {
            // Update the previous video box information
            previousVideoBoxFour = previousVideoBoxThree;
            previousDateFour = previousDateThree;
            tabOfpreviousVideoBoxFour = tabOfpreviousVideoBoxThree;

            previousVideoBoxThree = previousVideoBoxTwo;
            previousDateThree = previousDateTwo;
            tabOfpreviousVideoBoxThree = tabOfpreviousVideoBoxTwo;
            
            previousDateTwo = currentDate;
            previousVideoBoxTwo = videoBox;
            tabOfpreviousVideoBoxTwo = tab;
        } else if (currentDate > previousDateThree && currentDate < previousDateTwo && currentDate < previousDateOne && currentDate < latestDate) {
            // Update the previous video box information
            previousVideoBoxFour = previousVideoBoxThree;
            previousDateFour = previousDateThree;
            tabOfpreviousVideoBoxFour = tabOfpreviousVideoBoxThree;
            
            previousDateThree = currentDate;
            previousVideoBoxThree = videoBox;
            tabOfpreviousVideoBoxThree = tab;
        } else if (currentDate > previousDateFour && currentDate < previousDateThree && currentDate < previousDateTwo && currentDate < previousDateOne && currentDate < latestDate) {
            // Update the previous video box information
            previousDateFour = currentDate;
            previousVideoBoxFour = videoBox;
            tabOfpreviousVideoBoxFour = tab;
        }
        });
    });
    // console.log(latestVideoBox);
    // console.log(tabOfLatestVideoBox);
    // console.log(previousVideoBoxOne);
    // console.log(tabOfpreviousVideoBoxOne);
    // console.log(previousVideoBoxTwo);
    // console.log(tabOfpreviousVideoBoxTwo);
    // console.log(previousVideoBoxThree);    
    // console.log(tabOfpreviousVideoBoxThree);
    // console.log(previousVideoBoxFour);    
    // console.log(tabOfpreviousVideoBoxFour);

    let moved = false; // Flag to track whether the buttons have been moved
    const btnArray = Array.from(allBtns);
    // Iterate over buttons
    for (let elem of btnArray.slice(1)) {
        let btnId = elem.id;
        let theButtonMatch;
        // Check for tabOfPreviousVideoBoxFour condition
        if (tabOfpreviousVideoBoxFour) {
        const parentOfPreviousVideoBoxFour = previousVideoBoxFour.parentNode;
        const parentOfPreviousVideoBoxFourId = parentOfPreviousVideoBoxFour.id;
        if (parentOfPreviousVideoBoxFourId.includes(btnId)) {
            // console.log(btnId);
            theButtonMatch = elem;
            // console.log(theButtonMatch);
            theButtonMatch = btnArray.find((elem) => elem.id === theButtonMatch.id);
            const indexToMove = btnArray.indexOf(theButtonMatch);
            if (indexToMove !== -1) {
            // console.log(indexToMove);
            const movedElement = btnArray.splice(indexToMove, 1)[0];
            // console.log(movedElement);
            btnArray.splice(5, 0, movedElement);
            moved = true; // Set the flag to true
            }
        }
        }
        // Check for tabOfPreviousVideoBoxThree condition
        if (tabOfpreviousVideoBoxThree) {
        const parentOfPreviousVideoBoxThree = previousVideoBoxThree.parentNode;
        const parentOfPreviousVideoBoxThreeId = parentOfPreviousVideoBoxThree.id;
        if (parentOfPreviousVideoBoxThreeId.includes(btnId)) {
            // console.log(btnId);
            theButtonMatch = elem;
            // console.log(theButtonMatch);
            theButtonMatch = btnArray.find((elem) => elem.id === theButtonMatch.id);
            const indexToMove = btnArray.indexOf(theButtonMatch);
            if (indexToMove !== -1) {
            // console.log(indexToMove);
            const movedElement = btnArray.splice(indexToMove, 1)[0];
            // console.log(movedElement);
            btnArray.splice(4, 0, movedElement);
            moved = true; // Set the flag to true
            }
        }
        }
        // Check for tabOfPreviousVideoBoxTwo condition
        if (tabOfpreviousVideoBoxTwo) {
        const parentOfPreviousVideoBoxTwo = previousVideoBoxTwo.parentNode;
        const parentOfPreviousVideoBoxTwoId = parentOfPreviousVideoBoxTwo.id;
        if (parentOfPreviousVideoBoxTwoId.includes(btnId)) {
            theButtonMatch = elem;
            // console.log(theButtonMatch);
            theButtonMatch = btnArray.find((elem) => elem.id === theButtonMatch.id);
            const indexToMove = btnArray.indexOf(theButtonMatch);
            if (indexToMove !== -1) {
            const movedElement = btnArray.splice(indexToMove, 1)[0];
            btnArray.splice(3, 0, movedElement);
            moved = true; // Set the flag to true
            }
        }
        }
        // Check for tabOfPreviousVideoBoxOne condition
        if (tabOfpreviousVideoBoxOne) {
        const parentOfPreviousVideoBoxOne = previousVideoBoxOne.parentNode;
        const parentOfPreviousVideoBoxOneId = parentOfPreviousVideoBoxOne.id;
        if (parentOfPreviousVideoBoxOneId.includes(btnId)) {
            theButtonMatch = elem;
            theButtonMatch = btnArray.find((elem) => elem.id === theButtonMatch.id);
            const indexToMove = btnArray.indexOf(theButtonMatch);
            if (indexToMove !== -1) {
            const movedElement = btnArray.splice(indexToMove, 1)[0];
            btnArray.splice(2, 0, movedElement);
            moved = true; // Set the flag to true
            }
        }
        }
        // Check for tabOfLatestVideoBox condition
        if (tabOfLatestVideoBox) {
        const parentOfLatestVideoBox = latestVideoBox.parentNode;
        const parentOfLatestVideoBoxId = parentOfLatestVideoBox.id;
        if (parentOfLatestVideoBoxId.includes(btnId)) {
            theButtonMatch = elem;
            theButtonMatch = btnArray.find((elem) => elem.id === theButtonMatch.id);
            const indexToMove = btnArray.indexOf(theButtonMatch);
            if (indexToMove !== -1) {
            const movedElement = btnArray.splice(indexToMove, 1)[0];
            btnArray.splice(1, 0, movedElement);
            moved = true; // Set the flag to true
            }
        }
        }
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
setTimeout(videoCloneToOtherTabs, 3000);