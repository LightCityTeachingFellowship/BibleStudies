/*HIDE ALL ELEMENTS THAT ARE NOT H1 (or H2)*/
let b = document.querySelectorAll("main > *");
var htmlhArray = ["H6", "H5", "H4", "H3", "H2", "H1"];
var displayNoneOrBlock = '';

function hideOrShowAllHnum() {
    const sopen = "../images/arrow-down-svgrepo-com.svg";
    const sclose = "../images/arrow-right-angle-svgrepo-com.svg";
	// Handle H1 specifically
	const allIconsH0 = document.querySelectorAll('h1.H0>img.toggle-icon');
    allIconsH0.forEach(icon => {
		if (icon.src.includes(sopen)) {
            icon.src = sclose;
        } else {
            icon.src = sopen;
        }
    });
	// Loop through H2 to H6
    htmlhArray.forEach(element => {
        const h2showit = "." + element;
        const allIcons = document.querySelectorAll(h2showit + ">img.toggle-icon");
        allIcons.forEach(icon => {
			if (icon.src.includes(sopen)) {
                icon.src = sclose;
            } else {
                icon.src = sopen;
            }
        });
		// Toggle the display of elements under the heading
        if (displayNoneOrBlock === 'none') {
            document.querySelectorAll(h2showit).forEach(sh => {
                sh.style.display = displayNoneOrBlock;
            });
        } else {
            document.querySelectorAll(h2showit).forEach(sh => {
                sh.style.display = displayNoneOrBlock;
            });
        }
    });
	// Flip the toggle state for next run
    displayNoneOrBlock = displayNoneOrBlock === 'none' ? '' : 'none';
}

/* To ensure it starts hiding element after the first H1 and not from before it, if there is another element before it */
for (k = 0; k < b.length; k++) {
	if(b[k].tagName == "H1"){
		var i = k;
		break;
	}
};

/* Add classes indicating the header elements are under */

for (i; i < b.length; i++) {
	var num = b[i].tagName.charAt(1);
	var a = num;
	
	var btag = b[i].tagName.toUpperCase();
	var showaar;
	
	/* For H1 to H6 */
	if (htmlhArray.includes(btag)) {
		showaar = btag;
		/* Add showaar classes to Headers */
		var x = a - 1;
		var showaarH = "H" + x;
		b[i].classList.add(showaarH);

		/* AddEventListener To All Headers from 1 to 6 */
		b[i].addEventListener('click', togglefunction);
		b[i].style.cursor = "pointer";

		/* Prepend span element in headers to hold utf-8 symbols for open and close */
		var iconImg = document.createElement("img");
		iconImg.classList.add("toggle-icon");
		iconImg.src = "../images/arrow-right-angle-svgrepo-com.svg";  // default is closed
		b[i].prepend(iconImg);
		    // Wrap remaining text in <nav>
		    var navWrapper = document.createElement("nav");
		
		    // Move all non-icon child nodes into <nav>
		    const childNodes = Array.from(b[i].childNodes);
		    childNodes.forEach(node => {
			if (node !== iconImg) {
			    navWrapper.appendChild(node);
			}
		    });
		
		    b[i].appendChild(navWrapper);
	} 
	/* For Elements other than H1 - H6 and SCRIPT */
	/* HIDE ALL ELEMENTS THAT ARE NOT H1 */
	if ((btag != "H1") && (btag != "SCRIPT")) {
		b[i].style.display = "none";
		var h2showit = showaar;
		if (!htmlhArray.includes(btag)) {b[i].classList.add(h2showit);}
	}
};

/* Toggle Function */
function togglefunction() {
	
	/* To toggle open/close svg icons */
	
var iconImg = this.querySelector(".toggle-icon");
var isClosed = iconImg.src.includes("arrow-right-angle-svgrepo-com.svg");  // use actual filename

if (isClosed) {
    iconImg.src = "../images/arrow-down-svgrepo-com.svg";  // update to open icon
} else {
    iconImg.src = "../images/arrow-right-angle-svgrepo-com.svg";  // update to closed icon
}


	var hSib1 = this.nextElementSibling;
	var hSibs = this.nextElementSibling;

	var htag = this.tagName;
	// var htagIndex = htmlhArray.indexOf(htag);
	var h2showit = htag;

	/* Check the state of the nextElementSibling to determine whether to hide or to show */
	if (hSib1.style.display == "none") {
		var state = "";
		/*this.classList.add("open");
		this.classList.remove("closed");*/
	} else {
		var state = "none";
		/*this.classList.add("closed");
		this.classList.remove("open");*/
	};

	/* THE ACTUAL TOGGLE FUNCTION */
	while ((htmlhArray.includes((hSibs.tagName), (htmlhArray.indexOf(htag))) == 0) && (hSibs.tagName != "SCRIPT")) {
		//Hide
		if (state == "none") {
			if (hSibs.style.display != "none") {
				// hSibs.classList.add(h2showit);
			};
			hSibs.style.display = "none";

			/* Show (show elements the clicked header is to show it) */
		} else if (hSibs.classList.contains(h2showit)) {
			hSibs.style.display = "";
			// hSibs.classList.remove(h2showit);

			/* Show (show elements that have the tag of the clicked header as a class) */
		} else if (hSibs.classList.contains(htag) == true) {
			hSibs.style.display = "";
		}

		hSibs = hSibs.nextElementSibling;
	}
}


