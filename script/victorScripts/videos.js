const firstBtn = document.querySelector(".videos-header-btns-cont button").classList.add('active');
const firstTab = document.querySelector(".videotab-content").classList.add('videotab-content--active');
const allBtns = document.querySelectorAll(".videos-header-btns-cont button");
// const lastBtn = allBtns[allBtns.length - 1];
// lastBtn.classList.add('active');
const allTabs = document.querySelectorAll(".videotab-content");
// const lastTab = allTabs[allTabs.length - 1];
// lastTab.classList.add('videotab-content--active');

  // Convert allTabs to an array using Array.from or the spread operator
  const tabsArrayAll = Array.from(allTabs);
  const tabsArrayFirst = tabsArrayAll.length > 0 ? [tabsArrayAll[0]] : [];
  const tabsArray = tabsArrayAll.slice(1);

  allBtns.forEach((elem) => {
      const linkId = elem.id;
      // Define a function to handle the setTimeout callback
      function updateButton() {
          // Find the corresponding tab for the button
          const correspondingTab = tabsArrayAll.find((tab) => tab.id === linkId + "-content");
          if (correspondingTab) {
              // Count the children of the corresponding tab
              const tabChildrenCount = correspondingTab.children.length;
              const tabChildrenCountElement = document.createElement('span');
              tabChildrenCountElement.classList.add('video-count');
              const countText = document.createTextNode(`(${tabChildrenCount})`);
              tabChildrenCountElement.appendChild(countText);
              const originalText = elem.innerText;
              elem.innerHTML = '';
              elem.appendChild(document.createTextNode(originalText));
            //   elem.appendChild(tabChildrenCountElement); 

            //   // Determine the text based on the screen size
            //   if (window.matchMedia("(max-width: 539px)").matches) {
            //         // For small screens, use the 'data-original-text' attribute
            //         const originalText = elem.getAttribute('data-original-text');
            //         elem.innerHTML = '';
            //         elem.appendChild(document.createTextNode(originalText));
            //         // elem.appendChild(tabChildrenCountElement);
            //     } else {
            //         // For larger screens, use 'elem.innerText'
            //         const originalText = elem.innerText;
            //         elem.innerHTML = '';
            //         elem.appendChild(document.createTextNode(originalText));
            //         // elem.appendChild(tabChildrenCountElement);                
            //     }
            }
      }
      setTimeout(updateButton, 3155);

      elem.addEventListener('click', function() {
          allBtns.forEach((button) => {
              if (button.id === linkId) {
                  button.classList.add("active");
              } else {
                  button.classList.remove('active');
              }
          });

          tabsArrayAll.forEach((tab) => {
              if (tab.id === linkId + "-content") {
                  tab.classList.add("videotab-content--active");
              } else {
                  tab.classList.remove('videotab-content--active');
              }
          });
      });
  });
  function adjustButtonPadding() {
    const container = document.querySelector('.videos-header-btns-cont');
    const buttons = document.querySelectorAll('.videos-header-btns');
    const containerWidth = container.clientWidth;
    const buttonCount = buttons.length;
    if (window.matchMedia("(min-width: 600px)").matches) {
        const totalButtonWidth = Array.from(buttons).reduce((total, button) => {
            return total + button.clientWidth;
        }, 0);

        const availablePadding = (containerWidth - totalButtonWidth) / buttonCount;
        const paddingPerSide = availablePadding / 2;

        buttons.forEach(button => {
            button.style.paddingLeft = `${paddingPerSide - 5}px`;
            button.style.paddingRight = `${paddingPerSide - 5}px`;
        });
    }
}

window.addEventListener('resize', adjustButtonPadding);
window.addEventListener('load', adjustButtonPadding);

// Right and Left arrows for scrolling
const btnsContainer = document.querySelector('.videos-header-cont');
const btnsContainerInner = document.querySelector('.videos-header-btns-cont');
let arrowIndicatorRight;
let arrowIndicatorLeft;
let scrollSpeed = 200; // Adjust the scroll speed as needed
let isAnimating = false;

