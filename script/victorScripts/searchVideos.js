const videoSearchInput = document.getElementById("videoSearch");
const searchResultsContainer = document.getElementById("searchResults");
const searchResultsContainerInner = document.getElementById("searchResultsInner");
const searchFromAllTabContent = document.querySelector('#All-Tab-content');
const displayedVideos = new Set();
let observer;
// Event listener for highlighting
videoSearchInput.addEventListener("input", () => {
    const searchQuery = videoSearchInput.value.toLowerCase();
    handleHighLight(searchQuery);
  });
// Event listener for handling video search
videoSearchInput.addEventListener("input", () => {
    handleVideoSearch();
});
function getAttributes(video) {
    let videoTitleAttribute = video.getAttribute("video-title");
    let videoTitleCategoryAttribute = video.getAttribute("video-category");
    let videoDateAttribute = video.getAttribute("date-posted");
    return { videoTitleAttribute, videoTitleCategoryAttribute, videoDateAttribute };
}
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
    const videoBoxes = searchResultsContainerInner.querySelectorAll(".video-box");
    videoBoxes.forEach((video) => {
        const videoTitleElement = video.querySelector(".video-title");
        const { videoTitleAttribute, videoTitleCategoryAttribute, videoDateAttribute } = getAttributes(video);
        if (videoTitleAttribute) {
            const highlightedTitle = highlightText(videoTitleAttribute, searchQuery);
            const tempElement = document.createElement('div');
            tempElement.innerHTML = highlightedTitle;
            if (videoTitleCategoryAttribute) {
                const highlightedCategory = highlightText(videoTitleCategoryAttribute, searchQuery);
                const highlightedCategoryElement = document.createElement('span');
                highlightedCategoryElement.classList.add('video-category');
                highlightedCategoryElement.innerHTML = highlightedCategory;
                tempElement.innerHTML += highlightedCategoryElement.outerHTML;
            }
            if (videoDateAttribute) {
                const highlightedDate = highlightText(videoDateAttribute, searchQuery);
                const highlightedDateElement = document.createElement('span');
                highlightedDateElement.classList.add('video-date');
                highlightedDateElement.innerHTML = highlightedDate;

                tempElement.innerHTML += highlightedDateElement.outerHTML;
            }
            videoTitleElement.innerHTML = tempElement.innerHTML;
        }
    });
    // Create the observer if it doesn't exist
    if (!observer) {
        observer = new MutationObserver(() => {
            handleHighLight(videoSearchInput.value.toLowerCase());
        });
    }
    // Reconnect the observer to detect further changes
    observer.observe(searchResultsContainerInner, { childList: true, subtree: true, attributes: true });
}

// Function to handle video search
function handleVideoSearch() {
    const searchQuery = videoSearchInput.value.toLowerCase();
    searchResultsContainerInner.innerHTML = "";
    displayedVideos.clear();
    const existingCountElement = searchResultsContainer.querySelector('.displayedVideoCountElement');
    if (existingCountElement) {
        existingCountElement.remove();
    }
    const videoBoxes = searchFromAllTabContent.querySelectorAll(".video-box");
    videoBoxes.forEach((video) => {
        const { videoTitleAttribute, videoTitleCategoryAttribute, videoDateAttribute } = getAttributes(video);
        const videoIdElement = video.querySelector("lite-youtube");
        const videoId = videoIdElement.getAttribute("videoid");
        if (videoTitleAttribute || videoTitleCategoryAttribute || videoDateAttribute) {
            const originalVideoTitle = videoTitleAttribute;
            const videoTitle = originalVideoTitle.toLowerCase();
            const videoCategory = videoTitleCategoryAttribute.toLowerCase();
            const videoDate = videoDateAttribute.toLowerCase();
            if ((videoTitle.includes(searchQuery) || videoCategory.includes(searchQuery)) || videoDate.includes(searchQuery) && !displayedVideos.has(videoId)) {
                const videoClone = video.cloneNode(true);
                searchResultsContainerInner.appendChild(videoClone);
                displayedVideos.add(videoId);
            }
        }
    });
    const displayedVideoCount = searchResultsContainerInner.children.length;
    const displayedVideoCountElement = document.createElement('em');
    displayedVideoCountElement.classList.add('displayedVideoCountElement');
    if (displayedVideoCount === 0) {
        displayedVideoCountElement.innerHTML = 'Search Result: No match found...';
        searchResultsContainerInner.style.maxHeight = '0';
    } else if (displayedVideoCount === 1) {
        displayedVideoCountElement.innerHTML = 'Search Result: ' + displayedVideoCount  + ' video.';
    } else {
        displayedVideoCountElement.innerHTML = 'Search Result: ' + displayedVideoCount  + ' videos.';
        applyStyles();
        window.addEventListener('resize', applyStyles);
    }
    searchResultsContainer.prepend(displayedVideoCountElement);
    searchResultsContainer.style.paddingTop = displayedVideoCount === 0 ? '30px' : '30px';
    searchResultsContainerInner.style.marginTop = displayedVideoCount === 0 ? '0' : '6px';

    if (searchQuery === "") {
        searchResultsContainer.style.removeProperty('padding-top');
        searchResultsContainerInner.style.removeProperty('margin-top');
        searchResultsContainerInner.style.maxHeight = '0';
        searchResultsContainerInner.innerHTML = '';
        displayedVideoCountElement.remove();
        displayedVideos.clear();
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