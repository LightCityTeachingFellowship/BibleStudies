hideOrShowAllHnum(true); // Hide all on page load
function hideOrShowAllHnum(hideAll) {
	const h1to6arr = ['H1','H2','H3','H4','H5','H6'];
	const article = document.querySelector('article');
	// OPEN ALL
	if(!hideAll && toggleAllBtn.checked){
		article.querySelectorAll('.hidingsibs').forEach(x => {x.classList.remove('hidingsibs');})
		h1to6arr.forEach(x=>{
			article.querySelectorAll('.hidby_'+ x).forEach(y=>{y.classList.remove('hidby_'+ x);})
		})
	}
	// CLOSE ALL
	else {
		const h1to6arrReversed = [...h1to6arr].reverse();
		
		h1to6arrReversed.forEach((hx,i)=> {
		    document.querySelectorAll(`article ${hx}`).forEach(h => {
		        const higherHxs = h1to6arrReversed.slice(i);     // same or higher
		        const lowerHxs  = h1to6arrReversed.slice(0, i);  // lower only
				
		        const higherSel = higherHxs.map(x => x.toLowerCase()).join(',');
		        const lowerSel  = lowerHxs.map(x => x.toLowerCase()).join(',');
		    
		        let hSib = h.nextElementSibling;
		        hSib && !hSib.matches(`script,style,${higherSel}`) ? h.classList.add('hidingsibs') : hSib = null;
		        
		        while (hSib) {
		            hSib.classList.add(`hidby_${hx}`);
		            
		            hSib = hSib.nextElementSibling;
		            if (!hSib) break;
		            
		            if (hSib.matches(`script,style,${higherSel}`)) break;
		            
		            // if (lowerSel && hSib.matches(lowerSel)) {
		            //     hSib.classList.add(`hidby_${hx}`);
		            //     break;
		            // }
		        }
		    });
		});
	}
}