function addArrowIndicatorLeft() {
    arrowIndicatorLeft = document.createElement('div');
    arrowIndicatorLeft.className = 'arrows arrow-left slideInFromLeft';
    arrowIndicatorLeft.innerHTML = `
        <div id="arrow-left-btn" style="fill: currentcolor;">
            <div class="arrow-btn-size">
                <div style="width: 100%; height: 100%; fill: currentcolor;">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" style="pointer-events: none; display: block; width: 100%; height: 100%;">
                        <path d="M14.96 18.96 8 12l6.96-6.96.71.71L9.41 12l6.25 6.25-.7.71z"></path>
                    </svg>
                </div>
            </div>
        </div>`;
    btnsContainer.appendChild(arrowIndicatorLeft);

    arrowIndicatorLeft.addEventListener('click', function () {
        if (!isAnimating) {
            smoothScroll(btnsContainerInner, -scrollSpeed);
        }
    });
}

function addArrowIndicatorRight() {
    arrowIndicatorRight = document.createElement('div');
    arrowIndicatorRight.className = 'arrows arrow-right slideInFromRight';
    arrowIndicatorRight.innerHTML = `
        <div id="arrow-right-btn" style="fill: currentcolor;">
            <div class="arrow-btn-size">
                <div style="width: 100%; height: 100%; fill: currentcolor;">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" style="pointer-events: none; display: block; width: 100%; height: 100%;">
                        <path d="m9.4 18.4-.7-.7 5.6-5.6-5.7-5.7.7-.7 6.4 6.4-6.3 6.3z"></path>
                    </svg>
                </div>
            </div>
        </div>`;
    btnsContainer.appendChild(arrowIndicatorRight);

    arrowIndicatorRight.addEventListener('click', function () {
        if (!isAnimating) {
            smoothScroll(btnsContainerInner, scrollSpeed);
        }
    });
}

function removeArrowIndicatorLeft() {
    if (arrowIndicatorLeft) {
        btnsContainer.removeChild(arrowIndicatorLeft);
        arrowIndicatorLeft = null;
    }
}

function removeArrowIndicatorRight() {
    if (arrowIndicatorRight) {
        btnsContainer.removeChild(arrowIndicatorRight);
        arrowIndicatorRight = null;
    }
}

function checkOverflow() {
    const isOverflowRight = btnsContainerInner.scrollWidth > btnsContainerInner.clientWidth + btnsContainerInner.scrollLeft + 1;
    const isOverflowLeft = btnsContainerInner.scrollLeft > 1;

    if (isOverflowRight) {
        if (!arrowIndicatorRight) {
            addArrowIndicatorRight();
        }
    } else {
        removeArrowIndicatorRight();
    }

    if (isOverflowLeft) {
        if (!arrowIndicatorLeft) {
            addArrowIndicatorLeft();
        }
    } else {
        removeArrowIndicatorLeft();
    }
}

// Initial check on load
checkOverflow();

// Event listener for scroll to check overflow
btnsContainerInner.addEventListener('scroll', function () {
    checkOverflow();
});

// Function for custom smooth scrolling
function smoothScroll(element, distance) {
    const start = element.scrollLeft;
    const end = start + distance;
    const duration = 500; // Adjust the duration as needed
    let startTime;

    function scrollAnimation(currentTime) {
        if (!startTime) startTime = currentTime;

        const progress = currentTime - startTime;
        const easeInOut = 0.5 - 0.5 * Math.cos(Math.PI * progress / duration);

        element.scrollLeft = start + easeInOut * distance;

        if (progress < duration) {
            requestAnimationFrame(scrollAnimation);
        } else {
            isAnimating = false;
            checkOverflow(); // Check overflow again after scrolling
        }
    }

    isAnimating = true;
    requestAnimationFrame(scrollAnimation);
}

// Re-check on window resize to handle dynamic content
window.addEventListener('resize', checkOverflow);