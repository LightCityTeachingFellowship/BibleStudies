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
const categories = document.getElementsByClassName('postCategories')[0];
const categoriesChildrenToRev = categories ? Array.from(categories?.getElementsByClassName('homeResources-grid-containter')) : [];
categoriesChildrenToRev?.reverse();
for (const homeResourcesGridContainter of categoriesChildrenToRev) {
  categories.appendChild(homeResourcesGridContainter);

}