// /*HIDE ALL ELEMENTS THAT ARE NOT H1 (or H2)*/
// let b = document.querySelectorAll("main > *");
// var htmlhArray = ["H6", "H5", "H4", "H3", "H2", "H1"];
// var displayNoneOrBlock = '';

// function hideOrShowAllHnum() {
//     const sopen = "\uf107 ";
//     const sclose = "\uf105 ";
// 	const allIconsH0 = document.querySelectorAll('h1.H0>p.fa');
//     allIconsH0.forEach(icon => {
//         if (icon.textContent.trim() === sopen.trim()) {
//             icon.textContent = sclose;
//         } else {
//             icon.textContent = sopen;
//         }
//     });
//     htmlhArray.forEach(element => {
//         const h2showit = "." + element;
//         const allIcons = document.querySelectorAll(h2showit + ">p.fa");
//         allIcons.forEach(icon => {
//             if (icon.textContent.trim() === sopen.trim()) {
//                 icon.textContent = sclose;
//             } else {
//                 icon.textContent = sopen;
//             }
//         });
//         if (displayNoneOrBlock === 'none') {
//             document.querySelectorAll(h2showit).forEach(sh => {
//                 sh.style.display = displayNoneOrBlock;
//             });
//         } else {
//             document.querySelectorAll(h2showit).forEach(sh => {
//                 sh.style.display = displayNoneOrBlock;
//             });
//         }
//     });
//     displayNoneOrBlock = displayNoneOrBlock === 'none' ? '' : 'none';
// }

// /* To ensure it starts hiding element after the first H1 and not from before it, if there is another element before it */
// for (k = 0; k < b.length; k++) {
// 	if(b[k].tagName == "H1"){
// 		var i = k;
// 		break;
// 	}
// };

// /* Add classes indicating the header elements are under */

// for (i; i < b.length; i++) {
// 	var num = b[i].tagName.charAt(1);
// 	var a = num;
	
// 	var btag = b[i].tagName.toUpperCase();
// 	var showaar;
	
// 	/* For H1 to H6 */
// 	if (htmlhArray.includes(btag)) {
// 		showaar = btag;
// 		/* Add showaar classes to Headers */
// 		var x = a - 1;
// 		var showaarH = "H" + x;
// 		b[i].classList.add(showaarH);

// 		/* AddEventListener To All Headers from 1 to 6 */
// 		b[i].addEventListener('click', togglefunction);
// 		b[i].style.cursor = "pointer";

// 		/* Prepend span element in headers to hold utf-8 symbols for open and close */
// 		var spanOpen = document.createElement("p");
// 		spanOpen.classList.add('fa');
// 		b[i].prepend(spanOpen);
// 		bhSpan = b[i].querySelectorAll("p")[0];
// 		bhSpan.appendChild(document.createTextNode("\uf105 "));
// 	//	bhSpan.style.color = "blue";
// 	} 
// 	/* For Elements other than H1 - H6 and SCRIPT */
// 	/* HIDE ALL ELEMENTS THAT ARE NOT H1 */
// 	if ((btag != "H1") && (btag != "SCRIPT")) {
// 		b[i].style.display = "none";
// 		var h2showit = showaar;
// 		if (!htmlhArray.includes(btag)) {b[i].classList.add(h2showit);}
// 	}
// };

// /* Toggle Function */
// function togglefunction() {
	
// 	/* To toggle open/close utf-8 icons */
	
// 	var hspan = this.querySelectorAll("p")[0];
// 	var sopen = "\uf107 ";
// 	var sclose = "\uf105 ";
// 	if (hspan.innerHTML == sopen) {
// 		hspan.innerHTML = sclose;
// 		//  hspan.style.color = "blue";
// 	} else {
// 		hspan.innerHTML = sopen;
// 		//	hspan.style.color = "red";
// 	};

// 	var hSib1 = this.nextElementSibling;
// 	var hSibs = this.nextElementSibling;

// 	var htag = this.tagName;
// 	// var htagIndex = htmlhArray.indexOf(htag);
// 	var h2showit = htag;

// 	/* Check the state of the nextElementSibling to determine whether to hide or to show */
// 	if (hSib1.style.display == "none") {
// 		var state = "";
// 		/*this.classList.add("open");
// 		this.classList.remove("closed");*/
// 	} else {
// 		var state = "none";
// 		/*this.classList.add("closed");
// 		this.classList.remove("open");*/
// 	};

// 	/* THE ACTUAL TOGGLE FUNCTION */
// 	while ((htmlhArray.includes((hSibs.tagName), (htmlhArray.indexOf(htag))) == 0) && (hSibs.tagName != "SCRIPT")) {
// 		//Hide
// 		if (state == "none") {
// 			if (hSibs.style.display != "none") {
// 				// hSibs.classList.add(h2showit);
// 			};
// 			hSibs.style.display = "none";

// 			/* Show (show elements the clicked header is to show it) */
// 		} else if (hSibs.classList.contains(h2showit)) {
// 			hSibs.style.display = "";
// 			// hSibs.classList.remove(h2showit);

// 			/* Show (show elements that have the tag of the clicked header as a class) */
// 		} else if (hSibs.classList.contains(htag) == true) {
// 			hSibs.style.display = "";
// 		}

// 		hSibs = hSibs.nextElementSibling;
// 	}

// }
