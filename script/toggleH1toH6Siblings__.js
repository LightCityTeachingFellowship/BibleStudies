document.body.addEventListener('click', toggleH1to6siblings);
document.body.addEventListener('contextmenu', toggleH1to6siblings);
document.body.addEventListener('keydown', toggleH1to6siblings);
document.body.querySelectorAll('H1:not(main>h1):not(.homeResources-grid-containter>h1):not(.homeResources-grid>h1):not(.titles-inner>h1):not(.Resources-grid>h1)','H2:not(main>h2):not(.homeResources-grid-containter>h2):not(.homeResources-grid>h2):not(.titles-inner>h2):not(.Resources-grid>h2)','H3:not(main>h3):not(.homeResources-grid-containter>h3):not(.homeResources-grid>h3):not(.titles-inner>h3):not(.Resources-grid>h3)','H4:not(main>h4):not(.homeResources-grid-containter>h4):not(.homeResources-grid>h4):not(.titles-inner>h4):not(.Resources-grid>h4)','H5:not(main>h5):not(.homeResources-grid-containter>h5):not(.homeResources-grid>h5):not(.titles-inner>h5):not(.Resources-grid>h5)','H6:not(main>h6):not(.homeResources-grid-containter>h6):not(.homeResources-grid>h6):not(.titles-inner>h6):not(.Resources-grid>h6)').forEach(x=>{toggleH1to6siblings(null, x)})

function toggleH1to6siblings(e, eTarget, mustMatch){
    if((e && (!e.target.closest('H1,H2,H3,H4,H5,H6') || e.target.closest('.verse_note .notemenu') || (e.type=='contextmenu' && e.target.closest(':is([ref], .strnum, [strnum]):not(.context_menu)')))) || (mustMatch && !e.target.closest(mustMatch))){return}
    
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
    const eTargetParent = !hElm.closest('#context_menu') && hElm.closest('.compare_verses') ? hElm.closest('.compare_verses') : hElm.parentElement;
    if(!h1to6arr.includes(hTag.toUpperCase()) || eTargetParent.contentEditable=='true' && e && !wasMarkerClicked(e,hElm)){return}

    function unhideAllH1to6() {
        eTargetParent.querySelectorAll('.hidingsibs').forEach(x => {x.classList.remove('hidingsibs');})
        h1to6arr.forEach(x=>{
            eTargetParent.querySelectorAll('.hidby_'+ x).forEach(y=>{y.classList.remove('hidby_'+ x);})
        })
    }
    if(!h1to6arr.includes(hTag.toUpperCase())){return}      
    if(e?.type=='contextmenu' && ![1,3].includes(e.buttons)){
        e.preventDefault();
        let hElm_hNum = Number(hElm.tagName.replace(/h/i,''));
        let queryString = '1,2,3,4,5,6'.split(hElm_hNum+1)[0].replace(/,\s*$/g,'').replace(/(\d)/g,'h$1:not(.hidingsibs)'); // '6,5,4,3,2,1' reverse
        const othersH1to6showing = Array.from(eTargetParent.querySelectorAll(queryString));// It MUST target only the open ones

        let prev_highest_hNum = hElm_hNum;//prev_highest_pseudoAncestor_hNum
        //hide siblings of any whose siblings are showing, if any
        function limitedToggle(array,y=false) {
            let allFamily = eTargetParent.matches('.compare_verses') ? Array.from(eTargetParent.children).map(child => Array.from(child.children)).flat(Infinity) : Array.from(eTargetParent.children);
            
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
                    // closestScrollableAncestors(hElm);
                    sc ? setTimeout(() => {hElm.scrollIntoView({behavior:'smooth',block:'nearest'})}, 200) : null;
                    return
                }
            }
        }
        // closestScrollableAncestors(hElm);
        sc ? setTimeout(() => {hElm.scrollIntoView({behavior:'smooth',block:'nearest'})}, 200) : null;
    }
}
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
