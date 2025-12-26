function hideOrShowAllHnum() {
	const h1to6arr = ['H1','H2','H3','H4','H5','H6'];
	const article = document.querySelector('article');
	// OPEN ALL
	if(toggleAllBtn.checked){
		article.querySelectorAll('.hidingsibs').forEach(x => {x.classList.remove('hidingsibs');})
		h1to6arr.forEach(x=>{
			article.querySelectorAll('.hidby_'+ x).forEach(y=>{y.classList.remove('hidby_'+ x);})
		})
	}
	// CLOSE ALL
	else {
		let allChildrenOf_article = Array.from(article.children), prvHx, youMayHide=false;
		allChildrenOf_article.forEach((elm,i)=>{
			//Only hide after coming across a header
			let elmTagName=elm.tagName.toUpperCase();
			if(!youMayHide && h1to6arr.includes(elmTagName)){
				prvHx=h1to6arr.find(x=>{return x==elmTagName.toUpperCase();});
				youMayHide=true;
			}
			if(youMayHide){
				if (!h1to6arr.includes(elmTagName) || Number(elmTagName.match(/\d+/g)) < Number(prvHx.match(/\d+/g))) {
					h1to6arr.forEach(hx=>{elm.classList.remove('hidby_'+hx)});//don't hide headings
					elm.classList.add('hidby_' + prvHx);
				}
				if(h1to6arr.includes(elmTagName)){//elm is header 
					elm.nextElementSibling && !elm.nextElementSibling.matches('h1,h2,h3,h4,h5,h6')?elm.classList.add('hidingsibs'):null;
					h1to6arr.forEach(hx=>{elm.classList.remove('hidby_'+hx)});//don't hide headings
					prvHx=h1to6arr.find(x=>{return x==elmTagName.toUpperCase();});
				}
			}
		})
	}
}
