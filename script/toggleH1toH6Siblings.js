if (!Element.prototype.scrollIntoViewAvoidCover) {
    Element.prototype.scrollIntoViewAvoidCover = function (coverEl, options = {}) {
        const el = this;
        if (!el || typeof el.scrollIntoView !== 'function') return;

        el.scrollIntoView(options);

        setTimeout(() => {
            if (!coverEl){ return }
                else if (typeof coverEl == 'string') {
                    coverEl = document.querySelector(coverEl);
                    if (!coverEl){ return }
                }
                else if (!(coverEl instanceof Element)) {return};
                
                const rect = coverEl.getBoundingClientRect?.();
                if (!rect) return;

                let coverHeight = rect.height || 0;
                if (!coverHeight || (rect.y + rect.height < 0)) return;
                if(rect.y < el.getBoundingClientRect?.().height + 5){
                    coverHeight  = coverHeight + rect.y + 5;
                }
                else { return }

                const behavior = options.behavior || 'auto';
                const scroller = findNearestScrollableAncestor(el);

                (scroller === document.scrollingElement || scroller === document.documentElement
                    ? window
                    : scroller
                ).scrollBy({ top: -coverHeight, behavior });
        }, 1000);

        function findNearestScrollableAncestor(element) {
            // Start from the element's parent
            let current = element.parentElement;
            
            while (current && current !== document.body) {
                const styles = window.getComputedStyle(current);
                const overflowY = styles.overflowY;
                const overflowX = styles.overflowX;
                const overflow = styles.overflow;
                
                // Check if element has scrollable overflow
                const isScrollable = 
                    (overflowY === 'auto' || overflowY === 'scroll' || 
                    overflowX === 'auto' || overflowX === 'scroll' ||
                    overflow === 'auto' || overflow === 'scroll');
                
                // Check if content is actually larger than container
                const hasScrollableContent = 
                    current.scrollHeight > current.clientHeight ||
                    current.scrollWidth > current.clientWidth;
                
                if (isScrollable && hasScrollableContent) {
                    return current;
                }
                
                current = current.parentElement;
            }
            
            // If no scrollable ancestor found, return document.documentElement or window
            return document.documentElement;
        }
    };
}
// DON'T ADD EVENTLISTNER IF HOMEPAGE
if(!document.querySelector('#homeBodyContent')){
    document.body.addEventListener('click', toggleH1to6siblings);
    document.body.addEventListener('contextmenu', toggleH1to6siblings);
    document.body.addEventListener('keydown', toggleH1to6siblings);
    
    // AutoAdjust checked state of #toggleAllBtn -- `Expand All`/`Collapse All`
    const toggleAllBtn = document.body.querySelector('#toggleAllBtn');
    const article = document.body.querySelector('article');
    document.body.querySelectorAll('article :is(h6,h5,h4,h3,h2,h1):not(header > :is(h6,h5,h4,h3,h2,h1))').forEach(h=>{
        h.addEventListener('click', ()=>{
            if(!article.querySelector('.hidingsibs')){
                // All headers are showing lower siblings
                toggleAllBtn.checked = false;
            } else {
                toggleAllBtn.checked = true;
            }
        })
    })
}
function toggleH1to6siblings(e, eTarget, mustMatch){   
    if((e && (!e.target.closest('H1,H2,H3,H4,H5,H6') || e.target.closest('.verse_note .notemenu, body header, body footer, #homeBodyContent, #Contact-section') || (e.target.closest('#searchPreviewFixed,#scriptureCompareWindow') && !e.target.closest('.context_menu,.crossrefs'))||(e.type=='contextmenu' && e.target.closest(':is([ref],.strnum,[strnum]):not(.context_menu)'))))||(mustMatch && !e.target.closest(mustMatch))){return}

    let hElm, hTag;
    const h1to6arr = ['H1','H2','H3','H4','H5','H6'];
    if(e){
        if(isMouseOverHighlightedText()){mouseDownTimeStamp = null;return}// If mouse is over highlighted text, the assumption is that the intention is to copy the text
        else if(e.target.matches('[strnum]')){return}
        // hElm = e.target or closest heading ancestor;
        hElm = h1to6arr.includes(e.target.tagName.toUpperCase())==true ? e.target : (e.target.closest('h1,h2,h3,h4,h5,h6') ? e.target.closest('h1,h2,h3,h4,h5,h6') : e.target)
        if(e.key==2){e.preventDefault();}
    } else {hElm = eTarget}
    hTag = hElm.tagName;
    const hElmHidingSiblings = hElm.classList.contains('hidingsibs');
    const eTargetParent = hElm.parentElement;
    if(!h1to6arr.includes(hTag.toUpperCase()) || eTargetParent.contentEditable=='true' && !wasMarkerClicked(e,hElm)){return}

    function unhideAllH1to6() {
        eTargetParent.querySelectorAll('.hidingsibs').forEach(x => {x.classList.remove('hidingsibs');})
        h1to6arr.forEach(x=>{
            eTargetParent.querySelectorAll('.hidby_'+ x).forEach(y=>{y.classList.remove('hidby_'+ x);})
        })
    }
    if(!h1to6arr.includes(hTag.toUpperCase())){return}      
    if(e?.type=='contextmenu'){
        e.preventDefault();
        let hElm_hNum = Number(hElm.tagName.replace(/h/i,''));
        let queryString = '1,2,3,4,5,6'.split(hElm_hNum+1)[0].replace(/,\s*$/g,'').replace(/(\d)/g,'h$1:not(.hidingsibs)'); // '6,5,4,3,2,1' reverse
        const othersH1to6showing = Array.from(eTargetParent.querySelectorAll(queryString));// It MUST target only the open ones

        let prev_highest_hNum = hElm_hNum;//prev_highest_pseudoAncestor_hNum
        //hide siblings of any whose siblings are showing, if any
        function limitedToggle(array,y=false) {
            let allFamily = Array.from(eTargetParent.children);
            let ancestors2ignore = [];
            // go backwards and find pseudo ancestors that should not be toggled
            for (let i = allFamily.indexOf(hElm); i > -1; i--) {
                const elm = allFamily[i];
                if(elm.matches('h1,h2,h3,h4,h5,h6')){
                    const elm_hNum = Number(elm.tagName.replace(/h/i,''));
                    elm_hNum < prev_highest_hNum ? ancestors2ignore.push(elm) : null;
                    elm_hNum < prev_highest_hNum ? prev_highest_hNum = elm_hNum : null;
                }
            }
            for (let i = allFamily.indexOf(hElm); i < allFamily.length; i++) {
                const elm = allFamily[i];
                if(elm.matches('h1,h2,h3,h4,h5,h6')){
                    const elm_hNum = Number(elm.tagName.replace(/h/i,''));
                    if (elm_hNum < hElm_hNum) {break} 
                    elm_hNum >= hElm_hNum ? ancestors2ignore.push(elm) : null;
                }
            }
            let hid_something;
            (!y ? array : array.length > 0) ? array.forEach(x=>{
                const x_hNum = Number(x.tagName.replace(/h/i,''));
                //hide headers of the same level or lower...
                if(((!ancestors2ignore.includes(x)) || hElm_hNum <= x_hNum) ){toggleH1to6siblings(null, x); hid_something=true;}
            }):(y ? (toggleH1to6siblings(null, hElm),hid_something=true) : null);

            y && !hid_something ? toggleH1to6siblings(null, hElm) : null;
        }
        if(hElmHidingSiblings){
            limitedToggle(othersH1to6showing);//then show its own nonH1to6 siblings
            toggleH1to6siblings(null, hElm);
        }
        //remove hElm from the h1to6 showing their siblings
        else {
            othersH1to6showing.splice(othersH1to6showing.indexOf(hElm),1);
            //hide siblings of any whose siblings are showing, if any, but if none, just hide this one's nonH1to6 sibs
            limitedToggle(othersH1to6showing,true);
        }
    }
    //hide or unhide all non-headings
    else if((e?.ctrlKey && ['click','contextmenu'].includes(e.type)) || (e?.type=='contextmenu' && [1,3].includes(e.buttons))){
        // left mouse button down + rightclick
        if(hElmHidingSiblings){unhideAllH1to6();}
        else {
            let allChildrenOfeTargetParent = Array.from(eTargetParent.children), prvHx, youMayHide=false;
            allChildrenOfeTargetParent.forEach((elm,i)=>{
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
    //hide or unhide all headings lower than current heading and non-headings that come after current heading and that precede an equal or greater heading
    else if(!e || e.type=='click'){
        
        const hIndx = h1to6arr.indexOf(hTag);
        // const hIndx = Number(hTag.match(/\d+/)[0])-1;
        let hElmSibling = hElm.nextElementSibling;
        let hElmSibTagName;
        if(hElmSibling){
            hElmSibTagName = hElmSibling.tagName.toUpperCase();
            if((h1to6arr.includes(hElmSibTagName) && (h1to6arr.indexOf(hElmSibTagName) < hIndx))){return}
        }
        let sc = hElmHidingSiblings;
        while(hElmSibling && hElmSibTagName != hTag && hElmSibTagName != 'SCRIPT'){
            // Show all sibling if Helm was hidingsibs
            if(hElmHidingSiblings && hElmSibling.classList.contains('hidby_' + hTag)){
                if(e && e.altKey){
                    for (let i = hIndx; i <= 6; i++) {
                        hElmSibling.classList.remove('hidby_H' + i);
                        hElmSibling.classList.remove('hidingsibs');//in case it is a H1to6 hiding sibling,
                    }
                }
                else {hElmSibling.classList.remove('hidby_H' + (hIndx+1))};
                hElm.classList.remove('hidingsibs')
            }
            // Hide all sibling if Helm is not hiding siblings
            else if (!hElmHidingSiblings) {
                hElmSibling.classList.add('hidby_' + hTag);
                hElm.classList.add('hidingsibs')
            }
            hElmSibling = hElmSibling.nextElementSibling;
            if(hElmSibling){
                hElmSibTagName = hElmSibling.tagName.toUpperCase();
                if((h1to6arr.includes(hElmSibTagName) && (h1to6arr.indexOf(hElmSibTagName) < hIndx))){
                    // sc ? setTimeout(() => {hElm.scrollIntoViewAvoidCover('#cke_editing_page', {behavior:'smooth',block:'start'})}, 200) : null;
                    return
                }
            }
        }        
        // sc ? setTimeout(() => {hElm.scrollIntoViewAvoidCover('#cke_editing_page', {behavior:'smooth',block:'start'})}, 200) : null;
    }
}
function wasMarkerClicked(e,clicked_elm) {
    if (!clicked_elm) return false;
    const clicked_elm_paddingLeft = parseFloat(window.getComputedStyle(clicked_elm).paddingLeft) + parseFloat(clicked_elm.getBoundingClientRect().left);// Calculate the padding-left of ul or `ol`
    const clicked_elm_Left = parseFloat(clicked_elm.getBoundingClientRect().left);// calculate the margin-left of clicked_li
    const clickX = e.clientX;
    const markerBoundary = clicked_elm_paddingLeft + clicked_elm_Left;// Calculate marker boundary based on combined padding and margin
    const markerWasClicked = clickX >= clicked_elm_Left && clickX <= markerBoundary;// Check if the click falls within the marker boundary
    return markerWasClicked

}
// Function to check if the mouse is over the highlighted text
function isMouseOverHighlightedText() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (range) {
            const rects = range.getClientRects();
            if (rects.length > 0) {
                for (let i = 0; i < rects.length; i++) {
                  const rect = rects[i];
                  if (
                    event.clientX >= rect.left &&
                    event.clientX <= rect.right &&
                    event.clientY >= rect.top &&
                    event.clientY <= rect.bottom
                    ) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}
// Function to find the closest scrollable ancestors for x and y directions
function closestScrollableAncestors(element,limit) {
    let scrollableAncestor;
    let scrollableAncestorY = null;
    let scrollableAncestorX = null;

    while (element) {
        const style = window.getComputedStyle(element);
        const overflowY = style.overflowY;
        const overflowX = style.overflowX;

        const isScrollableY = (overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight;
        const isScrollableX = (overflowX === 'auto' || overflowX === 'scroll') && element.scrollWidth > element.clientWidth;

        if (isScrollableY && !scrollableAncestorY) {scrollableAncestorY = element;}
        if (isScrollableX && !scrollableAncestorX) {scrollableAncestorX = element;}
        scrollableAncestor = element;
        if ((scrollableAncestorY && scrollableAncestorX)||(element==limit)) {break;}// Found both scrollable ancestors //don't go beyond this parent
        element = element.parentElement;
    }
    return { elm:scrollableAncestor, x: scrollableAncestorX, y: scrollableAncestorY };
}







