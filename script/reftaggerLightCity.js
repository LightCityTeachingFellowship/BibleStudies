let showingXref=localStorage.getItem('showingXref')?JSON.parse(localStorage.getItem('showingXref')):false;
let main = document.body;
let pagemaster = document.body;
let isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|BB|PlayBook|IEMobile|Windows Phone|Kindle|Silk|Opera Mini/i.test(navigator.userAgent)
let contextMenu_touch="contextmenu";
let bibleversions_Array = ['KJV','ESV','NIV84','ABP-gr','NETplus'];
if(localStorage.getItem("bversionName") == 'NIV’84'){localStorage.setItem("bversionName", "NIV84")}
document.body.classList.add('middleContextMenu');// make .fillscreen vertically centered by default
	
document.head.querySelectorAll('#lightCityReftaggerContextMenuStyleInHead').forEach(l => {l.remove()})

/* **** ****************************** **** */
/* **** CONTEXTMENU//SCRIPTURE TOOLTIP **** */
/* **** ****************************** **** */
// ToDo: change 'context_menu' to 'scriptureContextMenu' site-wide
let cmenu_backwards_navigation_arr=[];
let prev_contextmenu;
let newStrongsDef = '';
let rightClickedElm = null;

// document.addEventListener('dblclick', appendCrossReferences);
document.addEventListener('click', appendCrossReferences);
document.addEventListener('contextmenu', appendCrossReferences);
/* Toggle individual .verse by clicking [ref] xRef */
document.addEventListener('mousedown', function(e) {
    if(e.button === 0 && e.target.matches('#context_menu .verse > code')){
        e.target.addEventListener('mouseup', codeMouseUp) 
        function codeMouseUp(ev) {
            if (ev.button === 2) {
                if (rightMouseDownTime !== null) {
                    const heldDuration = Date.now() - rightMouseDownTime;            
                    const threshold = 300; // milliseconds
                    // Short right-click detected
                    if (heldDuration < threshold) {
                        recognizeRightClick = true;
                        e.target.closest('.verse').querySelector('.crfnnote').classList.toggle('displaynone');
                        e.target.removeEventListener('mouseup', codeMouseUp);
                    }
                    else {e.target.removeEventListener('mouseup', codeMouseUp); return}
                }
            }
            // slideUpDown(e.target.closest('.verse').querySelector('.crfnnote'));
            e.target.closest('.verse').querySelector('.crfnnote').classList.toggle('displaynone');
            e.target.removeEventListener('mouseup', codeMouseUp);
        }
        setTimeout(() => {e.target.removeEventListener('mouseup', codeMouseUp)}, 300);
    }
})

document.addEventListener('click', contextMenu_Remove);
document.addEventListener('keydown', contextMenu_Remove);
document.addEventListener('dblclick', mainBibleVersion);
document.addEventListener('contextmenu', mainBibleVersion);

//click calls contexMenu in BibleNodes pages
document.addEventListener('contextmenu', contextMenu_CreateNAppend);
// On touch screens, click will act as contextmenu for refs and strnums
(function () {
    const DOUBLE_TAP_THRESHOLD = 450; // ms — 400–500 works well on most devices
    let pendingContextMenu = null; // {event, timeoutId} or null
    let lastTapTarget = null;
    let selection;
    let range;

    function captureSelection() {
        selection = window.getSelection();
        range = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    }

    function cancelPendingContextMenu() {
        if (pendingContextMenu) {
            clearTimeout(pendingContextMenu.timeoutId);
            pendingContextMenu = null;
        }
    }
    document.addEventListener('mousedown', function (e) {captureSelection()})

    document.addEventListener('click', function (e) {
        // Only touch-initiated events
        if (e.pointerType !== 'touch') return;
        const target = e.target?.closest('[ref],[strnum],.crossrefs [tabindex]');
        if (!target) return;
        const now = performance.now();
        const isStrnum = target.hasAttribute('strnum');
        
        //1. If this is a very quick second tap → block everything
        if (isStrnum && lastTapTarget === target && pendingContextMenu && (now - pendingContextMenu.event.timeStamp) < DOUBLE_TAP_THRESHOLD ) {
            // quick second tap → cancel & block context menu
            cancelPendingContextMenu();
            e.preventDefault();
            e.stopPropagation();
            lastTapTarget = null;   // reset so next single tap works again
            return;
        }
        
        // 2. Remember this tap (used to detect same-element double tap)
        lastTapTarget = target;
        // 3. Cancel any previous pending menu (old single-tap wait)
        cancelPendingContextMenu();
        
        // 4. [ref] but not [strnum] → immediate context menu
        if (!isStrnum) {
            // non-[strnum] → immediate context menu
            showContextMenu(e);
            return;
        }
        // 5. [strnum] → first tap → schedule context menu after delay (will be cancelled if second tap arrives quickly)
        const timeoutId = setTimeout(() => {
            // delay passed → showing context menu (was single tap)
            showContextMenu(pendingContextMenu.event);
            pendingContextMenu = null;
        }, DOUBLE_TAP_THRESHOLD);
        pendingContextMenu = {event: e, timeoutId: timeoutId};
        // Prevent immediate context menu / selection collapse
        e.preventDefault();
        e.stopPropagation();
    }, { passive: false });

    function showContextMenu(e) {
        // Restore selection so context menu handler can read it
        if (range) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
        contextMenu_CreateNAppend(e, null, 'contextmenu');
    }
})();
// For Running ContextMenu with Enter or Spacebar when [ref] or [strnum] is focused
document.addEventListener('keydown',function(e){
    /* Enter and Spacebar */
    if (['Enter', ' '].includes(e.key) && e.target.matches('[ref][tabindex]:not(.currentnode), span[tabindex]:not(.currentnode), [strnum][tabindex]:not(.currentnode)')) {
        e.preventDefault();
        e.target.addEventListener('keyup', cmenuOnEnterOfxRef);
        // alert('reftaggerLightCity.js preventing enter and spacebar')
    }
    function cmenuOnEnterOfxRef(evt) {
        if (['Enter', ' '].includes(evt.key)){
            evt.preventDefault();
            contextMenu_CreateNAppend(evt);
            e.target.removeEventListener('keyup', cmenuOnEnterOfxRef);
        }
    }
});
document.addEventListener('keyup', function(e){
    const docActElm = document.activeClickedElement;
    if (e.code=='Digit1' && document.querySelector('#context_menu.slideintoview')) {
        e.preventDefault();
        toggleCMenu_fillscreen(this.closest('#context_menu'))
    }
    else if (e.key=='/' && document.querySelector('#context_menu.fillscreen.slideintoview')) {
        e.preventDefault();
        document.body.classList.toggle('middleContextMenu');
    }//toggle context_menu fillscreen
})

/* ******* ******* ******* **** *** **** ******* ******* ***** ************* ** ************** ******* */
/* PREVENT DEFAULT CONTEXT MENU FOR WHEN ELEMENT CHANGES AFTER RIGHTCLICKING ON .crfnnote_btns buttons */
/* ******* ******* ******* **** *** **** ******* ******* ***** ************* ** ************** ******* */
let prevntDefault_cMenu = false;
let timer_prevntDefault_cMenu;
document.addEventListener('mouseover', preventContextMenu_mo);
document.addEventListener('contextmenu', preventContextMenu);
function preventContextMenu_mo(e) {
    if(e.target.matches('.verse_crossref_button,.compare_withinsearchresult_button')){
        clearTimeout(timer_prevntDefault_cMenu);
        prevntDefault_cMenu = true;
        document.addEventListener('contextmenu', preventContextMenu);
    } else {
        clearTimeout(timer_prevntDefault_cMenu)
        timer_prevntDefault_cMenu = setTimeout(() => {
            prevntDefault_cMenu = false;
            document.removeEventListener('contextmenu', preventContextMenu);}, 1000);
    }
}
function preventContextMenu(e) {if (prevntDefault_cMenu) {e.preventDefault();}}
/* ******* ******* *** ******* ***** ************* ** ************** ******* */
/* ******* ******* *** ******* ***** ************* ** ************** ******* */
let rightMouseDownTime = null;
let cmenu_filling_screen = false;
let cmenuWidthHeigh_b4_FillScreen = {};
function toggleCMenu_fillscreen(cm) {
    if (cm.classList.contains('fillscreen')) {
        cm.classList.remove('fillscreen');
        // reset saved width & height before on removing .fillscreen
        cmenuWidthHeigh_b4_FillScreen = {}
        cmenu_filling_screen = false;
    } else {
        // save width & height before .fillscreen
        cmenuWidthHeigh_b4_FillScreen.width = cm.offsetWidth;
        cmenuWidthHeigh_b4_FillScreen.height = cm.offsetHeight;
        cm.classList.add('fillscreen');
        cmenu_filling_screen = true;
    }
}
document.addEventListener("mousedown", (e) => {if(e.button===2){rightMouseDownTime=Date.now();}});
async function contextMenu_CreateNAppend(e,fill_screen,eType=e.type) {
    let recognizeRightClick = false;
    if (e.button === 2) {
        if (rightMouseDownTime !== null) {
            const heldDuration = Date.now() - rightMouseDownTime;
            const threshold = 300; // milliseconds
            if (heldDuration < threshold) {
                // Short right-click detected
                recognizeRightClick = true;
            }
            else {return}
        }
    }
    if (!e.target.matches('span[ref], rect[ref], .crossrefs>span:not(.notref), .translated, .strnum, #context_menu span:not(.notref):not(.verse)')||e.target.closest('.ignorecmenu')){hideRightClickContextMenu(); return} // Select the element(s) that the context menu will be attached to
	if (!e.target.matches('#context_menu *')){cmenu_backwards_navigation_arr=[];} // Reset the cmenu_backwards_navigation_arr if the context menu is not called from context_menu
    let addquotes = true,prv_indx='',currentContextMenu_style, cmenu_cmt_dX, cmenu_cmt_dY, cmenu_dX,cmenu_dY, prv_cmenuIndx=false, prv_title='',cmenu_tsk_display='displaynone',dzabled='disabled';
    // formerContextMenu_Coordinates.transform = context_menu.style.transform;
	let parentIsContextMenu=false;
    if (e.target.closest('.context_menu')) {
        parentIsContextMenu = true;
        if(e.target.closest('.crossrefs')){
            if(lsf=context_menu.querySelector('.lastSelectedRef')){lsf.classList.remove('lastSelectedRef')}
            e.target.classList.add('lastSelectedRef')
        }
        /* Store the old cmenu to go back to it */
        currentContextMenu_style = context_menu.getAttribute('style');
        cmenu_cmt_dX = context_menu.querySelector('.cmtitlebar').getAttribute('data-x');
        cmenu_cmt_dY = context_menu.querySelector('.cmtitlebar').getAttribute('data-y');
        cmenu_dX = context_menu.getAttribute('data-x');
        cmenu_dY = context_menu.getAttribute('data-y');
    } else {
        currentContextMenu_style='';
    }
	// if (!document.head.querySelector('#lightCityReftaggerContextMenuStyleInHead')) {
        addContextMenuStyleToHead();
	// }
    parentIsContextMenu = 0;
    let oldcMenuHeight = null;
    let newCmenu = createNewContextMenu();
    await ifForStrongsNumberORforCrossRef();
    await appendORpositionContextMenu();
    if (!e.hasOwnProperty('truecontextmenu')) {e.preventDefault();}
    
    // Create Context Menu if Not available
    function createNewContextMenu(){
        // If there isn't a contextMenu already, create one
        let cm = document.querySelector('#context_menu');
        let cmenu_inDOM_butNotReachable = (typeof context_menu == 'object' && context_menu instanceof Element && !context_menu.isConnected);
        if (!cm) {
            let context_menu_replacement = document.createElement('div');
            context_menu_replacement.id = 'context_menu';
            context_menu_replacement.classList.add('context_menu');
            context_menu_replacement.classList.add('slideintoview');
            showingXref==true?context_menu_replacement.classList.add('showingXref'):null;
            context_menu_replacement.style.display = 'block';
            context_menu = context_menu_replacement;
            document.body.prepend(context_menu_replacement);
            // document.body.appendChild(context_menu_replacement);
            return true
        }
        else if (cmenu_inDOM_butNotReachable){
            context_menu.remove();
            context_menu = null;
            return createNewContextMenu();
        }
        return false
    }
    /* ********************************** */
    /* ** WHERE TO APPEND CONTEXT-MENU ** */
    /* ********************************** */
    async function ifForStrongsNumberORforCrossRef() {
        /* ||||||||||||||||||||||||||||||||||||||||||||||| */
        /* || FOR WHEN IT IS CALLED FROM A CONTEXT-MENU || */
        /* ||||||||||||||||||||||||||||||||||||||||||||||| */
        if (e.target.closest('.context_menu')) {
            parentIsContextMenu = 1;
            prev_contextmenu=context_menu.cloneNode(true);
            oldcMenuHeight = context_menu.offsetHeight;

            /* Store the old cmenu to go back to it */
            currentContextMenu_style = context_menu.getAttribute('style');
            cmenu_cmt_dX = context_menu.querySelector('.cmtitlebar').getAttribute('data-x');
            cmenu_cmt_dY = context_menu.querySelector('.cmtitlebar').getAttribute('data-y');
            cmenu_dX = context_menu.getAttribute('data-x');
            cmenu_dY = context_menu.getAttribute('data-y');

            /* For contextMenu whose parent was contextMenu:
            In case it is one that is called from the array
            and there are other saved cmenus in the array */
            if(typeof prv_cmenuIndx === 'number'){
                // cmenu_backwards_navigation_arr.splice(prv_cmenuIndx+1,0,prev_contextmenu);
                cmenu_backwards_navigation_arr.splice(prv_cmenuIndx + 1, 0, {
                    menu: prev_contextmenu,
                    scrollTop: context_menu.scrollTop
                });
                cmenu_backwards_navigation_arr.length=prv_cmenuIndx+2;
                prv_indx=`indx="${prv_cmenuIndx+1}"`;
                dzabled='';
            }
            else {
                // cmenu_backwards_navigation_arr.push(prev_contextmenu);
                cmenu_backwards_navigation_arr.push({
                    menu: prev_contextmenu,
                    scrollTop: context_menu.scrollTop
                });
                prv_indx=`indx="${cmenu_backwards_navigation_arr.length-1}"`;
                dzabled='';
                if(context_menu.matches('[strnum]')){
                    let codeChildren = context_menu.querySelectorAll('.cmtitlebar code');
                    let numOfStrnums=1;
                    let divider=''
                    for(let i=0;i<codeChildren.length;i++){
                        let codetxt=codeChildren[i].childNodes;
                        for(let i=0;i<codetxt.length;i++){
                            if(codetxt[i].nodeType==3){
                                if (numOfStrnums>1) {divider=' || '}
                                numOfStrnums+=1
                                prv_title+=`${divider}${codetxt[i].wholeText}`;
                            }
                        }
                    }
                    prv_title=`title="${prv_title}"`;
                } else {
                    let codeChildren = context_menu.querySelector('.cmtitlebar, .cmtitlebar code').childNodes;
                    for(let i=0;i<codeChildren.length;i++){
                        let codetxt=codeChildren[i];
                        if(codetxt.nodeType==3){
                            prv_title=`title="${codetxt.wholeText}"`;
                            break
                        }    
                    }
                }  
            }
        }
        else {
            context_menu.style.visibility = "hidden";
            context_menu.style.transform = '';// In case it has been dragged, reset its transform
            //context_menu.classList.remove('showingXref')//if disabled, will show .crfnnote_btns once it was displayed in any .context_menu until it is hidden again
        }
        /* |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| */
        /* || If eTraget is a [Translated Strongs Word] or the [Strongs Number] itself || */
        /* |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| */
        if (e.target.matches('.translated, .strnum')) {
            // On Mobile Devices
            if (isMobileDevice && contextMenu_touch!="touchstart") {
                // remove windows selection
                // (because on mobile, the user has to press and hold for contextmenu which also selects the text)
                window.getSelection().removeRange(window.getSelection().getRangeAt(0))
            }
            if (e.target.getAttribute("translation")) {
                originalWord = e.target.getAttribute("translation");
                if (truexlit = e.target.getAttribute("data-true-xlit")) {
                    if (elmAhasElmOfClassBasAncestor(e.target, 'rtl')) {
                        originalWord = `“${originalWord.trim()} : ”${truexlit}`;
                    } //because of the direction of the text
                    else {
                        originalWord = `“${originalWord.trim()}” : ${truexlit}`;
                    }
                    addquotes = false;
                }
            } else {
                originalWord = e.target.parentElement.getAttribute("translation");
            }
            
            // If the traget is a strong's number
            if (e.target.getAttribute('strnum')) {
                rightClickedElm = e.target;
                firstShadowColorOfElem = getBoxShadowColor(rightClickedElm);
                await getCurrentStrongsDef(e);
            }
            let menu_inner;
            let arrOfStrnums = e.target.getAttribute('strnum').split(' ');
            let searchicon = document.body.matches('.darkmode') ? 'search-svgrepo-com(2)-DarkMode.svg' : 'search-svgrepo-com(2).svg';
            let copyicon = document.body.matches('.darkmode') ? 'copy-svgrepo-com-DarkMode.svg' : 'copy-svgrepo-com.svg';                               

            if (originalWord) {
                let xlitNlemma = '',br = '';
                for (let i = 0; i < arrOfStrnums.length; i++) {
                    br = '', st = '';
                    if(i==arrOfStrnums.length-1){br = '<br>'}
                    let sn = arrOfStrnums[i];
                    let _srchBtn='';/* <img src="images/${searchicon}" alt="&#128270;"></button> */
                    if(!/[GHgh]\d+/.test(sn)){continue}
                    let srchBtn = `<button class="cmenusrchbtn" onmouseup="searchInputsValueChange(event,'${sn}')">${_srchBtn}<button class="cmenucopyhbtn" onmouseup="api.copyTextSelection('(${getsStrongsLemmanNxLit(sn).lemma}, ${getsStrongsLemmanNxLit(sn).xlit}, ${sn})')"></button>`;                                
                    xlitNlemma = `${xlitNlemma}${br}<code>${srchBtn}${getsStrongsLemmanNxLit(sn).lemma} (${getsStrongsLemmanNxLit(sn).xlit}, ${sn})</code>`
                }
                if (addquotes) {
                    menu_inner = `${xlitNlemma}<hr>“${originalWord.trim()}”`;
                } else {
                    menu_inner = `${xlitNlemma}<hr>${originalWord.trim()}`;
                }
                context_menu.innerHTML = `<div class="cmtitlebar">${menu_inner}<div class="cmenu_navnclose_btns"><button class="cmenu_tsk ${cmenu_tsk_display}" onclick="toggleCMenuTSK(this)">TSK</button><button class="prv" ${prv_indx} ${prv_title} onclick="cmenu_goBackFront(this)" ${dzabled}></button><button class="nxt" onclick="cmenu_goBackFront(this)" disabled></button><button class="middle_cmenu" onclick="document.body.classList.toggle('middleContextMenu')"></button><button class="fillscreen_btn" onclick="toggleCMenu_fillscreen(this.closest('#context_menu'))"></button><button class="closebtn cmenu_closebtn" onclick="hideRightClickContextMenu(this)" title="[Escape]"></button></div></div>${newStrongsDef}`;
                // console.log('01');
            } else if ([contextMenu_touch].includes(e.type) /*|| (e.type=='click' && document.body.matches('.node_graph, body:has(#bibleNodesHeader)'))*/) { // For strongs number in verseNote
                let _img=``;// `<img src="images/${searchicon}" alt="&#128270;">`;
                let _srchBtn = '';// `<button class="cmenusrchbtn" onmouseup="searchInputsValueChange(event,'${arrOfStrnums}')">${_img}</button>`
                let srchBtn = `<code>${_srchBtn}<button class="cmenucopyhbtn" onmouseup="api.copyTextSelection('(${getsStrongsLemmanNxLit(arrOfStrnums).lemma}, ${getsStrongsLemmanNxLit(arrOfStrnums).xlit}, ${arrOfStrnums})')"></button>${arrOfStrnums} (${getsStrongsLemmanNxLit(arrOfStrnums).lemma}, ${getsStrongsLemmanNxLit(arrOfStrnums).xlit})</code>`;
                context_menu.innerHTML = `<div class="cmtitlebar">${srchBtn}<div class="cmenu_navnclose_btns"><button class="cmenu_tsk ${cmenu_tsk_display}" onclick="toggleCMenuTSK(this)">TSK</button><button class="prv" ${prv_indx} ${prv_title} onclick="cmenu_goBackFront(this)" ${dzabled}></button><button class="nxt" onclick="cmenu_goBackFront(this)" disabled></button><button class="middle_cmenu" onclick="document.body.classList.toggle('middleContextMenu')"></button><button class="fillscreen_btn" onclick="toggleCMenu_fillscreen(this.closest('#context_menu'))"></button><button class="closebtn cmenu_closebtn" onclick="hideRightClickContextMenu(this)" title="[Escape]"></button></div></div>${newStrongsDef}</div>`;
            }
            if (strnum = e.target.getAttribute('strnum')) {
                context_menu.setAttribute('strnum', strnum);
                context_menu.innerHTML += `<div class="bottombar" style="width: 100%;"><div class="cmenu_navnclose_btns"><button class="cmenu_tsk ${cmenu_tsk_display}" onclick="toggleCMenuTSK(this)">TSK</button><button class="prv" ${prv_indx} ${prv_title} onclick="cmenu_goBackFront(this)" ${dzabled}></button><button class="nxt" onclick="cmenu_goBackFront(this)" disabled></button><button class="middle_cmenu" onclick="document.body.classList.toggle('middleContextMenu')"></button><button class="fillscreen_btn" onclick="toggleCMenu_fillscreen(this.closest('#context_menu'))"></button><button class="closebtn cmenu_closebtn" onclick="hideRightClickContextMenu(this)" title="[Escape]"></button></div>`
            } else {
                context_menu.removeAttribute('strnum')
            }
        }
    
        /* ||||||||||||||||||||||||||||||||||||||||| */
        /* || If eTarget is a Scripture Reference || */
        /* ||||||||||||||||||||||||||||||||||||||||| */
        else {
            let selectedRefs = await getAllRefsInHighlight(e, ` :is(.crossrefs>span, span[ref])`);//for multiple refs selected with highlight
            
            let vHolder = new DocumentFragment();
            cmenu_tsk_display="";
            context_menu.innerText = null;
            context_menu.classList.add('win2');

            if (selectedRefs) {
                for (let i = 0; i < selectedRefs.length; i++) {
                    const et = selectedRefs[i];
                    await putRefInVerseSection(et, vHolder, i);
                }
            } else {
                // vHolder = await getCrossReference(e.target);//Without head
                await putRefInVerseSection(e.target, vHolder);
            }

            async function putRefInVerseSection(et, vHolder, collapseVerse) {
                const refSectionHeading = createNewElement('h4',`${collapseVerse?'.hidingsibs':null}`);
                const etRefAttrb = et.getAttribute('ref');
                const etInnrTxt = etRefAttrb ? breakDownRef(etRefAttrb)?.shortBknFullRef : breakDownRef(et.innerText.trim())?.shortBknFullRef;
                refSectionHeading.innerText = etInnrTxt;
                const vsect_class = etInnrTxt.replace(/(.*)/g, '_$1').replace(/[.:,\s]+/g, '_');
                const verses_section = createNewElement('div', '.verses_section', `.${vsect_class}`, `${collapseVerse?'.hidby_H4':null}`);
                // verses_section.classList.add(vsect_class);
                vHolder.append(refSectionHeading);
                verses_section.append(await getCrossReference(et));
                vHolder.append(verses_section);
            }
            
            if (e.target.matches('.crossrefs>span, span[ref]')) {
                let cmtitlebar = document.createElement('div');
                cmtitlebar.classList.add('cmtitlebar');
                let cmtitletext;
                if (selectedRefs) {
                    let cmtt = '';
                    for (let i = 0; i < selectedRefs.length; i++) {
                        const et = selectedRefs[i];
                        cmentRefTitle(et);
                        cmtitletext = i+1 < selectedRefs.length ? cmtitletext + '; ' : cmtitletext;
                        cmtt += breakDownRef(cmtitletext).shortBknFullRef.replace(/([,-])\s*/g,'$1');
                    }
                    cmtitletext = cmtt.replace(/;\s*/g,'; ');
                }
                else {cmentRefTitle(e.target);}

                function cmentRefTitle(et) {
                    if (bkn = et.getAttribute('bkn')) {
                        cmtitletext = bkn + ' ' + et.innerText;
                    } else {
                        cmtitletext = et.hasAttribute('ref') ? et.getAttribute('ref') : et.innerText;
                    }
                    cmtitletext = breakDownRef(cmtitletext).shortBknFullRef;
                }
                
                cmtitletext = `<div class="refholder">${cmtitletext} [${bversionName}]</div>`;
                cmtitlebar.innerHTML = cmtitletext + `<div class="cmenu_navnclose_btns"><button class="prv_verse" onclick="cmenuprvNxtverse(event, 'prev')"></button><button class="nxt_verse" onclick="cmenuprvNxtverse(event, 'next')"></button><button class="cmenu_tsk ${cmenu_tsk_display}" onclick="toggleCMenuTSK(this)">TSK</button><button class="prv" ${prv_indx} ${prv_title} onclick="cmenu_goBackFront(this)" ${dzabled}></button><button class="nxt" onclick="cmenu_goBackFront(this)" disabled></button><button class="middle_cmenu" onclick="document.body.classList.toggle('middleContextMenu')"></button><button class="fillscreen_btn" onclick="toggleCMenu_fillscreen(this.closest('#context_menu'))"></button><button class="closebtn cmenu_closebtn" onclick="hideRightClickContextMenu(this)" title="[Escape]"></button></div></div>`;
                context_menu.append(cmtitlebar);
            }
            
            /* FOR CROSS-REFS & NOTES IN SEARCH WINDOW */
            vHolder.querySelectorAll('span.verse').forEach(spanVerse => {
                let tskHolder=crfnnote_DIV(spanVerse);
                context_menu.matches('.showingXref') ? null : tskHolder.classList.add('displaynone');
                spanVerse.append(tskHolder);
            });
            
            context_menu.append(vHolder);
            // context_menu.append(getCrossReference(e.target));
            if (strnum = e.target.getAttribute('strnum')) {
                context_menu.setAttribute('strnum', strnum);
            } else {
                context_menu.removeAttribute('strnum');
                context_menu.innerHTML += `<div class="bottombar" style="width: 100%;"><div class="cmenu_navnclose_btns"><button class="prv_verse" onclick="cmenuprvNxtverse(event, 'prev')"></button><button class="nxt_verse" onclick="cmenuprvNxtverse(event, 'next')"></button><button class="cmenu_tsk ${cmenu_tsk_display}" onclick="toggleCMenuTSK(this)">TSK</button><button class="prv" ${prv_indx} ${prv_title} onclick="cmenu_goBackFront(this)" ${dzabled}></button><button class="nxt" onclick="cmenu_goBackFront(this)" disabled></button><button class="middle_cmenu" onclick="document.body.classList.toggle('middleContextMenu')"></button><button class="fillscreen_btn" onclick="toggleCMenu_fillscreen(this.closest('#context_menu'))"></button><button class="closebtn cmenu_closebtn" onclick="hideRightClickContextMenu(this)" title="[Escape]"></button></div></div></div>`;
            }
            transliterateAllStoredWords()
            // Indicate If Verse Has Note (Must be the last operation on verse so that it is not changed before it is updated)
            let cmenuVerses = context_menu.querySelectorAll('span.verse')
            for (const spanVerse of cmenuVerses) {
                const [bN, bC, cV] = spanVerse.querySelector('[ref]').getAttribute('ref').split(/[(?<=\s)(?<=:)](?=\d)/);
                // checkAndIndicateThatVerseHasNote(bN,bC,cV,spanVerse).notes;// Check if Verse Has Note; // VerseNotes are not available
            };
        }
    }
    async function appendORpositionContextMenu() {
        if (currentContextMenu_style) { return; }
        if (!e.target.matches('#context_menu, #context_menu *')) {
            let menuWidth = cmenuWidthHeigh_b4_FillScreen.width;
            let menuHeight = cmenuWidthHeigh_b4_FillScreen.height;
            menuWidth = menuWidth ? menuWidth : context_menu.offsetWidth;
            menuHeight = menuHeight ? menuHeight : context_menu.offsetHeight;
            const windowHeight = document.documentElement.clientHeight;
            const windowWidth = document.documentElement.clientWidth;

            // Reduce height/width greater than that of the window
            if (menuHeight >= windowHeight) {
                menuHeight = windowHeight - 20;
                context_menu.style.height = menuHeight + 'px';
            }
            if (menuWidth >= windowWidth) {
                menuWidth = windowWidth - 20;
                context_menu.style.width = menuWidth + 'px';
            }
            positionContextMenu(e, menuWidth, menuHeight);
        }
    }
    
    function positionContextMenu(event, menuWidth, menuHeight) {
        const clickedElement = event.target;
        const rect = getClickedClientRect(clickedElement, event)?.rect;
        
        // Use viewport-relative coordinates from getBoundingClientRect
        const elementTop = rect.top;
        const elementLeft = rect.left;
        const elementBottom = rect.bottom;
        const elementRight = rect.right;
        const elementWidth = rect.width;
        
        const windowHeight = document.documentElement.clientHeight;
        const windowWidth = document.documentElement.clientWidth;
        const scrollBarWidth = window.innerWidth - windowWidth;
        const scrollBarHeight = window.innerHeight - windowHeight;
        
        // Calculate available space
        const spaceBelow = windowHeight - elementBottom;
        const spaceAbove = elementTop;
        const spaceRight = windowWidth - elementLeft; // Space from LEFT edge of element
        const spaceLeft = elementRight; // Space from RIGHT edge of element
        
        // Determine vertical position
        let top;
        if (spaceBelow >= menuHeight + 10) {
            // Position below the element
            top = elementBottom + window.scrollY;
        } else if (spaceAbove >= menuHeight + 10) {
            // Position above the element
            top = elementTop + window.scrollY - menuHeight;
        } else {
            // Not enough space above or below, position below anyway
            top = elementBottom + window.scrollY;
            
            // If menu would extend beyond viewport, adjust height and position
            const availableHeight = Math.max(spaceBelow, spaceAbove) - 10;
            if (menuHeight > availableHeight) {
                context_menu.style.height = availableHeight + 'px';
                if (spaceAbove > spaceBelow) {
                    top = elementTop + window.scrollY - availableHeight;
                }
            }
        }
                
        // ✅ FIXED: Determine horizontal position
        let left;
        
        // Default: align menu's LEFT edge with element's LEFT edge
        if (spaceRight >= menuWidth + 10) {
            // Enough space to the right - start from left edge of target
            left = elementLeft + window.scrollX;
        } 
        // If not enough space to the right, try aligning menu's RIGHT edge with element's RIGHT edge
        else if (spaceLeft >= menuWidth + 10) {
            // Enough space to the left - align right edges
            left = elementRight + window.scrollX - menuWidth;
        } 
        // If neither works, position to avoid viewport overflow
        else {
            // Not enough space on either side
            // Try to keep some part visible, prefer right side
            if (spaceRight > spaceLeft) {
                // More space on right, align left
                left = elementLeft + window.scrollX;
            } else {
                // More space on left, align right
                left = elementRight + window.scrollX - menuWidth;
            }
            
            // Ensure menu doesn't overflow viewport
            const maxLeft = windowWidth - menuWidth - scrollBarWidth + window.scrollX;
            left = Math.max(10 + window.scrollX, Math.min(left, maxLeft));
        }
        
        // Apply the calculated position
        context_menu.style.top = Math.max(0, top) + 'px';
        context_menu.style.left = Math.max(0, left) + 'px';
        context_menu.style.position = 'absolute';
        context_menu.style.visibility = 'visible';
        
        // Handle special cases (shift key, middle click, fill screen)        
        if (event.ctrlKey || event.shiftKey || event.button == 1 || fill_screen || (event.buttons & 1) || cmenu_filling_screen) {
            event.preventDefault();
            context_menu.classList.add('fillscreen');
        }
    }
    function addContextMenuStyleToHead(w=450,h=400) {
        const lightCityReftaggerContextMenuStyleInHead = document.createElement('style');
        lightCityReftaggerContextMenuStyleInHead.id='lightCityReftaggerContextMenuStyleInHead';
        lightCityReftaggerContextMenuStyleInHead.textContent = `.context_menu {
            display: none;
            position: absolute!important;
            padding: 0;
            margin: 0;
            max-width: ${w}px!important;
            max-height: ${h}px!important;
            background-color: #fff;
            border: 1px solid #ccc;
            box-shadow:-1px -1px 2px 0px black, 1px 5px 6px -3px black!important;
            overflow-y:auto;
            z-index: 100!important;
            transition:all 0.1s ease-in-out;
            transition: transform 0;
          }
          @media only screen and (max-width: 414px){
              .context_menu{ 
                  max-width: ${w-100}px!important;
                  max-height: ${h-100}px!important;
                  min-width: 300px!important;
                }
            }
        //     @media only screen and (min-width: 650px) and (max-width: 960px){
        //       .context_menu{ 
        //       max-width: ${w+150}px!important;
        //       max-height: ${h+150}px!important;
        //   }}
          .cmenusrchbtn {display:none!important;}
          span.verse {display:block}
          .darkmode .context_menu {
              background-color: var(--darkmode-bg1color)!important;
          }
          .strngsdefinition :is(h1,h2,h3,h4,h5,h6) {
              display: flex;
              box-shadow: none!important;
              border-radius: 0px!important;
          }
          .strngsdefinition summary :is(h1,h2,h3,h4,h5,h6)::before {
              content:''!important;
          }
          #cmenu_navnclose_btns {
              margin-right: -5px;
              font-size:12px;
          }
          #context_menu[strnum] #cmenu_navnclose_btns {
              margin-right: -20px;
          }
          #cmenu_navnclose_btns button {
              height: 1.2em;
              width: 1.2em;
          }
          #cmenu_navnclose_btns button.prv {
              background:url(../images/arrow-up-svgrepo-com.svg) center no-repeat;
              transform:rotate(-90deg);
              margin-left:2px;
              box-shadow:-1px -1px 1px var(--shadow-color);
          }
          #cmenu_navnclose_btns button.prv_verse {
              background:url(../images/arrow-up-svgrepo-com.svg) center no-repeat;
              margin-left:2px;
              box-shadow:1px 1px 1px var(--shadow-color);
          }
          #cmenu_navnclose_btns button.nxt_verse {
              background:url(../images/arrow-up-svgrepo-com.svg) center no-repeat;
              transform:rotate(-180deg);
              margin-left:1px;
              box-shadow:-1px -1px 1px var(--shadow-color);
          }
          .verse:not(.v_accented) .eng2grk::after {
              content: attr(translation);
              font-size: 75%;
              line-height: 0;
              position: relative;
              vertical-align: baseline;
              top: -0.5em;
              font-style: italic;
              color: crimson;
          }
          #cmenu_navnclose_btns button.nxt {
            transform:rotate(-90deg) scaleY(-1);
         }
          `;
        document.head.append(lightCityReftaggerContextMenuStyleInHead);
    }
    
    if (newCmenu){cmenu_backwards_navigation_arr=[]}
    if (parentIsContextMenu) {
        context_menu.setAttribute('style',currentContextMenu_style);            
        context_menu.querySelector('.cmtitlebar').setAttribute('data-x',cmenu_cmt_dX);
        context_menu.querySelector('.cmtitlebar').setAttribute('data-y',cmenu_cmt_dY);
        context_menu.querySelector('.bottombar').setAttribute('data-x',cmenu_cmt_dX);
        context_menu.querySelector('.bottombar').setAttribute('data-y',cmenu_cmt_dY);
        context_menu.setAttribute('data-y',cmenu_dX);
        context_menu.setAttribute('data-x',cmenu_dY);
        if(cm_dtl = context_menu.querySelector('details')){cm_dtl.open = true;}
    }
    // Remove ContextMenu Eventlistner
    enableInteractJSonEl('.cmtitlebar', context_menu);
    enableInteractJSonEl('.bottombar', context_menu);
    context_menu.addEventListener('mouseenter', add_cMenuNavigationByKeys);
    context_menu.addEventListener('mouseleave', remove_cMenuNavigationByKeys);
    
    /* For Height Animation */
    oldcMenuHeight?cmenuChangeOfHeightAnimation(oldcMenuHeight):null;
    /* Temporary solution for the top of cmenu being off visible area */
    setTimeout(() => {
        const elementRect = context_menu.getBoundingClientRect();
        const isInView = (elementRect.top >= 0 && elementRect.bottom <= (window.innerHeight || document.documentElement.clientHeight));
        if (!isInView) {context_menu.scrollIntoView({ behavior: 'smooth', block:'nearest'})}
    }, 500);
}

function cmenuChangeOfHeightAnimation(oldcMenuHeight) {
    let newcMenuHeight = context_menu.getBoundingClientRect().height;
    context_menu.style.height = `${oldcMenuHeight}px`;
    let bottombar = context_menu.querySelector('.bottombar');
    // bottombar.style.marginTop = `${oldcMenuHeight - 15}px`;
    distanceToAncestorBottom(bottombar,context_menu)>5?bottombar.style.position='absolute':null;
    document.body.style.pointerEvents='none';
    setTimeout(() => {
        // bottombar.style.marginTop = '0px';
        context_menu.style.height = `${newcMenuHeight}px`;
        setTimeout(() => { bottombar.style.position = ''; }, 310);
        setTimeout(() => {context_menu.style.height = '';}, 310);
        setTimeout(() => {document.body.style.pointerEvents='';}, 330);
    }, 100);
}
function cmenuprvNxtverse(e, prvNxt) {
    let oldcMenuHeight = context_menu.getBoundingClientRect().height;
    cmenu_goToPrevOrNextVerse(prvNxt,undefined,e.shiftKey,e.target);
    cmenuChangeOfHeightAnimation(oldcMenuHeight)
}

function mainBibleVersion(e){
    if(e.target.matches('button.compare_withinsearchresult_button')){
        bversionName = e.target.getAttribute('b_version');
        loadVersion(bversionName)
        localStorage.setItem('bversionName',bversionName);
    }
}
function hideRightClickContextMenu(dis) {if(_cm = document.querySelector('#context_menu')){contextMenu_Remove({'type':'click','key':'Escape','target':dis})}}
function contextMenu_Remove(e) {
    // Do not remove in these cases
    if ((e.target.closest('#context_menu') && !e.target.closest('.closebtn, .cmenu_closebtn')) || e.target.matches(`:is(.verse,.verse_compare) .cmenu_closebtn, .crossrefs span:not(.context_menu .crossrefs span), #pageEditNsaveBtns, #pageEditNsaveBtns *`) || (e.type !== 'click' && e.key !== 'Escape') ||(e.key === 'Escape' && document.querySelector('#pageEditNsaveBtns'))) { return; }

    const cm = document.getElementById('context_menu');

	// Exit fullscreen first
    if (cm && cm.classList.contains('fillscreen') && e.key === 'Escape') {
        cmenu_filling_screen = cm.classList.contains('fillscreen');
        cm.classList.remove('fillscreen');
        if (e.type=='keydown') {cmenu_filling_screen = false;}
        return;
    }

    // Remove context menu
    if ( cm && ( e.key === 'Escape' || ( e.type === 'click' && ( e.target.matches('.cmenu_navnclose_btns .cmenu_closebtn') || !e.target.closest('#context_menu'))))) {
        showingXref = cm.classList.contains('showingXref');
        localStorage.setItem('showingXref', showingXref);
        cm.remove();
        context_menu = null;
        cmenuWidthHeigh_b4_FillScreen = {};
        remove_cMenuNavigationByKeys();
    }
}
function add_cMenuNavigationByKeys(e) {
    remove_cMenuNavigationByKeys(e)
    e.target.classList.add('keydownready')
    document.addEventListener('keydown', cMenuNavigationByKeys);
}
function remove_cMenuNavigationByKeys(e) {
    e?.target?.classList.remove('keydownready')
    document.removeEventListener('keydown', cMenuNavigationByKeys);
}
function cMenuNavigationByKeys(e) {
    cmenu_navnclose_btns = typeof context_menu != 'undefined' ? context_menu.querySelector('.cmenu_navnclose_btns'): null;
    if (!cmenu_navnclose_btns) {return}
    let key_code = e.key || e.keyCode || e.which;
    switch (key_code) {
        case 'ArrowLeft'||37: //left arrow key
            const previous = cmenu_navnclose_btns.querySelector('.prv');
            if(!previous.disabled){
                cmenu_goBackFront(previous);
                e.preventDefault();
            }
            break;
        case 'ArrowRight'||39: //right arrow key
            const next = cmenu_navnclose_btns.querySelector('.nxt');
            if(!next.disabled){
                cmenu_goBackFront(next);
                e.preventDefault();
            }
            break;
        case (e.altKey && ('ArrowUp'||38)) || (!e.ctrlKey && '-'): //Up arrow key
            if(cmenu_navnclose_btns.querySelector('.prv_verse')){
                cmenu_goToPrevOrNextVerse('prev',undefined,e.shiftKey);
                e.preventDefault();
            }
            break;
        case (e.altKey && ('ArrowDown'||40)) || (!e.ctrlKey && '+'): //down arrow key
            if(cmenu_navnclose_btns.querySelector('.nxt_verse')){
                cmenu_goToPrevOrNextVerse('next',undefined,e.shiftKey);
                e.preventDefault();
            }
            break;
        case 'x'||88: //x key
            if(cmenu_tsk = cmenu_navnclose_btns.querySelector('.cmenu_tsk')){
                toggleCMenuTSK(cmenu_tsk);
                e.preventDefault();
            }
            break;
    }
}
function getClickedClientRect(elm, e) {
    const rects = elm.getClientRects();
    const {clientX,clientY} = e;
    const elm_bcRect = elm.getBoundingClientRect();
    const elmOffsetLeft = elm.offsetLeft - (rects[0].left - elm_bcRect.left);//because offsetLeft will for inline element is the offsetLeft of the first rect
    const elmOffsetTop = elm.offsetTop - (rects[0].top - elm_bcRect.top);//because offsetTop will for inline element is the offsetTop of the first rect

    for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        if (rects.length==1 || (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom)) {
            //Get Offsets
            const Left = elmOffsetLeft + (rect.left - elm_bcRect.left);
            const Top = elmOffsetTop + (rect.top - elm_bcRect.top);
            return {Left,Top,'left':Left,'top':Top,'width':rect.width,'height':rect.height,'Width':rect.width,'Height':rect.height,rect}
        }
    }
    const rect = elm_bcRect;
    return {'Left':rect.left,'Top':rect.top,'left':elmOffsetLeft,'top':elmOffsetTop,'width':rect.width,'height':rect.height,'Width':rect.width,'Height':rect.height,rect};
}

/* AUTO CONTEXT_MENU FILL SCREEN */
document.addEventListener('mouseup',function(e){if (e.button == 1) {contextMenu_CreateNAppend(e); document.body.classList.add('middleContextMenu')}});
(function setupMouseComboListener() {
  let state = {
    leftDown: false,
    rightDown: false
  };

  function onMouseDown(e) {
    if (e.button === 0) state.leftDown = true;
    if (e.button === 2) state.rightDown = true;
  }

  function onMouseUp(e) {
    if (e.button === 2) {
        if (state.leftDown && state.rightDown) {
            if(!e.target.closest('.context_menu')){
                contextMenu_CreateNAppend(e,true);
            }
            else if(e.target.closest('.context_menu:not(.fillscreen)')){
                context_menu.classList.add('fillscreen');
            }
      }
      state.rightDown = false;
    }

    if (e.button === 0) {
      state.leftDown = false;
    }
  }
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('contextmenu', e => e.preventDefault()); // optional
})();
/* ***** *********************** ***** */
/* ***** GENERAL BIBLE DATA CODE ***** */
/* ***** *********************** ***** */
const bible = bibleData();
function bibleData() {
    const bible = {};
    bible.Data = {};
    bible.Data.books = [
    ["GENESIS","GEN","GE","GN"],
    ["EXODUS","EXO","EX","EXOD"],
    ["LEVITICUS","LEV","LE","LV"],
    ["NUMBERS","NUM","NU","NM","NB"],
    ["DEUTERONOMY","DEUT","DEU","DT","DE"],
    ["JOSHUA","JOSH","JOS","JSH"],
    ["JUDGES","JDG","JUDGE","JUDG","JG","JDGS"],
    ["RUTH","RTH","RU","RUT"],
    ["I SAMUEL","1SAM","1 SAMUEL","1SAMUEL","1ST SAMUEL","FIRST SAMUEL","1 SAM","1 SA","1S","I SA","1 SM","1SA","I SAM"],
    ["II SAMUEL","2SAM","2 SAMUEL","2SAMUEL","2ND SAMUEL","SECOND SAMUEL","2 SAM","2 SA","2S","II SA","2 SM","2SA","II SAM"],
    ["I KINGS","1KIN","1 KGS","1 KI","1K","I KGS","1KGS","I KI","1KI","I KING","1KINGS","1 KINGS","1 KING","1 KIN","1ST KGS","1ST KINGS","FIRST KINGS","FIRST KGS"],
    ["II KINGS","2KIN","2 KGS","2 KI","2K","II KGS","2KGS","II KI","2KI","II KING","2KINGS","2 KINGS","2 KING","2 KIN","2ND KGS","2ND KINGS","SECOND KINGS","SECOND KGS"],
    ["I CHRONICLES","1CHR","1 CHRON","1 CH","I CH","1CH","1 CHR","I CHR","1 CHR","I CHRON","1CHRON","1CHRONICLES","1 CHRONICLES","1ST CHRONICLES","FIRST CHRONICLES"],
    ["II CHRONICLES","2CHR","2 CHRON","2 CH","II CH","2CH","II CHR","2 CHR","II CHRON","2CHRON","2CHRONICLES","2 CHRONICLES","2ND CHRONICLES","SECOND CHRONICLES"],
    ["EZRA","EZR","EZA"],
    ["NEHEMIAH","NEH","NE"],
    ["ESTHER","EST","ESTH","ES"],
    ["JOB","JOB","JB"],
    ["PSALMS","PSA","PSALM","PSAL","PSLM","PS","PSM","PSS"],
    ["PROVERBS","PRO","PROV","PR","PRV"],
    ["ECCLESIASTES","ECC","ECCL","ECCLES","EC","QOH","QOHELETH"],
    ["SONG OF SOLOMON","SON","SOS","SONG OF SONGS","SONG","SO","CANTICLE OF CANTICLES","CANTICLES"],
    ["ISAIAH","ISA","IS"],
    ["JEREMIAH","JER","JERE","JE","JR"],
    ["LAMENTATIONS","LAM","LAMENTATION","LA"],
    ["EZEKIEL","EZE","EZEK","EZK","EZ"],
    ["DANIEL","DAN","DA","DN"],
    ["HOSEA","HOS","HO","HOSHEA"],
    ["JOEL","JOE","JL"],
    ["AMOS","AMO","AM"],
    ["OBADIAH","OBA","OBAD","OB"],
    ["JONAH","JON","JONA","JNH"],
    ["MICAH","MIC","MICA"],
    ["NAHUM","NAH","NAHU","NA"],
    ["HABAKKUK","HAB","HBK","HABA","HABAK"],
    ["ZEPHANIAH","ZEPH","ZEP","ZP"],
    ["HAGGAI","HAG","HAGG","HG"],
    ["ZECHARIAH","ZEC","ZECH","ZC"],
    ["MALACHI","MAL","MALA","ML","MLC","MALAC"],
    ["MATTHEW","MAT","MATHEW","MATT","MT"],
    ["MARK","MAR","MRK","MK","MR"],
    ["LUKE","LUK","LK","LU"],
    ["JOHN","JOH","JH","JN","JHN"],
    ["ACTS","ACT","AC"],
    ["ROMANS","ROM","RO","RM"],
    ["I CORINTHIANS","1COR","1CO","1 CO","I CO","I COR","1 COR","1CORINTHIANS","1 CORINTHIANS","1ST CORINTHIANS","FIRST CORINTHIANS"],
    ["II CORINTHIANS","2COR","2CO","2 COR","2 CO","II CO","II COR","2CORINTHIANS","2 CORINTHIANS","2 CORINTHIANS","2ND CORINTHIANS","SECOND CORINTHIANS"],
    ["GALATIANS","GAL","GA","GALATIAN"],
    ["EPHESIANS","EPH","EPHESIAN","EPHES"],
    ["PHILIPPIANS","PHP","PHILIP","PHILP","PHILI","PHIL"],
    ["COLOSSIANS","COL","COLO","COLOS"],
    ["I THESSALONIANS","1TH","1THE","1THES","1 TH","1 THE","1 THESS","I TH","I THE","I THES","I THESS","1THESS","1THESSALONIANS","1 THESSALONIANS","1ST THESSALONIANS","FIRST THESSALONIANS"],
    ["II THESSALONIANS","2TH","2THE","2THES","2 TH","2 THE","2 THESS","II TH","II THE","II THES","II THESS","2THESS","2THESSALONIANS","2 THESSALONIANS","2ND THESSALONIANS","SECOND THESSALONIANS"],
    ["I TIMOTHY","1TI","1TIM","1 TIM","1 TI","I TI","I TIM","1TIMOTHY","1 TIMOTHY","1ST TIMOTHY","FIRST TIMOTHY"],
    ["II TIMOTHY","2TI","2TIM","2 TIM","2 TI","II TI","II TIM","2TIMOTHY","2 TIMOTHY","2ND TIMOTHY","SECOND TIMOTHY"],
    ["TITUS","TIT","TITU"],
    ["PHILEMON","PHM","PHILE","PHILEM","PHILM","PHLM"],
    ["HEBREWS","HEB"],
    ["JAMES","JAM","JAS","JM"],
    ["I PETER","1PE","1PET","1 PET","1 PE","I PE","I PET","I PT","1 PT","1PT","1PETER","1 PETER","1ST PETER","FIRST PETER"],
    ["II PETER","2PE","2PET","2 PET","2 PE","II PE","II PET","II PT","2 PT","2PT","2PETER","2 PETER","2ND PETER","SECOND PETER"],
    ["I JOHN","1JOH","1 JOHN","1 JN","I JN","1JN","1 JH","I JH","1JH","I JO","1JO","I JOH","1 JOH","I JHN","1 JHN","1JHN","1JOHN","1 JOHN","1ST JOHN","FIRST JOHN"],
    ["II JOHN","2JOH","2 JOHN","2 JN","II JN","2JN","2 JH","II JH","2JH","II JO","2JO","II JOH","2 JOH","II JHN","2 JHN","2JHN","2JOHN","2 JOHN","2ND JOHN","SECOND JOHN"],
    ["III JOHN","3JOH","3 JOHN","3 JN","III JN","3JN","3 JH","III JH","3JH","III JO","3JO","III JOH","3 JOH","III JHN","3 JHN","3JHN","3JOHN","3 JOHN","3RD JOHN","THIRD JOHN"],
    ["JUDE","JUD"],
    ["REVELATION","REV","RE","THE REVELATION"],
    // APOCRYPHA
    ["I ESDRAS", "1ES", "1EZ", "1ESD", "1EZD", "I ES", "I EZ", "1ESDR", "1EZDR", "I ESDR", "I EZDR", "1 ESDR", "1EZR", "I EZR", "1 EZR", "1 EZDR", "I ESD", "I EZD", "1 ESDRAS", "1 EZRA", "1ESDRAS", "1EZRA", "FIRST ESDRAS", "FIRST EZRA", "ONE ESDRAS", "ONE EZRA"],
    ["II ESDRAS", "2ES", "2EZ", "2ESD", "2EZD", "II ES", "II EZ", "2ESDR", "2EZDR", "II ESDR", "II EZDR", "2 ESDR", "2EZR", "II EZR", "2 EZR", "2 EZDR", "II ESD", "II EZD", "2 ESDRAS", "2 EZRA", "2ESDRAS", "2EZRA", "SECOND ESDRAS", "SECOND EZRA", "TWO ESDRAS", "TWO EZRA", "ESDRAS", "EZRA APOCALYPSE"],    ["TOBIT", "TOB", "TOBI", "TB", "TBT", "TOBITH"],
    ["JUDITH", "JDT", "JUDT", "JUDI"],
    ["ADDITIONS TO ESTHER", "ADDITIONS TO THE BOOK OF ESTHER", "GREEK ESTHER", "ESTHER ADDITIONS", "EST ADD"],
    ["WISDOM OF SOLOMON", "WISDOM", "WS", "WIS", "BOOK OF WISDOM"],
    ["WISDOM OF JESUS SON OF SIRACH", "SIRACH", "ECCLESIASTICUS", "SIR", "ECLES", "ECLESIASTICUS"],
    ["BARUCH", "BAR"],
    ["LETTER OF JEREMIAH", "EPISTLE OF JEREMIAH", "LETTER TO JEREMIAH", "JEREMIAH LETTER", "LET JER", "EP JER"],
    ["PRAYER OF AZARIAH", "AZARIAH", "PRAYER IN THE FURNACE", "PRAYER OF AZAR", "SONG OF THE THREE", "SONG OF THREE YOUTHS", "SONG OF THREE MEN", "THREE HOLY CHILDREN"],
    ["SUSANNA", "HISTORY OF SUSANNA", "SUS", "STORY OF SUSANNA"],
    ["BEL AND THE DRAGON", "BEL", "BEL & DRAGON", "BEL N DRAGON"],
    ["PRAYER OF MANASSEH", "MANASSEH", "PRAYER OF MAN", "PR MAN"],
    ["I MACCABEES", "1MAC", "1MACC", "1 MAC", "1 MACC", "1MC", "1MCC", "1 MC", "1 MCC", "I MAC", "I MACC", "1 MACCABEES", "1MACCABEES", "FIRST MACCABEES", "ONE MACCABEES"],
    ["II MACCABEES", "2MAC", "2MACC", "2 MAC", "2 MACC", "2MC", "2MCC", "2 MC", "2 MCC", "II MAC", "II MACC", "2 MACCABEES", "2MACCABEES", "SECOND MACCABEES", "TWO MACCABEES"],
    ["III MACCABEES", "3MAC", "3MACC", "3 MAC", "3 MACC", "3MC", "3MCC", "3 MC", "3 MCC", "III MAC", "III MACC", "3 MACCABEES", "3MACCABEES", "THIRD MACCABEES"],
    ["IV MACCABEES", "4MAC", "4MACC", "4 MAC", "4 MACC", "4MC", "4MCC", "4 MC", "4 MCC", "IV MAC", "IV MACC", "4 MACCABEES", "4MACCABEES", "FOURTH MACCABEES"],
    ["PSALM 151", "PS151", "PS 151", "PSALMS 151", "PSALM ONE FIFTY-ONE"]
    ];
    //TODO - use the arrays above
    bible.Data.otBooks = ['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','I Samuel','II Samuel','I Kings','II Kings','I Chronicles','II Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi'];
    bible.Data.ntBooks = ['Matthew','Mark','Luke','John','Acts','Romans','I Corinthians','II Corinthians','Galatians','Ephesians','Philippians','Colossians','I Thessalonians','II Thessalonians','I Timothy','II Timothy','Titus','Philemon','Hebrews','James','I Peter','II Peter','I John','II John','III John','Jude','Revelation'];
    bible.Data.apBooks = ["I Esdras","II Esdras","Tobit","Judith","Additions to Esther","Wisdom of Solomon","Wisdom of Jesus Son of Sirach","Baruch","Letter of Jeremiah","Prayer of Azariah","Susanna","Bel and the Dragon","Prayer of Manasseh","I Maccabees","II Maccabees","III Maccabees","IV Maccabees","Psalm 151"];
    bible.Data.allBooks = bible.Data.otBooks.concat(bible.Data.ntBooks).concat(bible.Data.apBooks);
    bible.Data.bookNamesByLanguage = {
        "en":["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","I Samuel","II Samuel","I Kings","II Kings","I Chronicles","II Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","I Corinthians","II Corinthians","Galatians","Ephesians","Philippians","Colossians","I Thessalonians","II Thessalonians","I Timothy","II Timothy","Titus","Philemon","Hebrews","James","I Peter","II Peter","I John","II John","III John","Jude","Revelation",
        "I Esdras","II Esdras","Tobit","Judith","Additions to Esther","Wisdom of Solomon","Wisdom of Jesus Son of Sirach","Baruch","Letter of Jeremiah","Prayer of Azariah","Susanna","Bel and the Dragon","Prayer of Manasseh","I Maccabees","II Maccabees","III Maccabees","IV Maccabees","Psalm 151"],
        "fa":["پدایش","خروج","لاویان","اعداد","تشنیه","یوشع","داوران","روت","اول سموییل","دوم سموییل","اول پادشاهان","دوم پادشاهان","اول تواریخ","دوم تواریخ","عزرا","نحمیا","استر","ایوب","مزامیر","امثال","جامعه","غزل غزلها","اشعیا","ارمیا","مراثی ارمیا","حزقیال","دانیال","هوشع","یوییل","عاموس","عوبدیا","یونس","میکاه","ناحوم","حبقوق","صفنیا","حخی","زکریا","ملاکی","متی","مرقس","لوقا","یوحنا","اعمال رسولان","رومیان","اول قرنتیان","دوم قرنتیان","علاطیان","افسیان","فلیپیان","کولسیان","اول تسالونیکیان","دوم تسالونیکیان","اول تیموتایوس","دوم تیموتایوس","تیطوس","فلیمون","عبرانیان","یعقوب","اول پطرس","دوم پطرس","اول یحنا","دوم یحنا","سوم یحانا","یهودا","مکاشفه"],
        "fr":["Genèse","Exode","Lévitique","Nombres","Deutéronome","Josué","Juges","Ruth","1 Samuel","2 Samuel","1 Rois","2 Rois","1 Chroniques","2 Chroniques","Esdras","Néhémie","Esther","Job","Psaumes","Proverbes","Ecclésiaste","Cantique des Cantiques","Ésaïe","Jérémie","Lamentations","Ézéchiel","Daniel","Osée","Joël","Amos","Abdias","Jonas","Michée","Nahum","Habacuc","Sophonie","Aggée","Zacharie","Malachie","Matthieu","Marc","Luc","Jean","Actes","Romains","1 Corinthiens","2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens","1 Thessaloniciens","2 Thessaloniciens","1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre","2 Pierre","1 Jean","2 Jean","3 Jean","Jude","Apocalypse"],
        "original":["בראשית","שמות","ויקרא","במדבר","דברים","יהושע","שפטים","רות","שמואל א","שמואל ב","מלכים א","מלכים ב","דברי הימים א","דברי הימים ב","עזרא","נחמיה","אסתר","איוב","תהילים","משלי","קהלת","שיר השירים","ישעה","ירמיה","איכה","יחזקאל","דניאל","הושע","יואל","עמוס","עבדיה","יונה","מיכה","נחום","חבקוק","צפניה","חגי","זכריה","מלאכי","Ματθαίος","Μαρκος","Λουκας","Ιωαννης","Πραξεις","Ρωμαιους","Α Κορινθίους","Β Κορινθίους","Γαλατες","Εφεσιους","Φιλιππησιους","Κολοσσαεις","Α Θεσσαλονικεις","Β Θεσσαλονικεις","Α Τιμοθεο","Β Τιμοθεο","Τιτο","Φιλημονα","Εβραιους","Ιακωβου","Α Πετρου","Β Πετρου","Α Ιωαννη","Β Ιωαννη","Γ Ιωαννη","Ιουδα","Αποκαλυψη του Ιωαννη"],
        'ar':['تكوين','خروج','لاويين','عدد','تثنية','يشوع','قضاة','راعوث','1 صموئيل','2 صموئيل','1 ملوك','2 ملوك','1 اخبار','2 اخبار','عزرا','نحميا','استير','ايوب','مزامير','امثال','جامعة','نشيد الانشاد','اشعياء','ارميا','مراثي','حزقيال','دانيال','هوشع','يوئيل','عاموس','عوبديا','يونان','ميخا','ناحوم','حبقوق','صفنيا','حجى','زكريا','ملاخي','متى','مرقس','لوقا','يوحنا','اعمال','رومية','1 كورنثوس','2 كورنثوس','غلاطية','افسس','فيلبي','كولوسي','1 تسالونيكي','2 تسالونيكي','1 تيموثاوس','2 تيموثاوس','تيطس','فليمون','عبرانيين','يعقوب','1بطرس','2بطرس','1 يوحنا','2 يوحنا','3 يوحنا','يهوذا','رؤيا'],
        'ro':['Geneza','Exodul','Leviticul','Numeri','Deuteronom','Iosua','Judecători','Rut','1 Samuel','2 Samuel','1 Regi','2 Regi','1 Cronici','2 Cronici','Ezra','Neemia','Estera','Iov','Psalmii','Proverbe','Eclesiastul','Cântarea Cântărilor','Isaia','Ieremia','Plângeri','Ezechiel','Daniel','Osea','Ioel','Amos','Obadia','Iona','Mica','Naum','Habacuc','Ţefania','Hagai','Zaharia','Maleahi','Matei','Marcu','Luca','Ioan','Faptele Apostolilor','Romani','1 Corintieni','2 Corintieni','Galateni','Efeseni','Filipeni','Coloseni','1 Tesaloniceni','2 Tesaloniceni','1 Timotei','2 Timotei','Titus','Filimon','Evrei','Iacov','1 Petru','2 Petru','1 Ioan','2 Ioan','3 Ioan','Iuda','Apocalipsa'],
        'hlt':['Suencuek','Sunglatnah','Thothuengnah','Lampahnah','Olrhaep','Joshua','Laitloekkung','Ruth','1 Samuel','2 Samuel','1 Manghai','2 Manghai','1 Khokhuen','2 Khokhuen','Ezra','Nehemiah','Esther','Job','Tingtoeng','Olcueih','Thuituen','Solomon Laa','Isaiah','Jeremiah','Rhaengsae','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malakhi','Matthai','Marku','Luka','Johan','Caeltueih','Rom','1 Khawrin','2 Khawrin','Galati','Ephisa','Philipi','Kolosa','1 Thesalonika','2 Thesalonika','1 Timothy','2 Timothy','Titu','Philimon','Hebru','Jame','1 Peter','2 Peter','1 Johan','2 Johan','3 Johan','Jude','Olphong'],
        'ckb':['پەیدابوون','دەرچوون','لێڤییەکان','سه‌رژمێری','دواوتار','یەشوع','ڕابەران','ڕائووس','یەکەم ساموئێل','دووەم ساموێل','یەکەم پاشایان','دووەم پاشایان','یەکەم پوختەی مێژوو','دووەم پوختەی مێژوو','عەزرا','نەحەمیا','ئەستەر','ئەیوب','زەبوورەکان','پەندەکانی سلێمان','ژیرمه‌ندی','گۆرانی گۆرانییه‌كان','ئیشایا','یه‌رمیا','شینه‌كانی یه‌رمیا','حزقیێل','دانیال','هۆشه‌ع','یۆئێل','ئامۆس','عۆبه‌دیا','یونس','میخا','ناحوم','حه‌به‌قوق','سه‌فه‌نیا','حه‌گه‌ی','زه‌كه‌ریا','مه‌لاخی','مەتا','مەرقۆس','لۆقا','یۆحەنا','کردار','ڕۆما','١ کۆرنسۆس','٢ کۆرنسۆس','گەلاتیا','ئەفەسۆس','فیلیپی','کۆلۆسی','١ سالۆنیكی','٢ سالۆنیكی','١ تیمۆساوس','٢ تیمۆساوس','تیتۆس','فلیمۆن','عیبرانییەکان','یاقوب','١ پەترۆس','٢ پەترۆس','١ یۆحەنا','٢ یۆحەنا','٣ یۆحەنا','یەهوزا','ئاشکراکردن'],
        'yrb':["Gẹ́nẹ́sísì","Ékísódù","Léfítíkù","Numeri","Deuteronomi","Josua","Awọn Onidajọ","Ruutu","Samueli (Kinni)","Samueli (Keji)","Awon Ọba (Kinni)","Awon Ọba (Keji)","Kronika (Kinni)","Kronika (Keji)","Esra","Nehemiah","Esteri","Jobu","Psalmu","Òwe","Oniwasu","Orin Solomọni","Isaiah","Jeremiah","Ẹkún Jeremiah","Esekieli","Danieli","Hosea","Joeli","Amọsi","Obadiah","Jonà","Mika","Nahumu","Habakkuku","Sefaniah","Haggai","Sekariah","Malaki","Matteu","Marku","Luku","Johanu","Ise Awọn Aposteli","Awọn Ará Romu","Awọn Ará Korinti (Kinni)","Awọn Ará Korinti (Keji)","Awọn Ará Galatia","Awọn Ará Efesu","Awọn Ará Filippi","Awọn Ará Kolosse","Awọn Ará Tessalonika (Kinni)","Awọn Ará Tessalonika (Keji)","Timoteu (Kinni)","Timoteu (Keji)","Titu","Filimọni","Awọn Heberu","Jákọ́bù","Peteru (Kinni)","Peteru (Keji)","Johanu (Kinni)","Johanu (Keji)","Johanu (Kẹta)","Juda","Ifihan"
        ]
    };
    bible.Data.rtlLanguages = [ 'he', 'fa', 'ar', 'ckb' ];
    bible.Data.supportedVersions = {
        'original': { name: 'Original', language: 'original', withStrongsNums:true },
        'accented': { name: 'Accented original', language: 'original', withStrongsNums:true },
        'KJV': { name: 'King James Version', language: 'en', withStrongsNums:true },
        'NKJV': { name: 'New King James Version', language: 'en', withStrongsNums:false },
        // 'RNKJV': { name: 'Restored Names King James Version', language: 'en', withStrongsNums:false },
        'ABP-en': { name: 'Apostolic Bible Polyglot-en', language: 'en', withStrongsNums:true },
        'ABP-gr': { name: 'Apostolic Bible Polyglot-gr', language: 'gr', withStrongsNums:true },
        'Aramaic': { name: 'Aramaic', language: 'arm', withStrongsNums:true },
        'WEB': { name: 'World English Bible', language: 'en', withStrongsNums:true },
        'ESV': { name: 'English Standard Version', language: 'en', withStrongsNums:true },
        'RSVA': { name: 'Revised Standard Version', language: 'en', withStrongsNums:false, apocrypha:true },
        'LC': { name: 'Literal Consistent', language: 'en', withStrongsNums:false },
        'YLT': { name: 'Young\'s Literal Translation', language: 'en', withStrongsNums:false },
        'ASV': { name: 'American Standard Version', language: 'en', withStrongsNums:false },
        'DARBY': { name: 'Darby Translation', language: 'en', withStrongsNums:false },
        'GW': { name: 'God\'s Word Translation', language: 'en', withStrongsNums:false },
        'JUB': { name: 'Jubilee Bible 200', language: 'en', withStrongsNums:false },
        'LEB': { name: 'Lexham English Bible', language: 'en', withStrongsNums:false },
        'NIV84': { name: 'New International Translation', language: 'en', withStrongsNums:false },
        'NET': { name: 'New English Translation', language: 'en', withStrongsNums:false },
        'NETplus': { name: 'New English Translation Plus', language: 'en', withStrongsNums:true },
        'WMB': { name: 'World Messianic Bible', language: 'en', withStrongsNums:false },
        'OPV': { name: 'ترجمه-ی قدام', language: 'fa', withStrongsNums:false },
        'TPV': { name: 'مژده برای اسرع جدید', language: 'fa', withStrongsNums:false },
        'NMV': { name: 'ترجمه هزارۀ نو', language: 'fa', withStrongsNums:false },
        'AraSVD': { name: 'Arabic Bible', language: 'ar', withStrongsNums:false },
        'RomCor': { name: 'Cornilescu Bible in Romanian language', language: 'ro', withStrongsNums:false },
        'MCSB': { name: 'Matupi Chin Standard Bible', language: 'hlt', withStrongsNums:true },
        'FreSegond1910': { name: "Bible Louis Segond (1910)", language: 'fr', withStrongsNums:false },
        'FreJND': { name: "Bible J.N.Darby en français", language: 'fr', withStrongsNums:false },
        'FrePGR': { name: "Bible Perret-Gentil et Rilliet", language: 'fr', withStrongsNums:false },
        'CKBOKS': { name: "وەشانی بێبەرامبەری کوردیی سۆرانیی ستاندەر", language: 'ckb', withStrongsNums:false },
        'Yoruba': { name: "Yoruba Bible", language: 'yrb', withStrongsNums:false },
        // 'GRKV': { name: "Greek LXX and NT-TR", language: 'gr', withStrongsNums:false },
    };
    bible.Data.interfaceLanguages = {
        'original': 'Hebrew/Greek',
        'en': 'English',
        'fa': 'Farsi',
        'ro': 'Romanian',
        'ar': 'Arabic',
        'hlt': 'Matupi Chin',
        'fr': 'French',
        'ckb': 'Kurdi Sorani',
        'gr': 'Greek',
        'yrb': 'Yoruba',
    };

    bible.Data.verses = [
    [31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26],
    [22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,36,31,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38],
    [17,16,17,35,19,30,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34],
    [54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13],
    [46,37,29,49,33,25,26,20,29,22,32,32,18,29,23,22,20,22,21,20,23,30,25,22,19,19,26,68,29,20,30,52,29,12],
    [18,24,17,24,15,27,26,35,27,43,23,24,33,15,63,10,18,28,51,9,45,34,16,33],
    [36,23,31,24,31,40,25,35,57,18,40,15,25,20,20,31,13,31,30,48,25],
    [22,23,18,22],
    [28,36,21,22,12,21,17,22,27,27,15,25,23,52,35,23,58,30,24,42,15,23,29,22,44,25,12,25,11,31,13],
    [27,32,39,12,25,23,29,18,13,19,27,31,39,33,37,23,29,33,43,26,22,51,39,25],
    [53,46,28,34,18,38,51,66,28,29,43,33,34,31,34,34,24,46,21,43,29,53],
    [18,25,27,44,27,33,20,29,37,36,21,21,25,29,38,20,41,37,37,21,26,20,37,20,30],
    [54,55,24,43,26,81,40,40,44,14,47,40,14,17,29,43,27,17,19,8,30,19,32,31,31,32,34,21,30],
    [17,18,17,22,14,42,22,18,31,19,23,16,22,15,19,14,19,34,11,37,20,12,21,27,28,23,9,27,36,27,21,33,25,33,27,23],
    [11,70,13,24,17,22,28,36,15,44],
    [11,20,32,23,19,19,73,18,38,39,36,47,31],
    [22,23,15,17,14,14,10,17,32,3],
    [22,13,26,21,27,30,21,22,35,22,20,25,28,22,35,22,16,21,29,29,34,30,17,25,6,14,23,28,25,31,40,22,33,37,16,33,24,41,30,24,34,17],
    [6,12,8,8,12,10,17,9,20,18,7,8,6,7,5,11,15,50,14,9,13,31,6,10,22,12,14,9,11,12,24,11,22,22,28,12,40,22,13,17,13,11,5,26,17,11,9,14,20,23,19,9,6,7,23,13,11,11,17,12,8,12,11,10,13,20,7,35,36,5,24,20,28,23,10,12,20,72,13,19,16,8,18,12,13,17,7,18,52,17,16,15,5,23,11,13,12,9,9,5,8,28,22,35,45,48,43,13,31,7,10,10,9,8,18,19,2,29,176,7,8,9,4,8,5,6,5,6,8,8,3,18,3,3,21,26,9,8,24,13,10,7,12,15,21,10,20,14,9,6],
    [33,22,35,27,23,35,27,36,18,32,31,28,25,35,33,33,28,24,29,30,31,29,35,34,28,28,27,28,27,33,31],
    [18,26,22,16,20,12,29,17,18,20,10,14],
    [17,17,11,16,16,13,13,14],
    [31,22,26,6,30,13,25,22,21,34,16,6,22,32,9,14,14,7,25,6,17,25,18,23,12,21,13,29,24,33,9,20,24,17,10,22,38,22,8,31,29,25,28,28,25,13,15,22,26,11,23,15,12,17,13,12,21,14,21,22,11,12,19,12,25,24],
    [19,37,25,31,31,30,34,22,26,25,23,17,27,22,21,21,27,23,15,18,14,30,40,10,38,24,22,17,32,24,40,44,26,22,19,32,21,28,18,16,18,22,13,30,5,28,7,47,39,46,64,34],
    [22,22,66,22,22],
    [28,10,27,17,17,14,27,18,11,22,25,28,23,23,8,63,24,32,14,49,32,31,49,27,17,21,36,26,21,26,18,32,33,31,15,38,28,23,29,49,26,20,27,31,25,24,23,35],
    [21,49,30,37,31,28,28,27,27,21,45,13],
    [11,23,5,19,15,11,16,14,17,15,12,14,16,9],
    [20,32,21],
    [15,16,15,13,27,14,17,14,15],
    [21],
    [17,10,10,11],
    [16,13,12,13,15,16,20],
    [15,13,19],
    [17,20,19],
    [18,15,20],
    [15,23],
    [21,13,10,14,11,15,14,23,17,12,17,14,9,21],
    [14,17,18,6],
    [25,23,17,25,48,34,29,34,38,42,30,50,58,36,39,28,27,35,30,34,46,46,39,51,46,75,66,20],
    [45,28,35,41,43,56,37,38,50,52,33,44,37,72,47,20],
    [80,52,38,44,39,49,50,56,62,42,54,59,35,35,32,31,37,43,48,47,38,71,56,53],
    [51,25,36,54,47,71,53,59,41,42,57,50,38,31,27,33,26,40,42,31,25],
    [26,47,26,37,42,15,60,40,43,48,30,25,52,28,41,40,34,28,41,38,40,30,35,27,27,32,44,31],
    [32,29,31,25,21,23,25,39,33,21,36,21,14,23,33,27],
    [31,16,23,21,13,20,40,13,27,33,34,31,13,40,58,24],
    [24,17,18,18,21,18,16,24,15,18,33,21,14],
    [24,21,29,31,26,18],
    [23,22,21,32,33,24],
    [30,30,21,23],
    [29,23,25,18],
    [10,20,13,18,28],
    [12,17,18],
    [20,15,16,16,25,21],
    [18,26,17,22],
    [16,15,15],
    [25],
    [14,18,19,16,14,20,28,13,28,39,40,29,25],
    [27,26,18,17,20],
    [25,25,22,19,14],
    [21,22,18],
    [10,29,24,21,21],
    [13],
    [14],
    [25],
    [20,29,22,11,14,17,17,13,21,11,19,17,18,20,8,21,18,24,21,15,27,21],

    // APOCRYPHA
    [58, 30, 24, 63, 73, 34, 15, 96, 55],
    [40, 48, 36, 52, 56, 59, 70, 63, 47, 60, 46, 51, 58, 48, 63, 78],
    [22, 14, 17, 21, 23, 19, 18, 21, 6, 13, 19, 22, 18, 15],
    [16, 28, 10, 15, 24, 21, 32, 36, 14, 23, 23, 20, 20, 19, 14, 25],
    [17, 11, 13, 10, 9, 16],
    [16, 24, 19, 20, 23, 25, 30, 21, 18, 21, 26, 27, 19, 31, 19, 29, 21, 25, 22],
    [30, 18, 31, 30, 18, 37, 36, 19, 18, 31, 34, 18, 26, 27, 20, 30, 32, 33, 30, 30, 28, 27, 28, 34, 26, 29, 30, 26, 28, 25, 31, 24, 33, 30, 24, 27, 21, 31, 30, 30, 26, 25, 33, 26, 23, 26, 20, 25, 25, 29, 30],
    [22, 35, 37, 37, 9, 73],
    [73],
    [68],
    [64],
    [42],
    [15],
    [64, 70, 60, 61, 68, 63, 50, 32, 73, 89, 74, 53, 54, 49, 41, 24],
    [36, 32, 40, 50, 27, 31, 42, 36, 29, 38, 38, 46, 26, 46, 39],
    [29, 33, 30, 21, 51, 41, 23],
    [35, 24, 21, 26, 37, 35, 23, 29, 32, 21, 27, 20, 27, 20, 32, 25, 26, 24],
    [7]
    ];
    // bible.apocryphaBibleVersions = (propName, propValue) {
    bible.apocryphaBibleVersions = function() {
        const obj = bible.Data.supportedVersions;
        return Object.keys(obj).filter(
            key => obj[key]["apocrypha"] === true
        );
    }

    bible.parseReference = function(textReference) {

        var bookID = -1;
        var chapter1 = -1;
        var verse1 = -1;
        var chapter2 = -1;
        var verse2 = -1;
        var input = new String(textReference);

        bookID = bible.getBookId( input )
        if(bookID==-1){return}

        var afterRange = false;
        var afterSeparator = false;
        var startedNumber = false;
        var currentNumber = '';

        for (var i = 0; i < input.length; i++) {
            var c = input.charAt(i);

            if (c == ' ' || isNaN(c)) {
                if (!startedNumber)
                    continue;

                if (c == '-') {
                    afterRange = true;
                    afterSeparator = false;
                } else if (c == ':' || c == ',' || c == '.') {
                    afterSeparator = true;
                } else {
                    // ignore
                }

                // reset
                currentNumber = '';
                startedNumber = false;

            } else {
                startedNumber = true;
                currentNumber += c;

                if (afterSeparator) {
                    if (afterRange) {
                        verse2 = parseInt(currentNumber);
                    } else { // 1:1
                        verse1 = parseInt(currentNumber);
                    }
                } else {
                    if (afterRange) {
                        chapter2 = parseInt(currentNumber);
                    } else { // 1
                        chapter1 = parseInt(currentNumber);
                    }
                }
            }
        }

        // reassign 1:1-2 
        if (chapter1 > 0 && verse1 > 0 && chapter2 > 0 && verse2 <= 0) {
            verse2 = chapter2;
            chapter2 = chapter1;
        }
        // fix 1-2:5 
        if (chapter1 > 0 && verse1 <= 0 && chapter2 > 0 && verse2 > 0) {
            verse1 = 1;
        }

        // just book 
        if (bookID > 0 && chapter1 <= 0 && verse1 <= 0 && chapter2 <= 0 && verse2 <= 0) {
            chapter1 = 1;
            verse1 = 1;
        }

        // validate max chapter 
        if (chapter1 == -1) {
            chapter1 = 1;
        } else if (chapter1 > bible.Data.verses[bookID - 1].length) {
            chapter1 = bible.Data.verses[bookID - 1].length;
            verse1 = 1;
        }

        // validate max verse 
        if (verse1 == -1) {
            verse1 = 1;
        } else if (verse1 > bible.Data.verses[bookID - 1][chapter1-1]) {
            verse1 = bible.Data.verses[bookID - 1][chapter1-1];
        }

        // finalize
        return new bible.Reference(bookID, chapter1, verse1, chapter2, verse2);
    };

    bible.Reference = function() {

        var _bookID = -1;
        var _chapter1 = -1;
        var _verse1 = -1;
        var _chapter2 = -1;
        var _verse2 = -1;

        if (arguments.length == 0) {
            // error
        } else if (arguments.length == 1) { // a string that needs to be parsed
            return bible.parseReference(arguments[0]);
        } else {
            _bookID = arguments[0];
            _chapter1 = arguments[1];
            if (arguments.length >= 3) _verse1 = arguments[2];
            if (arguments.length >= 4) _chapter2 = arguments[3];
            if (arguments.length >= 5) _verse2 = arguments[4];
        }

        function padLeft(input, length, s) {
            while (input.length < length)
                input = s + input;
            return input;
        }

        let maxChapter = bible.Data.verses[_bookID - 1].length;
        let maxVerse = bible.Data.verses[_bookID - 1][_chapter1-1];
        return {
            bookID: _bookID,
            bookName: bible.getBook( _bookID ),
            chapter: _chapter1,
            verse: _verse1,
            chapter1: _chapter1,
            verse1: _verse1,
            chapter2: _chapter2,
            verse2: _verse2,
            maxVerse,
            maxChapter,

            isValid: false,

            toString: function() {
                if (this.bookID < 1 || this.bookID > bible.Data.books.length) return "invalid";

                var b = bible.Data.books[this.bookID - 1][0] + ' ';

                if (this.chapter1 > 0 && this.verse1 <= 0 && this.chapter2 <= 0 && this.verse2 <= 0) // John 1 
                    return b + this.chapter1;
                else if (this.chapter1 > 0 && this.verse1 > 0 && this.chapter2 <= 0 && this.verse2 <= 0) // John 1:1 
                    return b + this.chapter1 + ':' + this.verse1;
                else if (this.chapter1 > 0 && this.verse1 > 0 && this.chapter2 <= 0 && this.verse2 > 0) // John 1:1-5 
                    return b + this.chapter1 + ':' + this.verse1 + '-' + this.verse2;
                else if (this.chapter1 > 0 && this.verse1 <= 0 && this.chapter2 > 0 && this.verse2 <= 0) // John 1-2 
                    return b + this.chapter1 + '-' + this.chapter2;
                else if (this.chapter1 > 0 && this.verse1 > 0 && this.chapter2 > 0 && this.verse2 > 0) // John 1:1-2:2 
                    return b + this.chapter1 + ':' + this.verse1 + '-' + ((this.chapter1 != this.chapter2) ? this.chapter2 + ':' : '') + this.verse2;
                else 
                    return 'unknown';
            },
            toOsis: function() {
                if (this.bookID <= 0 || this.bookID > bible.Data.books.length) return "invalid";
                return bible.Data.books[this.bookID - 1][0] + '.' + this.chapter1 + '.' + this.verse1;
            },
            toChapterCode: function() {
                if (this.bookID <= 0 || this.bookID > bible.Data.books.length) return "invalid";
                //return this.bookID.toString() + this.chapter1.toString()
                return 'c' + padLeft(this.bookID.toString(), 3, '0') + padLeft(this.chapter1.toString(), 3, '0');
            },
            toVerseCode: function() {
                if (this.bookID <= 0 || this.bookID > bible.Data.books.length) return "invalid";
                return 'v' + padLeft(this.bookID.toString(), 3, '0') + padLeft(this.chapter1.toString(), 3, '0') + padLeft(this.verse1.toString(), 3, '0');
            },
            prevChapter: function() {
                this.verse1 = 1;
                this.chapter2 = -1;
                this.verse2 = -1;
                if (this.chapter1 == 1 && this.bookID > 1) {
                    this.bookID--;
                    this.chapter1 = bible.Data.verses[this.bookID - 1].length;
                } else if ( this.chapter1 === 1 && this.bookID === 1 ) {
                    return null;
                } else {
                    this.chapter1--;
                }

                this.maxVerse = bible.Data.verses[this.bookID - 1][this.chapter1-1];
                this.bookName = bible.getBook( this.bookID );
                return Object.assign( {}, this );
            },
            nextChapter: function() {
                this.verse1 = 1;
                this.chapter2 = -1;
                this.verse2 = -1;
                if (this.chapter1 < bible.Data.verses[this.bookID - 1].length) {
                    this.chapter1++;
                } else if (this.bookID < bible.Data.books.length) {
                    this.bookID++;
                    this.chapter1 = 1;
                } else {
                    return null;
                }
                
                this.maxVerse = bible.Data.verses[this.bookID - 1][this.chapter1-1];
                this.bookName = bible.getBook( this.bookID );
                return Object.assign( {}, this );
            },
            isFirstChapter: function() {
                return (this.bookID == 1 && this.chapter1 ==1); // && this.verse1 == 1);
            },
            isLastChapter: function() {
                var v = bible.Data.verses[this.bookID-1];

                return (this.bookID	== bible.Data.books.length && this.chapter1 == v.length); // && this.verse1 == v[v.length-1]);
            },
            getBook: function() {
                return bible.Data.books[ this.bookID - 1 ][ 0 ];
            }
        }
    };
    bible.utility = {};
    bible.getBookId = function( textReference ) {
        var input = textReference;
        var inputBkNm = new String(input.replace(/[.:-;]/g,'').split(/(?<=\w\s*)\s*\d/)[0]);
        var bookID = -1;
        // tear off book name
        for (var i = bible.Data.books.length - 1; i >= 0; i--) {
            for (var j = 0; j < bible.Data.books[i].length; j++) {
                var name = new String(bible.Data.books[i][j]).toLowerCase();
                var possibleMatch = inputBkNm.substring(0, Math.floor(name.length, inputBkNm.length)).toLowerCase();

                if (possibleMatch == name) {
                    bookID = i + 1;

                    input = inputBkNm.substring(name.length);
                    if (inputBkNm.length == name.length) {break;}//Only break if it is a perfect match
                }

            }
            // if (bookID > -1)break;
        }
        return bookID;
    };
    bible.getBook = function( bookId ) {
        return bible.Data.books[ bookId - 1][0];
    };

    bible.getTranslatedBookNameByLanguage = function( bookName, language ) {
        return bible.Data.bookNamesByLanguage[ language ][ bible.getBookId( bookName ) - 1 ];
    };

    bible.getTranslatedBookName = function( bookName, version ) {
        if ( ! bookName || ! version ) {
            return 'problemo';
        }
        var language = bible.Data.supportedVersions[ version ].language;
        return bible.getTranslatedBookNameByLanguage( bookName, language );
    };

    bible.isRtlVersion = function( version, book ) {
        var versionLanguage = bible.Data.supportedVersions[ version ].language;
        if ( bible.Data.rtlLanguages.indexOf( versionLanguage ) > -1 ) {
            return true;
        }

        if ( versionLanguage === 'original' && book && bible.Data.otBooks.indexOf( book ) > -1 ) {
            return true;
        }
    };

    bible.getPrevAndNextChapterReferences = function(ref){
        const parsedRef = bible.parseReference(ref);
        const bkName = parsedRef.bookName;
        const verse = parsedRef.verse;
        const bkIndx = bible.Data.allBooks.findIndex(x=>{return x.toUpperCase() == bkName});
        const chptNum = Number(parsedRef.chapter);
        const lastVerse = bible.Data.verses[bkIndx][bible.Data.verses[bkIndx].length-1];
        const chaptersInBook = bible.Data.verses[bkIndx].length;
        let nextChapter, prevChapter, nextVerse, prevVerse;
        if(lastVerse > verse){nextVerse = `${bkName} ${chptNum}:${verse + 1}`;}
        if (chptNum < 1 || chptNum > chaptersInBook) {return null}
        /* NEXT CHAPTER */
        //if there is a chapter after this chapter in the book
        //Next chapter within the same book 
    if (chaptersInBook > chptNum) {
            nextChapter = `${bkName} ${chptNum + 1}`;
            if(lastVerse == verse){nextVerse = `${bkName} ${chptNum + 1}:1`;}
        }
        //if it is not the last book of the bible
        //Next chapter outside the book else 
    if (bkIndx < 65){
            nextChapter = `${bible.Data.allBooks[bkIndx + 1]} 1`;
            nextVerse = `${nextChapter}:1`;
        }
        
        /* PREVIOUS CHAPTER */
        //if there is a chapter after this chapter in the book
        //Previous chapter inside the same book 
    if (chptNum > 1) {
            prevChapter = `${bkName} ${chptNum - 1}`;
            prevVerse = `${bkName} ${chptNum - 1}:${bible.Data.verses[bkIndx][chptNum-1]}`;
        }
        //if it is not the last book of the bible
        //Previous chapter outside the book else 
    if (bkIndx > 1){
            prevChapter = `${bible.Data.allBooks[bkIndx - 1]} ${bible.Data.verses[bkIndx-1][bible.Data.verses[bkIndx-1].length-1]}`;
            prevVerse = `${prevChapter} ${chptNum}:1`
        }
        return {prevChapter, nextChapter, prevVerse, nextVerse}
    }

    function reference_Before_n_After(newRef, vOffset=2){
        
        let parsedRef = bible.parseReference(newRef);
        if(0 < vOffset){parsedRef = bible.parseReference(newRef).nextChapter();
        }
        else if(vOffset < 0){parsedRef = bible.parseReference(newRef).prevChapter();
        }
        let {bookID, chapter1, maxVerse} = parsedRef;
        let bookName = bible.Data.bookNamesByLanguage.en[bookID-1];
        let chapter = chapter1;
        let lastVerseInPrvChpt = maxVerse;
        let offsetFromLastVerse;
        let vNum = parsedRef.verse;
        let offsetVerse = vNum;
        let beforeOrAfter;

        if(0 < vOffset){//positive
            beforeOrAfter = 1;
            if(vOffset <= maxVerse){
                offsetFromLastVerse = vOffset;
                offsetVerse = vOffset;
            }
            //if the offset is greater than the last verse in the next chapter
            else {
                vOffset = vOffset - maxVerse;
                reference_Before_n_After(bookName+chapter1, vOffset);
                return
            }
        }
        else if(vOffset < 0){//negative
            beforeOrAfter = -1;
            if(lastVerseInPrvChpt > vOffset*-1){
                offsetFromLastVerse = lastVerseInPrvChpt + vOffset;
                offsetVerse = offsetFromLastVerse;
                
            }
            //if the offset is greater than the last verse in the preceding chapter
            else {
                vOffset = vOffset + lastVerseInPrvChpt;
                reference_Before_n_After(bookName+chapter1, vOffset);
                return
            }
        }
        jumpToID = `_${bookID-1}.${chapter-1}.${offsetVerse-1}`;
        let bookNchapter = `${bookName} ${chapter}:${offsetVerse}`;
        
        return {bookID, bookName, chapter, lastVerseInPrvChpt, offsetVerse, jumpToID, bookNchapter,beforeOrAfter}
    }
    function verseOffset(newRef, vOffset=2){
        
        // let parsedRef = bible.parseReference(newRef).prevChapter();
        let parsedRef = bible.parseReference(newRef);
        let {bookID, chapter1, maxVerse} = parsedRef;
        let vNum = parsedRef.verse;
        let offsetVerse = vNum;
        let lastVerseInPrvChpt = maxVerse;
        let chapter = chapter1;
        // Verses after reference verse (e.g., -2)
        let beforeOrAfter = 0;
        
        // Check if vOffset is still within the chapter or goes outside it
            //beyond the current ref chapter
        if((vNum + vOffset) > maxVerse){

            vOffset = vOffset - (maxVerse - vNum);
            return reference_Before_n_After(newRef, vOffset);
        }
        // Verses before reference verse (e.g., -2)
        //before the current ref chapter
        else if((vOffset + vNum) < 1){
            vOffset = vOffset + vNum;
            return reference_Before_n_After(newRef, vOffset);
        }
        else {
            offsetVerse = vNum + vOffset;
        }

        let bookName = bible.Data.bookNamesByLanguage.en[bookID-1];
        jumpToID = `_${bookID-1}.${chapter-1}.${offsetVerse-1}`;

        return {bookID, bookName, chapter, lastVerseInPrvChpt, offsetVerse, jumpToID, bookNchapter: `${bookName} ${chapter}`, beforeOrAfter}
    }
    return bible
}
/* ********************************* */
/* ***** BIBLE VERSIONS LOADER ***** */
/* ********************************* */
let bversionName = 'KJV';
if (bv = localStorage.getItem('bversionName')) {
    bversionName = bv;
}
loadVersion(bversionName);
function loadVersion(versionName) {
    let url;

  if (window.location.protocol === 'file:') {
    // Electron: Calculate depth ONLY inside the app (after /resources/app/site_2/)
    const fullPathHead = document.querySelectorAll('body')[0].baseURI.split('resources/app')[0];
    url = fullPathHead + `resources/app/src/bibles/${versionName}.json`;
  } else {
    // Web (Netlify/GitHub Pages): Use absolute path from site root
    url = '../bibles/' + versionName + '.json';
  }

  return fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load Bible version "${versionName}" (${response.status} ${response.statusText})`);
      }
      return response.json();
    })
    .then(data => {
      // Assuming the JSON has a "books" property
      const newVersion = data.books;
      window[versionName] = newVersion;
      // Optionally resolve with the data for convenience
      return newVersion;
    })
    .catch(error => {
      console.error('Error loading Bible version:', versionName, error);
      throw error; // Let caller handle the failure
    });
}

function appendCrossReferences(e) {
    
    /* On rightclick of xref button in code, toggle showXrefSections */
    if (e.button === 2) {
        if (rightMouseDownTime !== null) {
            const heldDuration = Date.now() - rightMouseDownTime;            
            const threshold = 300; // milliseconds
            // Short right-click detected
            if (heldDuration < threshold) {recognizeRightClick = true;}
            else {return}
        }
    }
    if(e.type=='contextmenu' && e.target.closest('.verse code[ref] #verse_crossref_button')){
        showXrefSections==true?showXrefSections=false:showXrefSections=true;
        refnav.querySelectorAll('.verse:not(.contextmenu .verse) .crfnnote').forEach(crfnnoteDIV => {showORdisplaynoneXrefSections(crfnnoteDIV);});
        return
    }
    if (!e.target || e.target.matches('#singleverse_compare_menu button') || (!e.target.matches('[bversion], #verse_crossref_button, .verse_crossref_button') && !((e.shiftKey||e.callorigin=='x') && e.target.matches('.verse, .crfnnote *'))) && !((e.type=='dblclick' || e.type=='contextmenu' && !e.ctrlKey) && e.target.closest('.context_menu code[ref]')) && !(e.type=='contextmenu' && e.target.matches(':is(.context_menu,#refnav) .verse'))) {
        return
    }

    if(e.target.closest('.context_menu code[ref], .context_menu code[ref] .verse_crossref_button') || ((e.type=='dblclick' || e.type=='contextmenu' && !e.ctrlKey) && e.target.closest('.context_menu code[ref]')) || (e.type=='contextmenu' && e.target.matches(':is(.context_menu,#refnav) .verse'))){
        const crfnnote = e.target.closest('.verse').querySelector('.crfnnote');
        const crfnnote_displayedNone = crfnnote.classList.contains('displaynone');
        const xrefs_sld_up = (!crfnnote.querySelector('.crossrefs') || crfnnote.querySelector('.crossrefs.sld_up'));

        if(crfnnote_displayedNone){//show crossrefs
            crfnnote.classList.remove('displaynone');//show cmenu xref section
            const vcb = crfnnote.querySelector('.verse_crossref_button');
            if (!(e.type=='contextmenu' && e.target.matches(':is(.context_menu,#refnav) .verse'))) {
                xrefs_sld_up ? (vcb.click(), scrollIntoViewWithOverlay(vcb)) : null;
            }
            scrollIntoViewWithOverlay(vcb);
            return
        }
        else {//hide crossrefs
            if(xrefs_sld_up && !(e.type=='contextmenu' && e.target.matches(':is(.context_menu,#refnav) .verse'))){
                const vcb = crfnnote.querySelector('.verse_crossref_button');
                vcb.click();
                scrollIntoViewWithOverlay(vcb);
            }
            else {
                let anim_t = 0;
                if(xrefs = crfnnote.querySelector('.crossrefs')){
                    anim_t = slideUpDown(xrefs);}
                if(!context_menu.matches('.showingXref')){
                    const t = setTimeout(() => {
                        crfnnote.classList.add('displaynone'); clearTimeout(t)}, anim_t+50);
                }
            }
        }
        return
    }

    let eTarget;//Holds the 'ref' attribute;
    let masterVerseHolder; //For indicating if crossrefs are being shown and for finding nextSibling to append the crossrefs to
    let refCode;
    let vHolder; //Element to append after
    const vRcRbT = e.target.closest('#verse_crossref_button');
    let crfnnoteHolder = e.target.closest('.crfnnote');
    
    crfnnoteHolder = crfnnoteHolder ? crfnnoteHolder : (vRcRbT ? vRcRbT.closest('.vmultiple,.verse').querySelector('.verse .crfnnote'):null);
    
    if(mVH=e.target.closest('.vmultiple')){
        const prvlastClickedVerse = lastClickedVerse;
        masterVerseHolder = mVH;
        eTarget = mVH.hasAttribute('ref') ? mVH : mVH.querySelector('[ref]');//What I need is the ref
        /* if(e.target.matches('#verse_crossref_button')){eTarget = e.target.parentNode.parentNode;}
        else if(e.target.matches('#verse_crossref_button a')){eTarget = e.target.parentNode.parentNode.parentNode;}
        else if(e.shiftKey && e.target.matches('.vmultiple .verse')){eTarget=e.target.querySelector('code[ref]')}
        else if(e.callorigin&&e.callorigin=='x'){eTarget=e.target.querySelector('code[ref]');} */
        refCode = eTarget.getAttribute('ref');
        let siblingCrossREF = masterVerseHolder.nextElementSibling;
        let anim_t;
    
        //Only Append Crossrefs If It Doesn't Already Have Crossrefs
        if (siblingCrossREF==null || siblingCrossREF==undefined || !siblingCrossREF.matches('.crossrefs, .crossrefs_holder')) {
            masterVerseHolder.classList.add('showing_crossref')
            vHolder = masterVerseHolder;
            if (refCode){
                siblingCrossREF = generateCrossRefsFromRefCode(refCode);
                const crossrefs = siblingCrossREF;
                if(!siblingCrossREF){return}
                // Create the new parent element
                var crossrefs_holder = document.createElement('div');
                crossrefs_holder.classList.add('crossrefs_holder');
                siblingCrossREF.parentNode.replaceChild(crossrefs_holder, siblingCrossREF);// Replace the original element with the new parent element in the DOM
                crossrefs_holder.appendChild(siblingCrossREF);// Append the original element to the new parent element
                siblingCrossREF.style.zIndex = -1;
                dontGetLastVerse=true;
                setTimeout(() => {anim_t = slideUpDown(crossrefs)}, 1);
                setTimeout(()=>{
                    crossrefs.scrollIntoView({behavior:"smooth",block:"nearest"});
                    dontGetLastVerse=false;},300);
            }
        } else {
            dontGetLastVerse=true;
            anim_t = slideUpDown(siblingCrossREF.querySelector('.crossrefs'));
            setTimeout(() => {
                masterVerseHolder.classList.remove('showing_crossref');
                siblingCrossREF.matches('.crossrefs, .crossrefs_holder') ? siblingCrossREF.remove() : null;
            }, 300);
            
        }
        setTimeout(() => {
            lastClickedVerse = prvlastClickedVerse;
            // getHighestVisibleH2();
            dontGetLastVerse=false;
        }, anim_t>300?anim_t:300);
    }
    /* FOR SEARCHRESULT WINDOW */
    else if (crfnnoteHolder){
        if (e.target.closest('.crfnnote') && crfnnoteHolder.classList.contains('displaynone')) {crfnnoteHolder.classList.add('ignore_displaynone');}else if(e.target.closest('#verse_crossref_button')){setTimeout(() => {crfnnoteHolder.classList.remove('ignore_displaynone')}, 100);}
        verseInSearchWindow = e.target.closest('.verse');
        refCode = verseInSearchWindow.querySelector('[ref]').getAttribute('ref');
        vHolder = crfnnoteHolder.querySelector('.crfnnote_btns');
        if(siblingCrossREF = crfnnoteHolder.querySelector('.crossrefs')){
            
            // If hidden show it
            if(!e.ctrlKey && siblingCrossREF.classList.contains('sld_up')){
                slideUpDown(siblingCrossREF, 'show')
                verseInSearchWindow.classList.add('showing_crossref')
                siblingCrossREF.scrollIntoView({behavior:"smooth",block:"nearest"});
            }
            // If showing, hide it
            else {
                const t = slideUpDown(siblingCrossREF);
                verseInSearchWindow.classList.remove('showing_crossref');
                if (e.ctrlKey) {
                    siblingCrossREF.style.display='none';
                    setTimeout(() => {
                        siblingCrossREF.classList.add('sld_up');
                        crfnnoteHolder.classList.add('ignore_displaynone'); 
                    }, t);
                }
            }
        }
        else {
            verseInSearchWindow.classList.add('showing_crossref');
            generateCrossRefsFromRefCode(refCode, 1);
            siblingCrossREF = crfnnoteHolder.querySelector('.crossrefs');
            setTimeout(()=>{slideUpDown(siblingCrossREF)},1);
        }
    }
    function generateCrossRefsFromRefCode(refCode, transition){
        // refCode, i.e., clicked verse
        refCode = refCode.replace(/(\w)\s([0-9]+)/g, '$1.$2'); //Romans 2:3==>Romans.2:3
        refCode = refCode.replace(/:/g, '.'); //Romans.2:3==>Romans.2.3

        let generatedXref;
        let crfDiv = document.createElement('DIV');
        crfDiv.classList.add('crossrefs');
        
        // if(transition){
            /* So I can get its height */
            crfDiv.style.position = 'absolute';
            crfDiv.style.opacity = 0;
        // }
        // if(transition){
            // crfDiv = vHolder.parentNode.querySelector('.crossrefs');
            crfDiv.style.position = '';
            crfDiv.style.marginTop = '-' + crfDiv.offsetHeight + 'px';
            crfDiv.classList.add('sld_up');// for the slideUpDown(elm) function
        // }
        let tskRefs=[];

        [[TSK,'TSK'],[crossReferences_fullName,'Others']].forEach(xRef=>{
            // Get crossreferences array for clicked verse
            // let crossRef = crossReferences_fullName[refCode];
            // let crossRef = TSK[refCode];
            let crossRef = xRef[0][refCode];
            currentVerseCrossRefrence=crossRef;
            if (!crossRef) {return}
            let narr=[]
            crossRef.forEach(cf=>{
                if(cf[0] instanceof Array){
                    cf.forEach((cfL1,i)=>{
                        if(i==0){narr.push(cfL1)}
                        else {
                            cfL1.forEach(cfL2=>{
                                cfL2 = refineCrossrefCode(cfL2)
                                narr.push(cfL2)
                            })
                        }
                    })
                }
                else {
                    cf = refineCrossrefCode(cf);
                    narr.push(cf)
                }
            })
            crossRef=narr;
            generatedXref = parseCrossRef(crossRef,crfDiv,xRef[1]);
        })
        generatedXref.style.position = 'absolute';//temporary--to get height
        generatedXref.style.marginTop = (-1 * crfDiv.offsetHeight) + 'px';
        generatedXref.classList.add('sld_up');
        generatedXref.style.position = '';
        generatedXref.focus();
        return generatedXref
        function parseCrossRef(crossRef,crfDiv,sumtext) {
            let crfFrag = new DocumentFragment();
            // let details = document.createElement('DETAILS');
            // let summary = document.createElement('SUMMARY');
            // summary.innerText = sumtext;
            // details.append(summary);
            let appendSumtext=false;
            crossRef.forEach((crf,i) => {
                let divider = document.createElement('i');
                divider.style.fontStyle = 'normal';
                if(crf instanceof Array){
                    if(i>0){
                        if (crfFrag.lastChild.nodeType === Node.TEXT_NODE) {crfFrag.removeChild(crfFrag.lastChild);}
                        let br = document.createElement('BR');
                        crfFrag.append(br);
                    }
                    let crfBold = document.createElement('B');
                    crfBold.innerText = crf;
                    if(sumtext=='TSK'){tskRefs.push(crf);}
                    crfBold.style.fontStyle = 'italic';
                    crfBold.classList.add('notref');
                    crfFrag.append(crfBold);
                    divider.innerText = ': ';
                    crfFrag.append(divider);
                }
                else {
                    let unComma = crf.replace(/-/,',');
                    if(sumtext=='Others' && (tskRefs.indexOf(crf)>-1||tskRefs.indexOf(unComma)>-1)){return}
                    appendSumtext=true;
                    let crfSpan = document.createElement('SPAN');
                    crfSpan.setAttribute('tabindex',0);
                    crfSpan.innerText = crf;
                    if(sumtext=='TSK'){tskRefs.push(crf);}
                    crfFrag.append(crfSpan);
                    divider.innerText = '; ';
                    if(i!=crossRef.length-1){crfFrag.append(divider)}
                }
            });
            if(sumtext=='TSK'||appendSumtext==true){
                let H3 = document.createElement('H5');
                H3.innerText = sumtext;
                crfFrag.prepend(H3);
                if (crfFrag.lastChild.nodeType === Node.TEXT_NODE) {
                    crfFrag.removeChild(crfFrag.lastChild);
                }
            }
                    
            crfDiv.append(crfFrag);
            vHolder.parentNode.insertBefore(crfDiv, vHolder.nextSibling);
            if (sumtext=='Others') {    
            }
            return crfDiv
        }
    }
    function scrollIntoViewWithOverlay(element) {
        const container = element.closest('.context_menu, #refnav');
        const overlay = container.querySelector('.bottombar');
        const overlayHeight = overlay ? overlay.offsetHeight : 0;

        element.scrollIntoView({behavior: "smooth", block: "nearest"});

        let scrollTimeout;
        const handleScrollEnd = () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
            // Scroll has stopped, now adjust for overlay
            container.scrollBy({top: overlayHeight, behavior: "smooth"});
            container.removeEventListener('scroll', handleScrollEnd);
            }, 50);
        };
        container.addEventListener('scroll', handleScrollEnd);
    }
}
function refineCrossrefCode(cf) {
    let cfr = cf.split('.');
    let cv = cfr[0] + '.' + cfr[1] + '.'; // first bk and chpt in reference (some have two chapters)
    cf = cfr[0] + '.' + cfr[1] + '.' + cf.split(cv).join(''); // Isa.6:1-Isa.6.3 => Isa.6:1-3
    cf = cf.replace(/(\p{L})\.*([0-9]+)/gui, '$1 $2');
    cf = cf.replace(/\./g, ':');
    return cf;
}
/* ***** ************************* ***** */
/* ***** GETTING TEXT OF REFERENCE ***** */
/* ***** ************************* ***** */
/* FOR GETTING THE ACTUAL BIBLE TEXT OF A CROSS-REFERENCE */
async function getCrossReference(x,bkn,bvName) {
    // x is the ref as a string or the code elm itself
    let crf2get,prv_i;
    if(typeof (x)=='string'){
        crf2get = x.replace(/\s+/ig, ' ').replace(/\s*([:;,.-])\s*/ig, '$1').replace(/\bI\s/i, 1).replace(/\bII\s/i, 2).replace(/\bIII\s/i, 3).replace(/\bIV\s/i, 4).replace(/\bV\s/i, 5);
    }
    else {
        if(x.hasAttribute('ref')){
            crf2get = refineCrossrefCode(x.getAttribute('ref'));
        }
        else if(x.matches('.reference')){
            //refine the reference
            let bkname=x.value;
            bkname.replace(/([a-zA-Z])(\d)/ig, '$1 $2'); // Rom1 => Rom 1
            let bkNchv=bkname.split(/(?<=[a-zA-Z])\s+(?=\d)/ig);// 1 Cor 2:14-16 => ['1 Cor','2:14-16']
            let bk=bkNchv[0].replace(/i\s/i, '1').replace(/ii\s/, '2').replace(/\s+/, '');
            crf2get=bk+bkNchv[1];
        }
        else {
            crf2get = x.innerText.replace(/\s+/ig, ' ').replace(/\s*([:;,.-])\s*/ig, '$1');
        }
    }
    // Requires that book name not have space: Not Valid: '1 Cor'. Valid: '1Cor'
    crf2get = crf2get.split((/(?:\s+(?=\d))|:/)).join('.');
    let bk = crf2get.split('.')[0]
    // let chp1 = Number(crf2get.split('.')[1]);
    let chp1 = bible.parseReference(bk + ' ' + Number(crf2get.split('.')[1])).chapter1;//if the chapter is more than number of chapters in book, will return the last chapter in book
    let vrs1 = Number(crf2get.split('.')[2]);
    let chp2 = chp1;
    let vrs2 = vrs1;
    let fullBkn;
    let bibleDataBkIndx;
    bible.Data.books.forEach((ref_, ref_indx) => {
        if (ref_.includes(bk.toUpperCase())) {
            fullBkn = bible.Data.bookNamesByLanguage.en[ref_indx];
            bibleDataBkIndx = ref_indx;
        }
    });
    let vHolder = new DocumentFragment();
    let br = '';
    if (/\s*,\s*/.test(crf2get)) {
        let vrsGrpsByCommas = crf2get.split(/\s*,\s*/);
        let grp1 = vrsGrpsByCommas.shift(); // Will contain a full reference, c.g., Gen 2:16-17
        let vRange1 = verseRange(grp1);
        await getVersesInVerseRange(Object.values(vRange1)[0]);
        let vRanges = []; // populated by getVranges(vg)
        vrsGrpsByCommas.forEach(vg=>getVranges(vg))
        // vRanges.forEach((vR,j)=>{
        //     br=`<hr vrange="${bk} ${chp1}:${vrsGrpsByCommas[j]}">`
        //     await getVersesInVerseRange(vR)
        // })
        for (let [j, vR] of vRanges.entries()) {
            br = `<hr vrange="${bk} ${chp1}:${vrsGrpsByCommas[j]}">`;
            await getVersesInVerseRange(vR);
        }
        function getVranges(vg){
            if(vg.split('-').length>1){ // it is a range, e.g., 5-13
                vRanges.push([Number(vg.split('-')[0]), Number(vg.split('-')[1])])
            } else { // it is a single number
                vRanges.push([Number(vg),Number(vg)])
            }
        }
    }else {
        vRange = verseRange(crf2get);
        // getVersesInVerseRange(vRange);
        const vRangeKeys = Object.keys(vRange)
        for (let i = 0; i < vRangeKeys.length; i++) {
            chp1=Number(vRangeKeys[i]);
            const vr = Object.values(vRange)[i];
            await getVersesInVerseRange(vr);
        }
    }
    function verseRange(crf2get){
        if (/\s*-\s*/.test(crf2get)) { //MORE THAN ONE VERSE
            vrs1 = Number(crf2get.split(/\s*-\s*/)[0].split('.')[2]);
            let ref_secondHalf = crf2get.split(/\s*-\s*/)[1].split('.');
            
            //e.g., Gen.1.3-Gen.1.6
            if (ref_secondHalf.length > 1) {
                chp2 = Number(ref_secondHalf[1]);
                vrs2 = Number(ref_secondHalf[2]);
                chpRange = Array.from({length: chp2 - chp1 + 1 }, (_, i) => i + chp1);
                const chpVrsRanges = {};
                chpRange.forEach((cv,i)=>{
                    if(cv==chp1){chpVrsRanges[cv]=[vrs1,bible.Data.verses[bibleDataBkIndx][cv-1]]}
                    else if(cv==chp2){chpVrsRanges[cv]=[1,vrs2]}
                    else {chpVrsRanges[cv]=[1,bible.Data.verses[bibleDataBkIndx][cv-1]]}
                })
                return chpVrsRanges
            }
            //e.g., Gen.1.3-6
            else {
                chp2 = chp1;
                vrs2 = Number(ref_secondHalf[0]);
            }
        } else {// If it is a single verse
            vrs1 = Number(crf2get.split('-')[0].split('.')[2]);
            vrs2 = vrs1;
        }
        return {[chp1]:[vrs1,vrs2]}
        // return [vrs1,vrs2]
    }
    async function getVersesInVerseRange(vRange){
        let vrs1 = vRange[0];
        let vrs2 = vRange[1];
        if(bkn){bookName=bkn;}
        let b_vn='';
        if(bvName){b_vn=`-${bvName}`;}
        let verseSpan;
        // e.g., 11-28
        if (vrs1 <= vrs2) {
            for (i = vrs1; i < vrs2 + 1; i++) {
                verseSpan = document.createElement('span');
                await vNum(i);
            }
        }
        // e.g., 28-11
        else if (vrs1 > vrs2){
            for (i = vrs1; i > vrs2 - 1; i--) {
                verseSpan = document.createElement('span');
                await vNum(i);
            }
        }
        async function vNum(i) {
            const verifiedRef = bible.parseReference(bk + ' ' + chp1 + ':' + i);
            chp1 = verifiedRef.chapter1;
            const _i = verifiedRef.verse1;
            if(prv_i==_i){return}
            prv_i = _i;
            
            let verseNum = document.createElement('code');
            verseNum.setAttribute('ref', fullBkn + ' ' + (chp1) + ':' + _i);
            verseNum.setAttribute('aria-hidden', 'true'); //so that screen readers ignore the verse numbers
            verseNum.prepend(document.createTextNode(`[${(bk)} ${(chp1)}:${_i}${b_vn}]`))
            // verseNum.title = b_v + ' ' + fullBkn + chp1 + ':' + i;
            verseSpan.classList.add('verse');

            let vText;
            let _bvnm = bvName ? bvName : bversionName;
            // book is from apochrypha, temporarily switch to an apocrypha version
            // (Apocryphal version must already be loaded. Could improve it so that it fetches it if it is not loaded)
            const prv_bversion = bversionName;
            if (bible.Data.apBooks.includes(fullBkn)){
                const apVersions = bible.apocryphaBibleVersions();
                if (!apVersions.includes(_bvnm)) {
                    _bvnm = apVersions[0];
                    bversionName = _bvnm;
                    setTimeout(() => {bversionName = prv_bversion;}, 100);
                }
            }
            if (!window[_bvnm]) { //if the version has not been loaded, temporarily load it
                console.log('no apocrypha');
                vText = await getVerseByFetch(_bvnm);
                bversionName = _bvnm;
                setTimeout(() => {bversionName = prv_bversion;}, 5000);
            } else {
                vText = window[_bvnm]?.[fullBkn]?.[chp1 - 1]?.[_i - 1];
            }
            verseSpan.classList.add('v_'+_bvnm);
            if(vText){
                if (bible.isRtlVersion(bversionName,fullBkn)==true) {
                    verseSpan.classList.add('rtl');
                }
                vHolder.append(parseVerseText(vText, verseSpan));
                verseSpan.prepend(' ');
                verseSpan.prepend(verseNum);
                verseSpan.innerHTML = br + verseSpan.innerHTML;
                br='';//Divider is only added at the start of the comma separated group, so once added, remove it
            }
            async function getVerseByFetch(_bvnm) {
                let request_Version_URL;
                if (window.location.protocol !== 'file:') {
                    // In browser
                    request_Version_URL = `../bibles/${_bvnm}.json`;
                } else {
                    // In Electron.js
                    const fullPathHead = document.querySelectorAll('body')[0].baseURI.split('resources/app')[0];
                    request_Version_URL = fullPathHead + `resources/app/src/bibles/${_bvnm}.json`;
                }
                let response = await fetch(request_Version_URL);
                if (!response.ok) throw new Error(`Failed to load ${_bvnm}.json`);
                const responseBook = await response.json();
                window[_bvnm] = responseBook.books;                
                vText = window[_bvnm]?.[fullBkn]?.[chp1 - 1]?.[prv_i - 1];
                return vText
            }
            async function getVerseByFetch(_bvnm) {
                let request_Version_URL;
                if (window.location.protocol !== 'file:') {
                    // In browser
                    request_Version_URL = `../bibles/${_bvnm}.json`;
                } else {
                    // In Electron.js
                    const fullPathHead = document.querySelectorAll('body')[0].baseURI.split('resources/app')[0];
                    request_Version_URL = fullPathHead + `resources/app/src/bibles/${_bvnm}.json`;
                }

                let response = await fetch(request_Version_URL);
                if (!response.ok) throw new Error(`Failed to load ${_bvnm}.json`);
                const responseBook = await response.json();
                window[_bvnm] = responseBook.books;                
                vText = window[_bvnm]?.[fullBkn]?.[chp1 - 1]?.[prv_i - 1];
                return vText
            }
        }
    }
    createTransliterationAttr(vHolder);
    return vHolder;
}
pagemaster.addEventListener('keydown',compareThisSearchVerse)
/* COMPARE THIS SEARCH VERSE */
async function compareThisSearchVerse(e){
    if(e.button==undefined){return};//any keydown will trigger this function so ensure there is a mouse click accompanying it or it will try to load a bible version
    let dis = e.target;
    let v = elmAhasElmOfClassBasAncestor(dis,'.verse');
    let notedClass = v.classList.contains('noted') ? 'noted':'verse';
    
    let bvNme = dis.getAttribute('b_version');

    // Check if current Bible Version has already been compared
    if(!window[bvNme]){await loadVersion(bvNme)}
    
    // middleMouseButton or Right-click event (change the bible version)
    if (e.button==1 || (!e.ctrlKey && e.button==2)) {changeLoadedVersion(v,dis)}
    
    // Ctrl + Right-click (change just the verse)
    else if (e.ctrlKey && e.button==2) {changeLoadedVersion(v,dis,true)}
    
    // Left-click with NO ctrlkey (show the compare verse for just this verse)
    else if (!e.ctrlKey && e.button==0) {singleVerse(v,dis,null,notedClass)}
    
    // Ctrl + left-click (show all compare verses for clicked bible version)
    else if ((e.ctrlKey && e.button==0)) {
        //get all the verses in parent window
        let parentWindow = dis.closest('#context_menu');
        if(!parentWindow){parentWindow = dis.closest('#searchPreviewFixed, .compare_verses')}
        let versionCompareBtns = parentWindow.querySelectorAll('.compare_withinsearchresult_button[b_version='+bvNme+']')
        let addORremove = 'add';
        if(dis.classList.contains('green_active')){addORremove = 'remove';}// Remove all
        versionCompareBtns.forEach((cmpBtn,i) => {
            let run_twordsArr = (i==versionCompareBtns.length-1)?true:false;
            let v = elmAhasElmOfClassBasAncestor(cmpBtn,'.verse');
            let notedClass = v.classList.contains('noted') ? 'noted':'verse';
            singleVerse(v,cmpBtn,addORremove,notedClass,run_twordsArr);
        });
    }

    function changeLoadedVersion(v,dis,just1verse){
        let vParent = v.parentElement;
        let bvNme = dis.getAttribute('b_version');
        let nonCompVerses = [v];
        if (!just1verse) {
            nonCompVerses = vParent.querySelectorAll('.verse:not(.verse_compare)');//get all verses that are not compare verses
        }
        nonCompVerses.forEach(v => {
            const oldcrfnnote = v.querySelector('.crfnnote').cloneNode(true);//get the crfnnote
            oldcrfnnote.querySelector('.cbv').classList.remove('cbv');//former cbv (current bible version)
            oldcrfnnote.querySelector(`[b_version="${bvNme}"]`).classList.add('cbv');//former cbv (current bible version)
            const vccls = v.classList.contains('verse_compare');//check if v has verse_compare class
            const vref = v.querySelector('code[ref]').getAttribute('ref');
            const vrefBtn = v.querySelector('code[ref] button.closebtn');
            const vrefBtn_clone = vrefBtn ? vrefBtn.cloneNode(true) : null;
            const newVerse = createSingleVerseFromREFandVERSION(vref,bvNme);
            vccls ? newVerse.classList.add('verse_compare', notedClass) : null;
            let vinfrag = newVerse.querySelector('.verse');
            Array.from(v.classList).forEach(c=>{if(!/v_/.test(c)){vinfrag.classList.add(c)}})//get all the classes of v and assign to newVerse (to ensure displaynone class is not removed from newverse if it is present in old v)
            vinfrag.append(oldcrfnnote)//append old crfnnote to new v
            let refcodeinv = vinfrag.querySelector('[ref]');
            refcodeinv.innerText = `(${bvNme})${refcodeinv.innerText}`;//add version to reference text
            vParent.insertBefore(newVerse, v)//replace old v with new verse
            vrefBtn_clone ? refcodeinv.prepend(vrefBtn_clone) : null;
            transliteratedWords_Array.forEach(storedStrnum=>{showTransliteration(storedStrnum,vParent)});
            
            // prevent contextmenu on strong's word in new verse
            vParent.classList.add('ignorecmenu');
            setTimeout(() => {vParent.classList.remove('ignorecmenu');}, 150);
            v.remove()//remove old verse 
            //If it is context menu, replace the version name of the reference
            if((!just1verse && vParent.closest('#context_menu')) || !vParent.querySelector(`.verse:not(.verse_compare):not(.v_${bvNme})`)){
                let cmtitlebarTextNode = context_menu.querySelector('.cmtitlebar').childNodes[0];
                cmtitlebarTextNode.textContent = cmtitlebarTextNode.textContent.replace(/\s*\[[^\]]+\]/,` [${bvNme}]`)
            }
            //change the general book version
            if (!just1verse) {bversion=bvNme; bversionName=bvNme;}
        });
    }
    function singleVerse(v,dis2,addORremove,notedClass,run_twordsArr=true){
        let vref = v.querySelector('code[ref]').getAttribute('ref');
        let bvNme = dis2.getAttribute('b_version');
        let vrefModified = vref.replace(/[:.]+/,'_');

        // Check if current Bible Version has already been compared
        const prevComparedVerse = v.parentElement.querySelector('.verse_compare[ref="' + vrefModified + ' ' + bvNme + '"]')
        if(((addORremove && addORremove=='remove') || !addORremove) && prevComparedVerse){
            if(addORremove && addORremove=='add'){return}
            prevComparedVerse.remove();
            dis2.classList.remove('green_active');
            if(!v.nextElementSibling || !v.nextElementSibling.matches('.verse_compare')){v.classList.remove('vrs_bein_comp')};
            return
        } else if(addORremove && addORremove=='remove'){return}

        let newVerse = createSingleVerseFromREFandVERSION(vref, bvNme);
        let newVerseInner = newVerse.querySelector('.verse');
        newVerseInner.prepend(createNewElement('button','.closebtn','.cmenu_closebtn', '[onclick=removeCompareVerse(this)]'));
        newVerseInner.classList.add('verse_compare', notedClass);
        newVerseInner.setAttribute('ref', vrefModified + ' ' + bvNme);
        const codeEl = newVerseInner.querySelector('code[ref]');
        if (codeEl) {codeEl.innerText = codeEl.innerText.replace(/\[/, `[${bvNme} `);}
        insertElmAafterElmB(newVerse, v);
        if (run_twordsArr) {
            transliteratedWords_Array.forEach(storedStrnum=>{showTransliteration(storedStrnum)});
        }
        dis2.classList.add('green_active');
        v.classList.add('vrs_bein_comp');
        if(v.matches('.displaynone')){newVerseInner.classList.add('displaynone')}
    }
    function createSingleVerseFromREFandVERSION(vref, bvNme) {
        let vrefObj = breakDownRef(vref);
        let new_bk = vrefObj.bn;
        let new_chp = vrefObj.bc;
        let new_vn = vrefObj.cv;
        let fullBkn = fullBookName(new_bk).fullBkn;
        newRef2get = `${new_bk} ${new_chp}:${new_vn}`;
        let newVerse = createSingleVerse(new_bk, new_chp, new_vn, fullBkn, bvNme);
        createTransliterationAttr(newVerse)
        return newVerse;
    }
}
/* GETTING PREVIOUS OR NEXT VERSE */
function cmenu_goToPrevOrNextVerse(prvNxt, searchWindowVerse, shiftKey, eTarget){

    let new_bk,new_chp,new_vn,fullBkn,b_version_n;
    let allcmVerses;
    let isC=0;
    let verses_section = eTarget?.closest('.verses_section');
    
    if (!searchWindowVerse) {
        verses_section = verses_section ? verses_section : context_menu;
        allcmVerses = verses_section.querySelectorAll('.verse:not(.verse_compare)');
        searchWindowVerse = verses_section;
        isC=1;
    } else {
        allcmVerses = searchWindowVerse;
    }
    /* replace the topmost verse */
    let v;
    
    if (prvNxt=='prev') {
        v = allcmVerses[0];
        let vref = v.querySelector('code[ref]').getAttribute('ref');
        let vrefObj = breakDownRef(vref);
        let newRef2get;
        /* Not the First Verse */
        if(vrefObj.cv>1){
            new_bk=vrefObj.bn;
            new_chp=vrefObj.bc;
            new_vn=vrefObj.cv-1;
            fullBkn=fullBookName(new_bk).fullBkn;
            newRef2get=`${new_bk} ${new_chp}:${new_vn}`;
        }
        /* *********************** IF FIRST VERSE ********************** */
        /* Go to last verse in previous chapter if it is not chapter one */
        /* ************************************************************* */
        else if(vrefObj.cv==1 && vrefObj.bc>1){
            new_bk=vrefObj.bn;
            new_chp=vrefObj.bc-1;
            new_vn=lastVerseInPrevChpt(new_chp);
            fullBkn=fullBookName(new_bk).fullBkn;
            newRef2get=`${new_bk} ${new_chp}:${new_vn}`;
        }
        /* **************** IF FIRST CHAPTER *************** */
        /* Go to last verse in last chapter of previous book */
        /* ************************************************* */
        else if(vrefObj.cv==1 && vrefObj.bc==1){
            let prvBk;
            let bkIndx=fullBookName(vrefObj.bn).bkIndex;
            if (bkIndx>1) {// Not Genesis
                prvBk=bible.Data.bookNamesByLanguage.en[bkIndx-1];
                bkIndx=bkIndx-1
            } else {return}
            let lastChptInBk = bible.Data.verses[bkIndx].length;
            let lastVerseInlastChptInBk = bible.Data.verses[bkIndx][lastChptInBk-1];
            new_bk=prvBk;
            new_chp=lastChptInBk;
            new_vn=lastVerseInlastChptInBk;
            fullBkn=fullBookName(new_bk).fullBkn;
            newRef2get=`${new_bk} ${new_chp}:${new_vn}`;
        }
        function lastVerseInPrevChpt(chpt){
            return bible.Data.verses[fullBookName(vrefObj.bn).bkIndex][chpt-1]
        }
    }
    else if(prvNxt=='next'){
        v = allcmVerses[allcmVerses.length-1];
        let vref = v.querySelector('code[ref]').getAttribute('ref');
        let vrefObj = breakDownRef(vref);
        let currentBookIndx = fullBookName(vrefObj.bn).bkIndex;
        let lastVerseInChapter=bible.Data.verses[currentBookIndx][vrefObj.bc-1];
        let lastChapterInBook=bible.Data.verses[currentBookIndx].length;
        /* ************************************************* */
        /* ******* Go to the next verse in chapter  ******** */
        /* ******* If Not the Last Verse in Chapter ******** */
        /* ************************************************* */
        if(vrefObj.cv < lastVerseInChapter){
            new_bk=vrefObj.bn;
            new_chp=vrefObj.bc;
            new_vn=vrefObj.cv+1;
            fullBkn=fullBookName(new_bk).fullBkn;
        }
        /* ************************************************ */
        /* ******* Go to first verse in next chapter ****** */
        /* If this is the last verse in the current chapter */
        /* ************************************************ */
        else if(vrefObj.cv == lastVerseInChapter){
            if(vrefObj.bc < lastChapterInBook){
                new_bk=vrefObj.bn;
                new_chp=vrefObj.bc+1;
                new_vn=1;
                fullBkn=fullBookName(new_bk).fullBkn;
            }
            /* Go to the next book */
            else if(vrefObj.bc == lastChapterInBook){
                let nextBookIndx = currentBookIndx + 1;
                // If it is not Revelation
                if (nextBookIndx < 65) {
                    new_bk=bible.Data.bookNamesByLanguage.en[nextBookIndx];
                    new_chp=1;
                    new_vn=1;
                    fullBkn=fullBookName(new_bk).fullBkn;
                }
                else {return}
            }
        }
    }
    b_version_n=Array.from(v.classList).find(c=>c.startsWith('v_')).replace(/v_/,'');
    if(!b_version_n){b_version_n=bversionName}
    let newVerseDocFrag=createSingleVerse(new_bk,new_chp,new_vn,fullBkn,b_version_n);
    createTransliterationAttr(newVerseDocFrag);
    /* ************ */
    /* Add CrossRef */
    /* ************ */
    let tskHolder=crfnnote_DIV(newVerseDocFrag);
    if(isC&&!context_menu.matches('.showingXref')){
        tskHolder.classList.add('displaynone');
        context_menu.classList.remove('showingXref');
    }
    newVerse=newVerseDocFrag.querySelector('span.verse');
    newVerse.append(tskHolder);

    let vcdRef = newVerse.querySelector('code[ref]');
    (shiftKey || v.querySelector('code .closebtn')) ? (vcdRef.prepend(createNewElement('button', '.closebtn', '.cmenu_closebtn', '[onclick=removeCompareVerse(this)]'))) : null;//Let closeBtn inside codeRef

    /* Copy all the classes of the former verse */
    newVerse.setAttribute('class',v.getAttribute('class'));
    if(newVerse.classList.contains('verse_compare')){
        let vrefModified = newVerse.querySelector('code[ref]').getAttribute('ref').replace(/[:.]+/,'_');
        newVerse.setAttribute('ref', vrefModified + ' ' + b_version_n);
        newVerse.querySelector('code[ref]').innerText=newVerse.querySelector('code[ref]').innerText.replace(/\[/,'['+b_version_n+' ');
        newVerse.prepend(createNewElement('button','.closebtn','.cmenu_closebtn', '[onclick=removeCompareVerse(this)]'));
    }
    if (prvNxt=='prev') {
        // Prepend New Verse Above Highest Verse
        insertElmAbeforeElmB(newVerse, v);
        // Remove the Last Vere in the ContextMenu
        let lastVerse=allcmVerses[allcmVerses.length-1];
        // Remove all verse_compare that are attached to the verse to be removed
        if(isC && !shiftKey){
            while(lastVerse.nextElementSibling && lastVerse.nextElementSibling.matches('.verse_compare')){lastVerse.nextElementSibling.remove()}
        }
        !shiftKey ? lastVerse.remove() : null;
    }
    else if(prvNxt=='next'){
        let w=v;
        // Append New Verse After Lowest Verse
        if(isC && !shiftKey){
            while(w.nextElementSibling && w.nextElementSibling.matches('.verse_compare')){w=w.nextElementSibling}
        }
        insertElmAafterElmB(newVerse, w);
        /* // Shift all the verses upwards avoiding the .verse_compare
        allcmVerses.forEach((vrs,i) => {
            if (i > 0) {
                let existingNode=allcmVerses[i-1];
                existingNode.parentElement.insertBefore(vrs.cloneNode(true), existingNode.nextElementSibling)
                vrs.remove();
            }
        }); */
        // Remove the first Vere in the ContextMenu
        let firstVerse=allcmVerses[0];
        // Remove all verse_compare that are attached to the verse to be removed
        if(isC && !shiftKey){
            while(firstVerse.nextElementSibling && firstVerse.nextElementSibling.matches('.verse_compare')){firstVerse.nextElementSibling.remove()}
        }
        !shiftKey ? firstVerse.remove() : null;
    }
    // newVerse.scrollIntoView({'behavior':'smooth'});
    // newVerse.scrollIntoViewIfNeeded();
    /* ************************* */
    /* Show Transliterated Words */
    /* ************************* */
    transliteratedWords_Array.forEach(storedStrnum=>{showTransliteration(storedStrnum/* ,searchWindowVerse */)});
    let cmenuVerses = context_menu.querySelectorAll('span.verse')
    for (const spanVerse of cmenuVerses) {
        spanVerse.classList.remove('user1note','noted');
        spanVerse.setAttribute('class', spanVerse.getAttribute('class').replace(/marker_[^\s]+\s*/g, ''));
        const [bN, bC, cV] = spanVerse.querySelector('[ref]').getAttribute('ref').split(/[(?<=\s)(?<=:)](?=\d)/);
        // checkAndIndicateThatVerseHasNote(bN,bC,cV,spanVerse).notes;// Check if Verse Has Note;
    };
    // createTransliterationAttr(newVerse)
    updateRefsInVerseSectionHeading(verses_section);
}
function createSingleVerse(bk,chp,vn,fullBkn,bversionName){
    let vHolder = new DocumentFragment();
    let verseNum = document.createElement('code');
    let verseSpan = document.createElement('span');
    let vText;
    verseNum.setAttribute('ref', fullBkn + ' ' + (chp) + ':' + vn);
    verseNum.setAttribute('aria-hidden', 'true'); //so that screen readers ignore the verse numbers
    // Get BookName Abreviation
    let bkShort = bible.Data.books[bible.Data.bookNamesByLanguage.en.indexOf(fullBkn)][1];
    bkShort=bkShort.toLowerCase().replace(/[0-9]*\s*([a-z])/, (v)=>{return v.toUpperCase()})
    verseNum.prepend(document.createTextNode(`[${(bkShort)} ${(chp)}:${vn}]`));
    verseSpan.classList.add('verse');
    if(!window[bversionName]){loadVersion(bversionName);};
    
    // If the Bible Book does not exist in the version, e.g., apocrypha book in regular kjv
    if (!window[bversionName][fullBkn]) {
        // let emptyVerse = document.createElement('span');
        // emptyVerse.classList.add('verse');
        vHolder.append(verseSpan);
        verseSpan.prepend(' ');
        verseNum.removeAttribute('ref');
        verseNum.innerHTML += (` not avaible in “<b>${bversionName}</b>”.`);
        verseSpan.prepend(verseNum);
        return vHolder
    }

    vText = window[bversionName][fullBkn][chp - 1][vn - 1];
    verseSpan.classList.add('v_'+bversionName);
    if (bible.isRtlVersion(bversionName,fullBkn)==true) {
        verseSpan.classList.add('rtl');
        // verseNum.prepend(document.createTextNode(`[${vn}:${(chp)} ${(bkShort)}]`));
    }
    // else{verseNum.prepend(document.createTextNode(`[${(bkShort)} ${(chp)}:${vn}]`))}
    vHolder.append(parseVerseText(vText, verseSpan));
    verseSpan.prepend(' ');
    verseSpan.prepend(verseNum);
    // createTransliterationAttr(vHolder)
    return vHolder
}
/* ******************************************************** */
/* CONVERT REFERENCES & STRONGS NUMBERS TO CLICKABLE FORMAT */
/* ******************************************************** */
replaceAllStrongsAndRefs();
function replaceAllStrongsAndRefs(xtx, proofEditText = true) {
    // Handle exempt elements - check if global exists and provide fallback
    const exemptArray = (typeof elms2exempt4rm_refsNstrnumsReplace !== 'undefined') 
        ? elms2exempt4rm_refsNstrnumsReplace 
        : null;
    
    // Set default target if none provided
    const targetElement = xtx || document.body;
    
    /**
     * Check if an element matches any exempt selector
     */
    function isExemptElement(element) {
        if (!exemptArray || !Array.isArray(exemptArray)) {
            return false;
        }
        
        try {
            return exemptArray.some(selector => {
                if (typeof element.matches === 'function') {
                    return element.matches(selector);
                }
                return false;
            });
        } catch (error) {
            console.warn('Error checking exempt selectors:', error);
            return false;
        }
    }
    
    /**
     * Create a TreeWalker to find text nodes, similar to the original generateRefsInNote
     */
    const walker = document.createTreeWalker(
        targetElement, 
        NodeFilter.SHOW_TEXT, 
        {
            acceptNode(node) {
                // Skip text nodes in SVG or exempt elements
                for (let p = node.parentNode; p && p !== targetElement; p = p.parentNode) {
                    if (p.nodeName.toLowerCase() === 'svg' || 
                        p.nodeName.toLowerCase() === 'text' ||
                        (exemptArray && isExemptElement(p))) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    // Skip nodes already wrapped in reference spans
                    if (typeof p.matches === 'function' && p.matches('span[ref]')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    // Group adjacent text nodes (just like the original generateRefsInNote)
    let textGroups = [];
    let currentGroup = null;

    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!currentGroup || node.previousSibling !== currentGroup[currentGroup.length - 1]) {
            currentGroup = [];
            textGroups.push(currentGroup);
        }
        currentGroup.push(node);
    }

    // Process each group as a single string (preserving the original logic)
    for (const group of textGroups) {
        if (group.length === 0) continue;

        try {
            // Combine text content of the group
            const combinedText = group.map(node => node.textContent).join('');
            let normalizedText = combinedText
                .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
                .replace(/&ZeroWidthSpace;|&#8203;/gi, '')
                .replace(/&nbsp;|&#160;/gi, ' ')
                .replace(/\s+/gi, ' ');

            // Generate new HTML for the combined text
            const processedHtml = generateRefsInNote(normalizedText, false, proofEditText);

            // Only replace if content actually changed
            if (processedHtml !== normalizedText) {
                const firstNode = group[0];
                const parent = firstNode.parentNode;
                
                if (!parent) continue;
                
                // Create fragment with new content
                const fragment = document.createDocumentFragment();
                const tempContainer = document.createElement('div');
                tempContainer.innerHTML = processedHtml;
                
                while (tempContainer.firstChild) {
                    fragment.appendChild(tempContainer.firstChild);
                }
                
                // Insert new content before the first node in the group
                parent.insertBefore(fragment, firstNode);
                
                // Remove all original nodes in the group
                for (const node of group) {
                    if (node.parentNode) {
                        node.parentNode.removeChild(node);
                    }
                }
            }
        } catch (error) {
            console.error('Error processing text node group:', error, group);
        }
    }
}
function replaceREFandSTRNUM_with_InnerTEXT(targetParentElm=document) {
    targetParentElm.querySelectorAll('span[ref],span[strnum]').forEach(rt => {
        
        const innerTextValue = rt.innerText;
        const textNode = document.createTextNode(innerTextValue);
        rt.parentNode.replaceChild(textNode, rt);
    });
}
/* *********************************** */
/* Change Verse on Scroll Over CodeRef */
/* *********************************** */
document.body.addEventListener("wheel",wheelDirection,{passive:false});
function wheelDirection(e) {
    let eShitKeyOrMouseDown = e.buttons===2 || e.shiftKey;
    // VERSE(S) IN CONTEXTMENU
    if(e.target.matches('#context_menu:not([strnum]) .verse:not(.verse_compare) code[ref]')){
        e.preventDefault();
        if(e.deltaY<0){cmenu_goToPrevOrNextVerse('prev',undefined,eShitKeyOrMouseDown, e.target)}
        else if(e.deltaY>0){cmenu_goToPrevOrNextVerse('next',undefined,eShitKeyOrMouseDown, e.target)}
    }
    // VERSE (SINGLE) IN SEARCH WINDOW OR TRANSLATION_COMPARE
    else if(e.target.matches('#searchPreviewFixed > .verse code[ref], #context_menu:not([strnum]) .verse.verse_compare code[ref], #scriptureCompare_columns_holder .verse.verse_compare code[ref]')){
        e.preventDefault();
        let targetVerseInsearchWindow = [elmAhasElmOfClassBasAncestor(e.target,'.verse')];
        if(e.deltaY<0){cmenu_goToPrevOrNextVerse('prev',targetVerseInsearchWindow,eShitKeyOrMouseDown, e.target)}
        else if(e.deltaY>0){cmenu_goToPrevOrNextVerse('next',targetVerseInsearchWindow,eShitKeyOrMouseDown, e.target)}
    }
    // VERSE (ONE OR MORE) IN COMPARE SECTION
    else if(e.target.matches('#scriptureCompare_columns_holder .verse code[ref]')){
        e.preventDefault();
        let parentCopareVersesDiv = e.target.closest('.compare_verses');
        let allVersesInCompareDiv = parentCopareVersesDiv.querySelectorAll('.verse')
        let targetVerseInsearchWindow = allVersesInCompareDiv;
        if(e.deltaY<0){cmenu_goToPrevOrNextVerse('prev',targetVerseInsearchWindow,eShitKeyOrMouseDown, e.target)}
        else if(e.deltaY>0){cmenu_goToPrevOrNextVerse('next',targetVerseInsearchWindow,eShitKeyOrMouseDown, e.target)}
    }
}
// Add touch event listeners
// Add touch event listeners
document.addEventListener('pointerdown', handleTouchStart);
function handleTouchStart(ev) {
    if ([1,2].includes(ev.button) || !ev.target.matches('.verse code[ref]')) return;
    ev.preventDefault(); // Prevent any default behavior
    let originalPointerType = ev.pointerType;//'touch', 'mouse', 'pen'
    
    if (!document.getElementById('disable-touch-action')) {
        const taStyle = document.createElement('style');
        taStyle.id = 'disable-touch-action';
        taStyle.textContent = `* { touch-action: none !important; }`;
        document.head.appendChild(taStyle);
    }
    
    // Track touch position
    const throttleDelay = 100; // adjust as needed
    let lastExecution = 0;
    let touchStartX = ev.clientX;
    let touchStartY = ev.clientY;
    let lastTouchX = touchStartX;
    let lastTouchY = touchStartY;
    
    // Store the original target to maintain context
    const originalTargetParent = ev.target.closest('.verses_section');
    const targetElms = originalTargetParent.getElementsByTagName('code');

    document.addEventListener('pointermove', handleTouchMove);
    document.addEventListener('pointerup', handleTouchEnd);
    
    function handleTouchMove(e) {
        // Always prevent default to stop scrolling
        if (e.pointerType !== originalPointerType) {handleTouchEnd(e); return};

        e.preventDefault();
        const currentX = e.clientX;
        const currentY = e.clientY;
        // const deltaX = Math.abs(currentX - lastTouchX);
        const deltaX = 0;
        const deltaY = Math.abs(lastTouchY - currentY);
        
        // Minimum movement to trigger action
        if (deltaY > 10 /* || deltaX > 15 */) {
            // Throttle continuous triggers
            const now = Date.now();
            if (now - lastExecution >= throttleDelay) {
                // Determine if movement is more horizontal than vertical
                const isHorizontal = deltaX*1.5 > deltaY;
                
                // Create a synthetic event object similar to wheel event
                const syntheticEvent = {
                    target: targetElms[0],
                    deltaY: (lastTouchY - currentY) * -1,
                    buttons: 0,
                    shiftKey: isHorizontal,
                    preventDefault: () => {}
                };
                wheelDirection(syntheticEvent);
                lastExecution = now;
                lastTouchX = currentX;
                lastTouchY = currentY; // Update for next movement
            }
        }
    }
    
    function handleTouchEnd(e) {
        e?.preventDefault();
        document.getElementById('disable-touch-action')?.remove();
        document.removeEventListener('pointermove', handleTouchMove);
        document.removeEventListener('pointerup', handleTouchEnd);
    }
}
/* ************************** */
/* FOR VERSE COMPARE CLOSEBTN */
/* ************************** */
function removeCompareVerse(dis){
    let v_c = dis.closest('.verse');
    let verses_section = dis?.closest('.verses_section');
    // if(v_c.closest('#context_menu').querySelectorAll('.verse').length==1){return}//if it is the only verse in context_menu, don't close // Used CSS to disable it instead
    let vCl=Array.from(v_c.classList)?.find(c=>c.startsWith('v_'))?.replace(/v_/,'');
    let v_origin=v_c.previousElementSibling;
    let v_cps=v_origin;
    while (v_cps && v_cps.matches('.verse')) {
        if(v_cps.querySelector(`[b_version=${vCl}].green_active`)){v_origin=v_cps; break}
        else{v_cps=v_cps.previousElementSibling}
    }
    const v = v_origin?.querySelector(`button.compare_withinsearchresult_button[b_version=${vCl}]`);
    v ? v.classList.remove('green_active') : null;
    v_c.remove();
    updateRefsInVerseSectionHeading(verses_section);
}
function updateRefsInVerseSectionHeading(eTarget) {
    let verses_section = eTarget?.closest('.verses_section');
    if (verses_section) {
        let refString = '';
        verses_section.querySelectorAll('code[ref]').forEach((cdref,i)=>{
            if (i>0) {refString += ';';}
            refString += cdref.innerText.replace(/[\]\[]+/g,'');
        })
        let v_section_heading = verses_section?.previousElementSibling;
        if (v_section_heading?.matches('.context_menu > :is(h1,h2,h3,h4,h5,h6)')) {
            const reducedREF = minimalBibleReference(refString);
            let updated_refs = v_section_heading?.querySelector('.updated_refs');
            if (!updated_refs) {
                let updated_refs_span = createNewElement('span','.updated_refs_span');
                v_section_heading.innerText = v_section_heading.innerText + ' ';
                updated_refs_span.innerHTML = v_section_heading.innerHTML;
                updated_refs = createNewElement('code','.updated_refs');
                updated_refs.innerText = ' - (' + reducedREF + ')';
                updated_refs_span.append(updated_refs);
                v_section_heading.innerHTML = updated_refs_span.outerHTML;
            }
            else {
                updated_refs.innerText = ' - (' + reducedREF + ')';
            }
        }
    }
}
function elmAhasElmOfClassBasAncestor(a, ancestorsClass, limit = 'BODY') {
    while (a.parentElement && a.parentElement.tagName.toUpperCase() != limit) {
        if (a.parentElement.classList.contains(ancestorsClass) || a.parentElement.matches(ancestorsClass)) {
            return a.parentNode
        }
        a = a.parentElement;
    }
    return false
}
/* ********************************************* */
/*              Scripture Reference              */
/* ********************************************* */
/* ********************************************* */
function refDetails4rmCodeElm(codeElm){
    const ref = codeElm.getAttribute('ref');
    let bC=ref.replace(/[\[\]]+/g,'').replace(/\d*(?:\s*\p{L}+)*[\s.]*(\d+)(:\d+\s*)*/gu,'$1');
    bC = bC.match(/\d+/) ? bC : codeElm.getAttribute('chpt').trim();
    let bkNvrs=ref.split(' ' + bC + ':');
    let bN=bkNvrs[0].trim();
    let cV=bkNvrs[1].trim();
    return { bookName:bN, bookChapter:bC, chapterVerse:cV }
}
function breakDownRef(ref){
    ref=ref.replace(/(\p{L})(\d)/ug,'$1 $2');
    let originalRef = ref;
    ref=ref.replace(/[\[\]]+/g,'');
    ref=ref.replace(/\s+/ig,' ').replace(/\s*([:;,.-])\s*/ig,'$1').replace(/\bI\s/i,1).replace(/\bII\s/i,2).replace(/\bIII\s/i,3).replace(/\bIV\s/i,4).replace(/\bV\s/i,5);
    ref=ref.replace(/:([0-9]+)/,'.$1').replace(/(\w)[\s*]([0-9]+)/,'$1.$2').split('.');
    let bn=ref[0];
    let bc=Number(ref[1]);
    let v=ref.length>2 ? ref[2].split(/\s*-\s*/) : [1,bible.Data.verses[bible.parseReference(bn).bookID - 1][bc-1]];//If the ref contains only chapter, make the verse range all the verses in the chapter
    let cv=Number(v[0]);
    let cv2=Number(v[1])?Number(v[1]):null;
    let fullBkn = fullBookName(bn).fullBkn;
    bn = fullBookName(bn).shortBkn;
    let bn_reg = new RegExp(`${bn}`,'ig');
    let fullChpt = !/:|(?:(?:\s|\.)\d+\.\d+)/.test(originalRef) ? `${bn} ${bc}:${cv}-${cv2}` : originalRef.replace(bn_reg,bn);
    fullChpt = fullChpt.trim();
    let standardizedfullref = fullChpt.replace(/[.\s+](\d+)\.(\d+)/g,' $1:$2');
    // let shortBknFullRef = standardizedfullref.replace(/\b[^\d]+(.+)/, bn+' $1')
    let shortBknFullRef = standardizedfullref.replace(/^\d*[^0-9]*(\d+([:.]\d+.*))/, bn + ' $1')
    standardizedfullref = shortBknFullRef.replace(/.*\s(.+)/, fullBkn + ' $1');
    return {bn,bc,cv,cv2,fullBkn,fullChpt,standardizedfullref,shortBknFullRef}
}
function fullBookName(bkn) {
    let fullBkn;
    let bkIndex;
    let shortBkn;
    bible.Data.books.forEach((bkAbrv, ref_indx) => {
        if (bkAbrv.includes(bkn.toUpperCase())) {
            fullBkn = bible.Data.bookNamesByLanguage.en[ref_indx];
            shortBkn = bkAbrv[0]=='JOB'? 'Job' : bkAbrv[1].toLowerCase().replace(/[0-9]*\s*([a-z])/, (v)=>{return v.toUpperCase()});//Make lowerCase then make first alphabet upperCase
            bkIndex = ref_indx;
        }
    });
    return {fullBkn, bkIndex, shortBkn}
}

/* ***** ******* ***** **** ***** */
/* ***** PARSING VERSE TEXT ***** */
/* ***** ******* ***** **** ***** */
let currentlyParsedVersion = null;
let versionWithRedWordsArray = [];

function parseVerseText(vT, verseSpan) {
    if (Array.isArray(vT)) {
        previousVT=vT;
        vTLength = Object(vT).length;
        let redWordFRAG, redWordSpan, startRed, endRed, restartRed, italicStart=false, italicEnd=true;
        let italicElm;
        vT.forEach((wString, i) => {
            let wordSpan = document.createElement('span');
            let wordSpan1 = document.createElement('span');
            let wordSpan2 = document.createElement('span');
            // For making words of Christ red, for versions that have it, e.g., WEB. (The WEB translation however has issues so I do not use it)
            if (/^""/.test(wString[0]) || (restartRed && versionWithRedWordsArray.includes(currentlyParsedVersion))) {
                startRed = true;
                redWordFRAG = new DocumentFragment()
                redWordSpan = document.createElement('span');
                redWordSpan.classList.add('red');
                /* To ensure it only applies the red word span accross multiple verses for the same translation */
                if (!versionWithRedWordsArray.includes(currentlyParsedVersion)) {
                    versionWithRedWordsArray.push(currentlyParsedVersion);
                }
            };
            if (/""$/.test(wString[0])) {
                endRed = true;
                removeItemFromArray(currentlyParsedVersion, versionWithRedWordsArray)
            };

            if (wString.length == 3) {
                if (wString[2].includes('/')) { //For words such as ["וְ/כָל","Hc/H3605","HC/Ncmsc"]
                    let splt_L = wString[2].split('/');
                    wordSpan1.setAttribute('TH', splt_L[0]);
                    wordSpan2.setAttribute('TH', splt_L[1]);
                } else {
                    wordSpan.setAttribute('TH', wString[2]);
                }
            }
            if (wString.length >= 2) {
                if (wString[0].includes('/')) { //For words such as ["וְ/כָל","Hc/H3605","HC/Ncmsc"]
                    let splt_L = wString[0].split('/')

                    wordSpan1.classList.add('translated');
                    wordSpan1.setAttribute('data-xlit', "");
                    wordSpan1.setAttribute('data-lemma', "");
                    wordSpan1.setAttribute('strnum', wString[1].split('/')[0]);
                    wordSpan1.setAttribute('data-kjv-trans', ' ' + splt_L[0]);
                    wordSpan1.setAttribute('translation', ' ' + splt_L[0]);
                    wordSpan1.innerHTML = splt_L[0];
                    versespanAppender([' ', wordSpan1]);

                    wordSpan2.classList.add('translated');
                    wordSpan2.setAttribute('data-xlit', "");
                    wordSpan2.setAttribute('data-lemma', "");
                    wordSpan2.setAttribute('strnum', wString[1].split('/')[1]);
                    wordSpan2.setAttribute('data-kjv-trans', ' ' + splt_L[1]);
                    wordSpan2.setAttribute('translation', ' ' + splt_L[1]);
                    wordSpan2.innerHTML = splt_L[1];
                    versespanAppender([wordSpan2]);
                } else {
                    // The actual translated text
                    wStringREGEXED = wString[0];
                    italicsStartnEnd(wStringREGEXED)
                    wStringREGEXED = wStringREGEXED.replace(/\{/g, '<sup>');
                    wStringREGEXED = wStringREGEXED.replace(/\}/g, '</sup>');
                    wStringREGEXED = wStringREGEXED.replace(/(^"")|(^")/g, '“');
                    wStringREGEXED = wStringREGEXED.replace(/(""$)|"$/g, '”');
                    
                    // Create its "SPAN" container and set attributes as needed 
                    if (wString[1] != 'added') {//If it has an actual strongs number
                        wordSpan.classList.add('translated');
                        wordSpan.setAttribute('data-xlit', "");
                        wordSpan.setAttribute('data-lemma', "");
                        wordSpan.setAttribute('strnum', wString[1]);
                        // wordSpan.classList.add(wString[1]);
                        wordSpan.setAttribute('data-kjv-trans', ' ' + wStringREGEXED);//add the actual translation as an attribute
                        wordSpan.setAttribute('translation', ' ' + wStringREGEXED);//add the actual translation as an attribute
                        // If it is a Title to a Psalm (**they are in italics in the original document, ABP in particular)
                        if(italicStart==true && italicEnd==false){
                            wordSpan.classList.add('em');
                        }
                        if(italicStart==true && italicEnd==true){
                            italicStart=false;
                            // console.log(wStringREGEXED)
                            wordSpan.classList.add('em');
                            wStringREGEXED=wStringREGEXED+'<hr>'
                        }
                    }

                    // Add the text to the "SPAN" element
                    wordSpan.innerHTML = wStringREGEXED;
                    // Add the "SPAN" element with text in it to the current verse
                    versespanAppender([' ', wordSpan]);
                }
            }
            if (wString.length == 1) {
                let spacebtwwords = ' ';
                // Check if last string of string is a punctuation that should be followed by a space
                if (([".", ",", ":", ";", "?", "]", ")"].includes(wString[0][0]) == true)) {
                    spacebtwwords = '';
                }

                if (wString[0].match(/\{\d\}/)) {// ABP word order number
                    spacebtwwords = ' ';
                    wStringREGEXED = wString[0];
                    wStringREGEXED = wStringREGEXED.replace(/\{/g, '<sup>');
                    wStringREGEXED = wStringREGEXED.replace(/\}/g, '</sup>');
                    verseSpan.append(' ');

                    verseSpan.innerHTML=verseSpan.innerHTML+wStringREGEXED;
                } else {
                    wStringREGEXED = wString[0];
                    //Opening and closing quotations marks
                    wStringREGEXED = wStringREGEXED.replace(/(^"")|(^")/g, '“');
                    wStringREGEXED = wStringREGEXED.replace(/(""$)|"$/g, '”');
                    italicsStartnEnd(wStringREGEXED)
                    if(italicStart==true && italicEnd==false){
                        // console.log('italicsStartnEnd')
                        wordSpan.append(wStringREGEXED);
                        wordSpan.classList.add('em');
                    }
                    if(italicStart==true && italicEnd==true){
                        italicStart=false;
                        wStringREGEXED = wStringREGEXED.replace(/<ii>/g, '')
                        wordSpan.append(wStringREGEXED);
                        wordSpan.append(document.createElement('hr'));
                        wordSpan.classList.add('em');
                        wStringREGEXED=wordSpan;
                    }
                    if (startRed) {
                        redWordFRAG.append(spacebtwwords);
                        redWordFRAG.append(wStringREGEXED);
                        // redWordFRAG.innerHTML=redWordFRAG.innerHTML+wStringREGEXED;
                    } else {
                        verseSpan.append(spacebtwwords);
                        verseSpan.append(wStringREGEXED);
                        // verseSpan.innerHTML=verseSpan.innerHTML+wStringREGEXED;
                    }
                }
                
            }
            verseSpan.innerHTML = verseSpan.innerHTML.replace(/<\/sup> /g, '</sup>').replace(/(([\(\[])\s*)/g, '$2').replace(/NaN/g, '');
        });
        function italicsStartnEnd(wStringREGEXED){
            italicStart
            italicEnd
            if((italicStart==false)&&(/<i>/i.test(wStringREGEXED))){
                // console.log('emS')
                italicStart=true;
                italicEnd=false;
                wStringREGEXED = wStringREGEXED.replace(/<i>/g, '');
            }
            if(/<ii>/i.test(wStringREGEXED)){
                // console.log('emE')
                // console.log(wStringREGEXED)
                italicEnd=true;
                wStringREGEXED = wStringREGEXED.replace(/<ii>/g, '');
                // console.log(wStringREGEXED)
            }
        }
        function versespanAppender(arr) {
            if (redWordFRAG) {
                arr.forEach(a => {
                    redWordFRAG.append(a)
                })
                restartRed = false;
                if (endRed || i == vTLength - 1) {
                    redWordSpan.append(redWordFRAG);
                    verseSpan.append(redWordSpan);
                    endRed = null;
                    startRed = null;
                    if (i == vTLength - 1) {
                        restartRed = true;
                    }
                }
            } else {
                arr.forEach(a => {
                    verseSpan.append(a)
                })
            }
        }
    } else {
        // if (/'missing'/.test(vT)){console.log(vT)}
        vT = vT.replace(/<hi type="bold">/g, '<span class="b">');
        vT = vT.replace(/<hi type="italic">/g, '<span class="i">');
        vT = vT.replace(/<\/hi>/g, '</span>');
        vT = vT.replace(/<ptitle>/g, '<span class="em">');
        vT = vT.replace(/<\/ptitle>/g, '</span><hr>');
        // vT = vT.replace(/^""/g, '<span class="red">');
        // vT = vT.replace(/""/g, '</span>');
        vT = modifyQuotationMarks(vT);
        vT = vT.replace(/ ,/g, ',');
        verseSpan.innerHTML = vT;
    }
    
    return verseSpan;
}
/* FOR CROSS-REFS & NOTES IN SEARCH WINDOW */
function crfnnote_DIV(vHolder){
    let hasXrefs = false;
    const refval = vHolder.querySelector('code[ref]').getAttribute('ref').replace(/(\w)\s([0-9]+)/g, '$1.$2').replace(/:/g, '.');
    
    if (crossReferences_fullName[refval] || TSK[refval]) {hasXrefs = true;}

    const tskBtn = `<button class="verse_crossref_button ${hasXrefs ? '"style="color:maroon;font-style:italic;"' : 'cancel" ' }>x-Ref</button>`
    const noteBtn = '<button class="buttons verse_notes_button" onclick="showNoteForVerseNOTinMainBibleWindow(this)">Note</button>';
    
    let compareBtn='';
    bibleversions_Array.forEach(bversion => {
        bclass = 'class="buttons compare_withinsearchresult_button"';
        if (bversion==bversionName) {
            bclass = 'class="buttons cbv compare_withinsearchresult_button"'
            bversion=`${bversionName}`
        }
        compareBtn += `<button ${bclass} onmouseup="compareThisSearchVerse(event)" b_version="${bversion}">${bversion}</button>`;
    });

    let crfnnote_DIV = document.createElement('DIV');
    crfnnote_DIV.classList.add('crfnnote');
    
    crfnnote_DIV.innerHTML = `<div class="crfnnote_btns ${hasXrefs ? ' title="Not Crossreferenced"' : ''}">${tskBtn}${noteBtn}${compareBtn}</div>`;
    crfnnote_DIV.innerHTML += `<div class="none_mainsection_note"></div>`;
    return crfnnote_DIV
}
/* **** ********** ********* ***** */
/* **** STYLESHEET MODIFIERS ***** */
/* **** ********** ********* ***** */
//STYLE SHEET MODIFIER
function findCSSRule(mySheet, selector) {
    mySheet=mySheet.sheet;
    let ruleIndex = -1; // Default to 'not found'
    let theRules = mySheet.cssRules ? mySheet.cssRules : mySheet.rules;
    for (i = 0; i < theRules.length; i++) {
        if (theRules[i].selectorText == selector) {
            ruleIndex = i;
            break;
        }
    }
    return ruleIndex;
}
//Random color Alternative
//+'#' + (0x1220000 + Math.random() * 0xFF00FF).toString(16).substr(1,6);
function createNewStyleSheetandRule(styleID, styleRule) {
    if (!document.getElementsByTagName('head')[0].querySelector('#' + styleID)) {
        addNewStyle()
    } else {
        document.getElementsByTagName('head')[0].querySelector('#' + styleID).remove();
        addNewStyle()
    }

    function addNewStyle() {
        let headPart = document.getElementsByTagName('head')[0];
        newStyleInHead = document.createElement('style');
        newStyleInHead.id = styleID;
        newStyleInHead.innerHTML = styleRule;
        headPart.append(newStyleInHead);
    }
}
function addRemoveRuleFromStyleSheet(CS_rule, ruleSelector, targetStyleSheet) {
    let highlightStrongsSheet = targetStyleSheet.sheet;
    let allRules = highlightStrongsSheet.cssRules;
    for (let i = 0; i < allRules.length; i++) {
        //Add rule if it doesn't exist
        if (findCSSRule(targetStyleSheet, ruleSelector) == -1) {
            targetStyleSheet.sheet.insertRule(CS_rule, allRules.length - 1);
            // console.log('RULE ADDED')
        }
        //Remove rule if it already exists
        else {
            highlightStrongsSheet.deleteRule(findCSSRule(targetStyleSheet, ruleSelector));
            //Remove stylesheet if there are no more rules in it
            if (allRules.length == 0) {
                targetStyleSheet.remove()
            }
            // console.log('RULE REMOVED')
        }
        break
    }
}
function getAllRulesInStyleSheet(styleSheet) {
    if (styleSheet.sheet) {
        let allRules = styleSheet.sheet.cssRules;
        // let rulesArray = [];
        let rulesArray = '';
        for (let i = 0; i < allRules.length; i++) {
            // rulesArray.push(allRules[i].cssText)
            rulesArray=`${rulesArray}${allRules[i].cssText}`
        };
        // console.log(rulesArray)
        return rulesArray
    }
}
/* **** ***** ******* **** */
/* **** LOCAL STORAGE **** */
/* **** ***** ******* **** */
function setItemInLocalStorage(name, nValue) {
    let cache_strongs=document.querySelector('#cache_strongs');
    let cache_higlights=document.querySelector('#cache_higlights');
    if (name == 'transliteratedWords'/*  && (!cache_strongs||!cache_strongs.checked) */) { //check if in the settings saving to cache for the transliteration words is selected
        localStorage.setItem(name, nValue);
    } else if (name == 'strongsHighlightStyleSheet'/*  && (!cache_higlights||!cache_higlights.checked) */) {
        localStorage.setItem(name, nValue);
    } else {
        localStorage.setItem(name, nValue);
    }
}
function cacheFunctions() {
    if (localStorage.getItem('strongsHighlightStyleSheet')) {
        let headPart = document.getElementsByTagName('head')[0];
        newStyleInHead = document.createElement('style');
        newStyleInHead.id = 'highlightstrongs';
        newStyleInHead.innerHTML = localStorage.getItem('strongsHighlightStyleSheet');
        headPart.append(newStyleInHead);
    }
    if (localStorage.getItem('transliteratedWords')) {
        transliteratedWords_Array = localStorage.getItem('transliteratedWords').split(',');
        transliteratedWords_Array.forEach(storedStrnum => {
            if(/G|H\d+/i.test(storedStrnum)){
                showTransliteration(storedStrnum)
            }
        });
    }
}
/* **************************** */
/* HELPER FUNCTIONS *********** */
/* **************************** */
function getBoxShadowColor(elm){
    // GET FIRST SHADOW COLOR
    // Even if element has more than one box-shadow color, it will only get the first one
    let boxShadowOfElem = window.getComputedStyle(elm, null).getPropertyValue("box-shadow");
    return boxShadowOfElem.split('px')[0].replace(/^.*(rgba?\([^)]+\)).*/,'$1')
}
/* Ensure doublick does not run click eventListner */
function debounce(func, timeout = 300) {
    // function func will only run if it is not clicked twice within 300ms
    var ttt;
    return function () {
        if (ttt) {
            clearTimeout(ttt)
            ttt = undefined;
        } else {
            // console.log('setting Timeout')
            const context = this
            const args = arguments
            ttt = setTimeout(() => {
                func.apply(context, args);
                ttt = undefined;
                // console.log('done & cleared')
            }, timeout)
        }
    }
}
function modifyQuotationMarks(txt){
    // txt = txt.replace(/(<(?:ol|ul)[^>]*?)\s+(class|id|data-[\w-]+)\s*=\s*"(?:[^"]*)"(.*?)>/g, '$1$3>');
    txt = txt.replace(/(<(?:ol|ul)[^>]*?)[^>]*>/g, '$1>');//remove everything inside ol|ul opening tag
    txt = txt.replace(/\((\d+)\/(\d+)\)/ig, '<sup>$1</sup>&frasl;</sub>$2</sub>');//change to fractions
    txt = txt.replace(/displaynone|sld_up/ig, '');
    txt = txt.replace(/class\s*=\s*"\s*"/ig, '');
    txt = txt.replace(/(\n)\s*(\n\s*)+/ig, '$1');
    txt = txt.replace(/(?: data-cke-saved-href="[^"]*")+/ig, '');
    // txt = txt.replace(/(?<=<[^>]+)class\s*(?:[\w>])/ig, '');
    txt = txt.replace(/(?<=<[^>]+)\s*\bclass\b(?:\s*=*\s*(?:(?:'\s*')|(?:"\s*")))*\s*(?=\s*(?:>|\s+))/ig, '');//remove empty classes
    txt = txt.replace(/(?<=<[^>]+)\s*(?:oldHeight|minHeight|oldmaxHeight|hiddingAll)(?:\s*=\s*(['"]).*?\1)?/ig, '');
    txt = txt.replace(/&nbsp;/g, ' ');
    
    // Modify Opening Quotation Marks
    txt = txt.replace(/<\/em><em>/ig, '');
    txt = txt.replace(/(?<!<[^>]*)(.)\.\.\./ig, '$1…');
    txt = txt.replace(/”…/ig, '“…');
    txt = txt.replace(/(\d),\s*(\d+)\s*:\s*(\d)/ig, '$1; $2:$3');
    txt = txt.replace(/(?<!<[^>]*)([\d\w])['‘]([\w…])/ig, '$1’$2');
    txt = txt.replace(/(?<!<[^>]*)(^|[\b\s‘])"/ig, '$1“');
    txt = txt.replace(/(?<!<[^>]*)"([\d\w…‘])/ig, '“$1');
    txt = txt.replace(/(?<!<[^>]*)"([\s.,’])/ig, '”$1');
    txt = txt.replace(/(?<!<[^>]*)([\w\d.,…!’])"/ig, '$1”');
    txt = txt.replace(/(?<!<[^>]*)([\w\d.,…!”])'/ig, '$1’');
    // Modify Closing Quotation Marks 
    txt = txt.replace(/!"/g, '!”');
    txt = txt.replace(/!'/g, '!’');
    txt = txt.replace(/(?<!<[^>]*)(^|[\b\s“])'/ig, '$1‘');
    txt = txt.replace(/(?<!<[^>]*)'([\d\w…“])/ig, '‘$1');
    txt = txt.replace(/(?<!<[^>]*)'([\s.,”])/ig, '’$1');
    txt = txt.replace(/(?<!<[^>]*)([\w\d.,…”])'/ig, '$1’');
    txt = txt.replace(/(?<!<[^>]*)--(?!>)/ig, '—');
    // Remove <br> that comes before block element closing tag
    // txt = txt.replace(/<br>(<\/(p|h\d)>)/ig, '$1');
    txt = txt.replace(/(?<!<[^>]*)(\s+([.,]))/ig, '$2');
    txt = txt.replace(/<span[\s=\":#\w\d]*\">[↵]*<\/span>/ig, '');
    txt = txt.replace(/<(?!rect|circle|ellipse|line|polyline|polygon|text|tspan|textPath|defs|g|use|symbol|marker|pattern|clipPath|mask|filter|foreignObject|td)(\w+)><\/\1>/ig, '');// Remove empty html elements (td is not included)
    // txt = txt.replace(/<(?<tagname>[\w\d]+)><\/\k<tagname>>/ig,'');// Remove empty html elements
    txt = txt.replace(/<span contenteditable="false" data-cke-magic-line="\d+" style="height: \d+px; padding: \d+px; margin: \d+px; display: block; z-index: \d+; color: rgb(\d+, \d+, \d+); font-size: \d+px; line-height: 0px; position: absolute; border-top: \d+px dashed rgb(\d+, \d+, \d+); user-select: none; left: \d+px; right: \d+px; top: \d+px;">  \s*↵\s*<\/span>/ig, '');
    txt = txt.replace(/([^\s>]+)\s*\n*\s+([^\s<]+)/g, '$1 $2').replace(/(“)\s+/g, '$1').replace(/\s+(”)/g, '$1').replace(/\s+([\d\w])/g, ' $1');
    txt = wrapTablesWithRegex(txt);
    return txt
    function wrapTablesWithRegex(html) {
        // Regex to find <table> tags not already wrapped in a direct parent <div>
        const tableRegex = /(?<!<div[^>]*>\s*)(<table\b[^>]*>.*?<\/table>)(?!\s*<\/div>)/gs;
        // Replace unmatched <table> tags with a wrapped version
        return html.replace(tableRegex, '<div class="table-wrapper">$1</div>');
    }
}
function removeItemFromArray(n, array) {
    if(Array.isArray(n)){
        array.forEach((nArr,i) => {
            if(Array.isArray(nArr) && nArr[0]==n[0]){array.splice(i, 1);}
        });
    } else {
        const index = array.indexOf(n);
        // if the element is in the array, remove it
        if (index > -1) {
            // remove item
            array.splice(index, 1);
        }
    }
    return array;
}
function randomColor(brightness) {
    function randomChannel(brightness) {
        var r = 255 - brightness;
        var n = 0 | ((Math.random() * r) + brightness);
        var s = n.toString(16);
    return (s.length == 1) ? '0' + s : s;
    }
    return '#' + randomChannel(brightness) + randomChannel(brightness) + randomChannel(brightness);
}
function insertElmAbeforeElmB(newNode, existingNode) {
    existingNode.parentNode.insertBefore(newNode, existingNode);
}
function insertElmAafterElmB(newNode, existingNode) {
    existingNode.parentNode.insertBefore(newNode, existingNode.nextElementSibling);
}
function relocateElmTo(elm, moveHere) {
    let elmCopy = elm.cloneNode(true);
    elm.remove();
    moveHere.append(elmCopy)
}
function areAllitemsOfAinB(a, b) {
    if (a.every(elem => b.indexOf(elem) > -1)) {
        return true
    } else {
        return false
    }
}
function createNewElement(elmTagName,classIdAttr){
    /*
    This function can take any number of parameters (arguments)
    However, the first one must be the name of the element
    The others will be class name, id, and/or attribute
        * classes must start with a dot ('.')
        * ids must start with a dot ('#')
        * attributes must be enclosed in square brackets ('[]')--[attribute="value"]
    */
    let newElm=document.createElement(elmTagName);

    for (var i = 1; i < arguments.length; i++) {
        let currentParam = arguments[i].trim();
        // Replace Spaces With Underscore
        currentParam = currentParam.replace(/\s+/g,'_');
		// For classes
        if(/^\./.test(currentParam)){
            let className = currentParam.replace(/^\./,'');
            newElm.classList.add(className)
        }
		// For ids
        else if(/^#/.test(currentParam)){
            let iD = currentParam.replace(/^#/,'');
            newElm.id = iD;
        }
		// For Attributes - [attrName=]
        else if(/^\[.+\]/.test(currentParam)){
            let attrNvalue = currentParam.replace(/^\[(.+)\]/,'$1').replace(/(=)\s*["']/g,'$1').replace(/["']\s*(\])/g,'$1');
            let attr = attrNvalue.split('=')[0];
            let val = attrNvalue.split('=')[1];
            newElm.setAttribute(attr,val);
        }
        else if(currentParam!='' && /^[\d-]/.test(currentParam)){
            let className = currentParam;
            newElm.classList.add(className)
        }
	}
    return newElm
}
function distanceToAncestorBottom(element, ancestor) {
    if (!element || !ancestor) {console.error('Element or ancestor not found.');return null;}
    const elementRect = element.getBoundingClientRect();
    const ancestorRect = ancestor.getBoundingClientRect();
    const distance = ancestorRect.bottom - elementRect.bottom;
    return distance;
}
/* SLIDE UP & SLIDE DOWN */
let slideUpDownTimer;
function slideUpDown(elm, upOrDown, t){
    // Slides Element UP and Hides It By Changing Its Top Margin
    elm.style.transition = 'all 0.3s ease-in-out';
    if(slideUpDownTimer){clearTimeout(slideUpDownTimer)}
    
    const tMargin = elm.offsetHeight;
    let animDuration = t ? (t>300?300:t) : (tMargin * 0.8);

    if(animDuration<=0 && (anim_dur = elm.getAttribute('anim_dur'))){animDuration = anim_dur;}
    else if(animDuration<300){animDuration=300;}
    elm.style.transition = 'all ' + animDuration/1000 + 's ease-in-out';

    // SHOW It If It is Hidden
    if((upOrDown && (upOrDown=='show'|| upOrDown=='down'))||elm.classList.contains('sld_up')){
        if(elm.style.zIndex == ''||elm.style.zIndex > '-1'){elm.style.zIndex = '-1';}
        elm.style.display = '';
        // elm.style.display = elm.getAttribute('display');
        elm.style.opacity = 1;
        setTimeout(() => {
            elm.classList.remove('sld_up')
            elm.style.position = '';
            elm.style.marginTop = '0px';
        }, 1);
        setTimeout(() => {
            elm.style.zIndex = '';
        }, animDuration);

    }
    // HIDE It If It Is Showing
    else if((upOrDown && (upOrDown=='hide'|| upOrDown=='up'))||!elm.classList.contains('sld_up')) {
        elm.matches('#top_horizontal_bar_buttons') ? documentROOT.style.setProperty('--topbar-height', tMargin+'px'):null;
        elm.classList.add('sld_up');
        elm.style.marginTop = '-' + tMargin + 'px';
        // elm.closest('.verse_note') ? elm.setAttribute('style', `margin-top: calc(var(--topbar-height) * -1)!important; ${elm.style.cssText.replace(/margin-top[^;]*;*\s*/,'')}`) : elm.style.marginTop = 'calc(var(--topbar-height) * -1)';
        // elm.style.opacity = 0;
        elm.style.zIndex = -1;
        elm.setAttribute('display', elm.style.display);
        elm.setAttribute('anim_dur', animDuration);
        slideUpDownTimer = setTimeout(() => {
            elm.style.opacity = 0;
            elm.style.setProperty('display', 'none', 'important');
        }, animDuration);
    }
    return animDuration
}
function slide_OLUL_UpDown(elm, upOrDown){
    // Slides Element UP and Hides It By Changing Its Height
    elm.style.transition = 'all 0.3s ease-in-out';
    if(slideUpDownTimer){clearTimeout(slideUpDownTimer)}

    const tMargin = elm.offsetHeight;
    let animDuration = setAnimDurationBasedOnHeight(tMargin);

    let showOrHide;
    // SHOW It If It is Hidden
    if((upOrDown && (upOrDown=='show'||upOrDown=='down'))||(!upOrDown && elm.classList.contains('sld_up'))){
        elm.style.overflow = '';
        elm.style.display = '';
        showOrHide = 'showing';
        setTimeout(() => {
            elm.style.position = '';
            // elm.style.marginTop = '0';
            let oldH = 0, totalHeight = 0;
            if(elm.hasAttribute('hiddingAll')){
                Array.from(elm.children).forEach(child => {
                    let value, child_olul = child.querySelector('ol,ul');
                    child = child_olul?child_olul:child;
                    if (child.hasAttribute('oldHeight')) {value = parseFloat(child.getAttribute('oldHeight'));}
                    else if (child.hasAttribute('oldDerivedHeight')) {value = parseFloat(child.getAttribute('oldDerivedHeight'));}
                    else {value = 0;}
                    totalHeight += value;
                });
            }
            elm.removeAttribute('hiddingAll');

            if (elm.hasAttribute('oldHeight')) {
                oldH = parseInt(elm.getAttribute('oldHeight'));
                oldH = oldH - totalHeight;
                elm.removeAttribute('oldHeight');
            }
            else {
                oldH = parseInt(elm.getAttribute('oldDerivedHeight'));
                oldH = oldH - totalHeight;
            }
            setAnimDurationBasedOnHeight(oldH)
            elm.style.height = oldH+'px';

            elm.hasAttribute('minHeight') ? (elm.style.minHeight = elm.getAttribute('minHeight'),elm.removeAttribute('minHeight')):elm.style.minHeight ='';
            elm.hasAttribute('oldmaxHeight') ? (elm.style.maxHeight = elm.getAttribute('oldmaxHeight'),elm.removeAttribute('oldmaxHeight')):elm.style.maxHeight ='';
        }, 1);
        setTimeout(() => {
            if(elm.hasAttribute('oldDerivedHeight')){
                elm.style.height = '';
                elm.removeAttribute('oldDerivedHeight');
                // change_ancestors_oldDerivedHeight(-1);// not working when hiding, see comment in function for suggestion about possible fix
            };
            elm.hasAttribute('oldTransition') ? (elm.style.transition = '',elm.removeAttribute('oldTransition')):null;
            elm.style.zIndex = '';
            elm.style.transition = '';
            elm.removeAttribute('anim_dur');
            elm.style.cssText==''?elm.removeAttribute('style'):null;
            elm.removeAttribute('overflow');
            elm.removeAttribute('display');
            elm.classList[0]==undefined?elm.removeAttribute('class'):null;
            elm.classList.remove('sld_up');
        }, animDuration + 100);
    }
    // HIDE It If It Is Showing
    else if((upOrDown && (upOrDown=='hide'|| upOrDown=='up'))||(!upOrDown && !elm.classList.contains('sld_up'))) {
        elm.classList.add('sld_up')
        showOrHide = 'hiding';
        elm.style.transition!='' ? elm.setAttribute('oldTransition', elm.style.transition):null;
        
        let totalHeight = 0;
        
        if(elm.style.height!=''){
            elm.hasAttribute('oldDerivedHeight') ? elm.setAttribute('oldHeight', elm.getAttribute('oldDerivedHeight')) : elm.setAttribute('oldHeight', elm.style.height);
        }
        else {
            elm.style.height = tMargin + 'px';
            elm.setAttribute('oldDerivedHeight', tMargin + totalHeight + 'px');
        };
        elm.style.minHeight!='' ? (elm.setAttribute('oldminHeight', elm.style.minHeight),elm.style.minHeight = '0'):null;
        elm.style.maxHeight!='' ? (elm.setAttribute('oldmaxHeight', elm.style.maxHeight),elm.style.maxHeight = '0'):null;
        setTimeout(()=>{elm.style.height='0';},1)
        
        elm.setAttribute('anim_dur', animDuration);
        slideUpDownTimer = setTimeout(() => {
            elm.setAttribute('overflow', elm.style.overflow);
            elm.style.setProperty('overflow', 'hidden', 'important');
        }, animDuration);
        // slideUpDownTimer = setTimeout(() => {
        //     elm.setAttribute('display', elm.style.display);
        //     elm.style.setProperty('display', 'none', 'important');
        // }, animDuration * 1.5);
    }
    return {showOrHide, animDuration}

    function setAnimDurationBasedOnHeight(tMargin) {
        // let animDuration = t ? (t > 300 ? 300 : t) : (tMargin * 0.8);
        // if (animDuration <= 0 && (anim_dur = elm.getAttribute('anim_dur'))){animDuration = parseInt(anim_dur);}
        // else if (animDuration < 300) {animDuration = 300;}

        let animDuration = 150;
        elm.style.transition = 'all ' + animDuration / 1000 + 's ease-in-out';
        return animDuration;
    }
}
// LIST COLLAPSER
function htmlListCollapser(e) {
    let clicked_li = e.target.closest('li');
    let c_li_descendants_olul = clicked_li ? clicked_li.querySelectorAll('li>:is(ol,ul)'):null;
    if (!(clicked_li && c_li_descendants_olul)){return}
    // Check if the clicked element is an `li` item       
    const olOrUl = clicked_li.closest('ul, ol');
    if(wasMarkerClicked()){
        if(e.type=='mousedown'){document.querySelectorAll('#pageEditNsaveBtns').forEach(pEnsB=>pEnsB.remove());return}
        allow_pageEditNsaveBtns = false;
        (e instanceof Event) ? e.preventDefault() : null;
        
        // CLICK
        if(e.type!='contextmenu'){
            // CLICK - CTRL
            if(!e.ctrlKey){
                for (let i = 0; i < c_li_descendants_olul.length; i++) {
                    const d_olul = c_li_descendants_olul[i];
                    (d_olul.matches('li>:is(ol,ul)') && d_olul.parentElement==clicked_li) ? slide_OLUL_UpDown(d_olul):null
                }
            }
            // CLICK + CTRL // hide descendants of li's first generation li descendants
            else {
                for (let index = 0; index < c_li_descendants_olul.length; index++) {
                    const d_olul = c_li_descendants_olul[index];
                    if(d_olul.matches('li>:is(ol,ul)') && d_olul.parentElement==clicked_li){
                        let d_olul_descendants_li = d_olul.querySelectorAll('li');
                        let isAnyDescendant_of_d_olul_descendants_li_hidden = Array.from(d_olul_descendants_li).some(d_olul_d_li=>Array.from(d_olul_d_li.children).some(x=>(x.matches('ol.displaynone,ul.displaynone,ol.sld_up,ul.sld_up'))));
                        
                        let olul_children_olul = Array.from(d_olul.querySelectorAll('li>:is(ol,ul)')).reverse();
                        for (let i = 0; i < olul_children_olul.length; i++) {
                            const element = olul_children_olul[i];
                            // isAnyDescendant_of_d_olul_descendants_li_hidden ? oul.classList.remove('displaynone'):oul.classList.add('displaynone')
                            slide_OLUL_UpDown(oul, isAnyDescendant_of_d_olul_descendants_li_hidden ? 'show':'hide');
                        }
                    }
                }
            }
        }
        //RIGHT-CLICK
        else {
            let li_childOLULisHidden = c_li_descendants_olul[0].matches('ol.displaynone,ul.displaynone,ol.sld_up,ul.sld_up');//the first ol or ul should be the direct descendant of clickedLi
            
            // CONTEXTMENU + SHIFT - CTRL // Hide or Show all OLs and Uls in Parent of clicked li
            if(!e.ctrlKey && e.shiftKey || e.buttons & 1){
                let closestOlUl = clicked_li.closest('ol,ul');
                let closestOlUlChildrenOLUL = closestOlUl.querySelectorAll('li>:is(ol,ul)');
                for (let i = 0; i < closestOlUlChildrenOLUL.length; i++) {
                    const all_olul_inParentOLUL = closestOlUlChildrenOLUL[i];
                    all_olul_inParentOLUL.setAttribute('hiddingAll','true');
                    let clicked_li_siblings = Array.from(closestOlUl.children);
                    const t = !clicked_li_siblings.includes(all_olul_inParentOLUL) ?  0 : 100; // to stagger all OL/UL's of LI's of the same level as the clicked li 
                    setTimeout(() => {
                        slide_OLUL_UpDown(all_olul_inParentOLUL,li_childOLULisHidden?'show':'hide',undefined,true);
                    }, i*t);
                }
            }
            // CONTEXTMENU - SHIFT - CTRL // Toggle Clicked Li's OL/UL and Hide all Other OLs and Uls in Parent of clicked li
            else if(!e.ctrlKey && !e.shiftKey){
                let closestOlUl = clicked_li.closest('ol,ul');
                let inCM = clicked_li.closest('.context_menu');
                const e2scroll = inCM ? context_menu : closestScrollableAncestors(clicked_li,document.body).elm;
                let o_scroll_d = (clicked_li.getBoundingClientRect().top - (inCM ? e2scroll.querySelector('.cmtitlebar').getBoundingClientRect().bottom : e2scroll.getBoundingClientRect().top));//original_scroll_distance
                
                let c = closestOlUl.querySelectorAll('li>:is(ol,ul)');

                for (let i = 0; i < c.length; i++) {
                    const all_olul_inParentOLUL = c[i];
                
                    all_olul_inParentOLUL.setAttribute('hiddingAll','true');
                    
                    let clicked_li_siblings = Array.from(closestOlUl.children);
                    const t = !clicked_li_siblings.includes(all_olul_inParentOLUL) ?  0 : 100; // to stagger all OL/UL's of LI's of the same level as the clicked li 
                    setTimeout(() => {
                        if(all_olul_inParentOLUL.parentElement==clicked_li){
                            slide_OLUL_UpDown(all_olul_inParentOLUL,li_childOLULisHidden?'show':'hide',undefined,true);
                        }
                        else {
                            slide_OLUL_UpDown(all_olul_inParentOLUL,'hide',undefined,true);
                        }
                    }, i*t);
                    if(i==c.length-1){
                        setTimeout(() => {
                            const new_scroll_d = (clicked_li.getBoundingClientRect().top - (inCM ? e2scroll.querySelector('.cmtitlebar').getBoundingClientRect().bottom : e2scroll.getBoundingClientRect().top));
                            const amountOfChange = new_scroll_d - o_scroll_d;
                            amountOfChange < 0 ? e2scroll.scrollBy({ top:amountOfChange, behavior:'smooth'}):null;
                        }, 200)
                    };
                }
            }
            // CONTEXTMENU + CTRL // Hide or Show all OLs and Uls in the Page
            else {
                // if (li_childOLULisHidden) {} else {}
                // Array.from(document.querySelectorAll('li>ol,li>ul')).reverse().forEach((all_olul_inParentOLUL,i)=>{
                let liOLliUL = document.querySelectorAll('li>ol,li>ul');
                for (let i = 0; i < liOLliUL.length; i++) {
                    const all_olul_inParentOLUL = liOLliUL[i];
                    // li_childOLULisHidden ? all_olul_inParentOLUL.classList.remove('displaynone'):oul.classList.add('displaynone');
                    const t = all_olul_inParentOLUL.parentElement.matches('li > ol > li, li > ul > li') ?  0 : 10; //to stagger direct descendant OL/UL's of the first level LI's on the page
                    setTimeout(() => {
                        slide_OLUL_UpDown(all_olul_inParentOLUL, li_childOLULisHidden?'show':'hide',undefined,true);
                        all_olul_inParentOLUL.setAttribute('hiddingAll','true');
                    }, i*t);
                }
            }
        }
        allow_pageEditNsaveBtns = true;
        if(pageEditNsaveBtns=document.querySelector('#pageEditNsaveBtns')){pageEditNsaveBtns.remove()}
        return
    }
        
    function wasMarkerClicked() {
        if (!olOrUl) return false;
        // doesn't work for nested li's children if ol/ul, li is positioned relative
        const parentOLUL_paddingLeft = parseFloat(window.getComputedStyle(olOrUl).paddingLeft) + parseFloat(olOrUl.getBoundingClientRect().left);// Calculate the padding-left of ul or `ol`
        const li_marginLeft = parseFloat(window.getComputedStyle(clicked_li).marginLeft);// calculate the margin-left of clicked_li
        const clickX = e.clientX;
        const markerBoundary = parentOLUL_paddingLeft + li_marginLeft;// Calculate marker boundary based on combined padding and margin
        const markerWasClicked = clickX <= markerBoundary;// Check if the click falls within the marker boundary
        return markerWasClicked
    }
}
function clickAllLisOnPage(appendHere=document.body) {
    appendHere = appendHere instanceof Event ? document.body : appendHere;
    
    function addStyleToHead() {
        document.getElementById('liOlUlStyle_temporaryStyle')?.remove();
        const styleElement = document.createElement('style');
        styleElement.id = 'liOlUlStyle_temporaryStyle';
        styleElement.textContent = 'li>:is(ol,ul){opacity:0;}';
        document.head.appendChild(styleElement);
    }
    let isBody = appendHere==document.body;  
    isBody ? addStyleToHead() : null;// make all li>ol,li>ul invisible
    
    let lazyloaderStyle, loadingOverlay;
    // Remove the loading overlay if it exists
    // appendHere==document.body ? null : (document.querySelectorAll('#lazyloaderStyle,#loadingOverlay').forEach(x=>{x.remove()}),createAndAddSpinnerAndSpinnerStyle());

    setTimeout(() => {
        if (isBody) {
            clickALlLis();
            setTimeout(() => {
                document.getElementById('liOlUlStyle_temporaryStyle')?.remove();
                // Remove the loading overlay
                document.querySelectorAll('#lazyloaderStyle,#loadingOverlay').forEach(x=>{x.remove()});
                loadingOverlay ? loadingOverlay.remove() : null;
                lazyloaderStyle ? lazyloaderStyle.remove() : null;
                //Hide Everything On Page Load (Because of Opening Files in Church so that they don't read or capture what I don't want them to)
                // Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).reverse().forEach(hx=>{toggleH1to6siblings(null,hx)});// // H1-H6.Accordion-D.js already takes care of hiding all H1to6 sibs
            }, 1500);
        } else {
            appendHere.querySelectorAll('li').forEach(function(li) {li.click();});
            let t = 100;
			// // H1-H6.Accordion-D.js already takes care of hiding all H1to6 sibs
            // Array.from(appendHere.querySelectorAll(':is(h1,h2,h3,h4,h5,h6):not(.notemenu *)')).forEach((hx, i) => {
            //     if (i != 0) t = toggleH1to6siblings(null,hx);
            // });
            setTimeout(() => {
                // Remove the loading overlay
                document.querySelectorAll('#lazyloaderStyle,#loadingOverlay').forEach(x=>{x.remove()});
            }, t+100);
        }
    },1500);
    function clickALlLis() {
        appendHere.querySelectorAll('*:not(li):not(ul):not(ol) > :is(ol,ul)').forEach(olUl=>{
            const li = olUl.querySelector('li:has(ol)');
            if (li) {  
                let clientX = parseFloat(window.getComputedStyle(li).paddingLeft) + parseFloat(li.getBoundingClientRect().left)/2;
                htmlListCollapser({type:'contextmenu', ctrlKey:false, shiftKey:false, target:li, clientX})
            }
        })
    }
    function createAndAddSpinnerAndSpinnerStyle() {
        return
        document.getElementById('loadingOverlay') ? document.getElementById('loadingOverlay').remove() : null;
        // Create a loading overlay with a spinner
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay';
        isBody ? loadingOverlay.style.setProperty('position', 'fixed', 'important') : loadingOverlay.style.position = 'absolute';
        loadingOverlay.style.top = '0';
        loadingOverlay.style.left = '0';
        loadingOverlay.style.width = isBody ? '100vw' : '100%';
        loadingOverlay.style.height = isBody ? '100vh' : '100%';
        loadingOverlay.style.backgroundColor = 'var(--transparent-ref-img)';
        loadingOverlay.style.zIndex = '1000';
        loadingOverlay.style.setProperty('display', 'flex', 'important');
        loadingOverlay.style.justifyContent = 'center';
        loadingOverlay.style.alignItems = 'center';

        // Create a spinner element
        const spinner = document.createElement('div');
        spinner.style.border = '16px solid #f3f3f3';
        spinner.style.borderTop = '16px solid var(--chpt)'; /* #3498db */
        spinner.style.borderRadius = '50%';
        spinner.style.width = '120px';
        spinner.style.height = '120px';
        spinner.style.animation = 'spin 2s linear infinite';
        spinner.id = 'lazyLoaderSpinner';

        // Append the spinner to the loading overlay
        loadingOverlay.appendChild(spinner);

        // Add CSS for the spinner animation
        const lls = document.getElementById('lazyloaderStyle');
        lls ? lls.remove() : null;
        lazyloaderStyle = document.createElement('style');
        lazyloaderStyle.id = 'lazyloaderStyle';
        lazyloaderStyle.innerHTML = `
    .darkmode #loadingOverlay{background:rgba(12,14,18,0.93)!important;}
    .darkmode #lazyLoaderSpinner{background:rgba(12,14,18,0)!important;border:16px solid var(--ref-img)!important;border-top-color:rgb(219, 135, 52)!important;}
    #lazyLoaderSpinner{box-shadow:0px 0px 0.5px var(--sh),0px 0px 0.5px var(--sh) inset!important;}
    @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
    }`;
        lazyloaderStyle.innerHTML += isBody ? 'body {overflow:hidden;position:static!important;} #loadingOverlay{position:fixed;min-height:100vh!important;min-width:100vw!important;}' : `#${appendHere.closest('[id]').id} .text_content {overflow:hidden;position:relative;}`;

        document.head.appendChild(lazyloaderStyle);
        // Append the overlay to the appendHere element
        appendHere.appendChild(loadingOverlay);
    }
	document.getElementById('liOlUlStyle_temporaryStyle')?.remove();
}
document.addEventListener('mousedown', htmlListCollapser);
document.addEventListener('click', htmlListCollapser);
document.addEventListener('contextmenu', htmlListCollapser);
clickAllLisOnPage();// Click all li's on the page to collapse them
/* **** ****************************** **** */
/* **** ****************************** **** */

async function getCurrentStrongsDef(e) {
    let approvedStrnum=[];
    if (strnum = e.target.getAttribute('strnum')) {
        strnum = strnum.split(' ');
        strnum.forEach(s => {
            if(/^[HGhg]\d+/.test(s)){
                approvedStrnum.push(s)
            }
        });
        strnum=approvedStrnum;
        await getsStrongsDefinition(strnum);
    }
    // if (e.type == contextMenu_touch) {
        context_menu.classList.add('rightclicked');
        context_menu.removeAttribute('strnum');
        if (strnum) {
            context_menu.setAttribute('strnum', strnum);
        }
        newStrongsDef = currentStrongsDef;
    // } else if (e.type != contextMenu_touch) {
    //     newStrongsDef = '';
    // }
}

/* C-Menu History Navigation */
function cmenu_goBackFront(x){
    let indx = parseInt(x.getAttribute('indx'));
    let calledByPrv = x.classList.contains('prv');
    let calledByNxt = x.classList.contains('nxt');
    let prvTitle;
    /* GET PRESENT TRANSFORM */
    let cmenu_cmt_dX = context_menu.querySelector('.cmtitlebar').getAttribute('data-x');
    let cmenu_cmt_dY = context_menu.querySelector('.cmtitlebar').getAttribute('data-y');
    let fillScreen = context_menu.classList.contains('fillscreen');
    let cmenu_dX = context_menu.getAttribute('data-x');
    let cmenu_dY = context_menu.getAttribute('data-y');
    let oldcMenuHeight = context_menu.getBoundingClientRect().height;//For change of height animation
    let currentContextMenu_style = context_menu.getAttribute('style');
    /* Replace the context menu with the saved one */
    let cMenuParent = context_menu.parentNode;
    let prev_contextmenu=context_menu;

    if (calledByPrv) {
        // Modify the current cmenu and save it in its position in the cmenu_backwards_navigation_arr
        cmenu_backwards_navigation_arr.splice(indx+1 , 1, {
            menu: prev_contextmenu,
            scrollTop: context_menu.scrollTop
        });
        prvTitle=prev_contextmenu.querySelector('.cmtitlebar button.prv').getAttribute('title')
    }
    else if (calledByNxt) {
        // Modify the current cmenu and save it in its position in the cmenu_backwards_navigation_arr
        cmenu_backwards_navigation_arr.splice(indx-1 , 1, {
            menu: prev_contextmenu,
            scrollTop: context_menu.scrollTop
        });
    }
    const prvScrollPosition = cmenu_backwards_navigation_arr[indx].scrollTop;
    cMenuParent.replaceChild(cmenu_backwards_navigation_arr[indx].menu, context_menu);
    context_menu = cmenu_backwards_navigation_arr[indx].menu;
    context_menu.scrollTop = prvScrollPosition;
    context_menu.setAttribute('style',currentContextMenu_style);
    context_menu.querySelector('.cmtitlebar').setAttribute('data-x',cmenu_cmt_dX);
    context_menu.querySelector('.cmtitlebar').setAttribute('data-y',cmenu_cmt_dY);
    context_menu.querySelector('.bottombar').setAttribute('data-x',cmenu_cmt_dX);
    context_menu.querySelector('.bottombar').setAttribute('data-y',cmenu_cmt_dY);
    context_menu.setAttribute('data-x',cmenu_dX);
    context_menu.setAttribute('data-y',cmenu_dY);
    enableInteractJSonEl('.cmtitlebar', context_menu);
    enableInteractJSonEl('.bottombar', context_menu);
    
    fillScreen ? context_menu.classList.add('fillscreen') : context_menu.classList.remove('fillscreen');//for fillscreen class
    
    if(calledByPrv){
        let nxtBtnZ=context_menu.querySelectorAll('.nxt');
        nxtBtnZ.forEach(nxtBtn => {
            nxtBtn.setAttribute('indx',indx+1);
            nxtBtn.setAttribute('title',prvTitle);
            nxtBtn.removeAttribute('disabled');    
        });
    }
    /* For Height Change Animation */
    cmenuChangeOfHeightAnimation(oldcMenuHeight);
    if(lsf=context_menu.querySelector('.lastSelectedRef')){lsf.focus()}
}
/* To Toggle TSK in CMenu When Present */
function toggleCMenuTSK(){
    context_menu.querySelectorAll('.crfnnote').forEach(crfn=>{crfn.classList.toggle('displaynone')});
    context_menu.classList.toggle('showingXref')?showingXref=true:showingXref=false;
    localStorage.setItem('showingXref',showingXref);
}

/* MAKING CONTEXT_MENU DRAGGABLE */
// target elements with the "draggable" class
function enableInteractJSonEl(dragTarget, elmAffected) {
    let dt=typeof dragTarget=='string' ? elmAffected.querySelector(dragTarget):dragTarget;
    dt?(dt.style.touchAction = 'none'):null;//to enable dragging by touch
    interact(dragTarget)
        .draggable({
            // enable inertial throwing
            inertia: true,
            // enable autoScroll
            autoScroll: false,
            // keep the element within the area of it's parent
            modifiers: [
                interact.modifiers.restrictRect({
                    restriction: 'parent',
                    endOnly: true
                })
            ],
            listeners: {
                // call this function on every dragmove event
                move: dragMoveListener.bind(null,'drag',dragTarget,elmAffected),
            }
        })
}
function dragMoveListener(moveTye,dragTarget,elmAffected,event) {
    var target = event.target;
    // keep the dragged position in the data-x/data-y attributes
    var x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
    var y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
    // Always Make ContextMenu translateX Equal ZERO While in #searchPreviewFixed 
    if(elmAffected.closest('#searchPreviewFixed,#cke_editing_page')){x=0}
    // translate the element
    elmAffected.style.transform = 'translate(' + x + 'px, ' + y + 'px)'

    // update the position attributes
    target.setAttribute('data-x', x);
    target.setAttribute('data-y', y);
    //In case it is contextmenu Update both bottombar and cmtitlebar
    let target_2;
    if(context_menu = target.closest('#context_menu')){
        if(target.closest('.cmtitlebar')){target_2=context_menu.querySelector('.bottombar');}
        else if(target.closest('.bottombar')){target_2=context_menu.querySelector('.cmtitlebar');}
        target_2 ? (target_2.setAttribute('data-x', x),target_2.setAttribute('data-y', y)) : null;
    }
}
// this function is used later in the resizing and gesture
// window.dragMoveListener = dragMoveListener;
/* GET OFFEST OF ELEMENT RELATIVE TO GIVEN ANCESTOR OR BODY  */
function getOffsetRelativeToAncestor(element, ancestor=null) {
    let offsetLeft = 0, offsetTop = 0; 
    let originalElement = element;
    if (element.closest('#divTableContainer')) {
        offsetLeft += element.getBoundingClientRect().left;
        offsetTop += element.getBoundingClientRect().top;
    } else {
        while (element && element !== ancestor) {
            offsetLeft += element.offsetLeft;
            offsetTop += element.offsetTop;
            // Consider the element's clientLeft and clientTop (borders) when it's not the body element
            if (element !== document.body) {
                offsetLeft += element.clientLeft;
                offsetTop += element.clientTop;
            }
            element = element.offsetParent;
        }
        element = originalElement;
    }
    return {left: offsetLeft,top: offsetTop};
}
function getTotalScrolledDistance(element) {
    let totalScrollVertical = 0;
    let totalScrollHorizontal = 0;
    let currentElement = element;
    // Iterate through each ancestor element
    while (currentElement) {
        totalScrollVertical += currentElement.scrollTop;
        totalScrollHorizontal += currentElement.scrollLeft;
        currentElement = currentElement.parentElement;
    }
    return { x:totalScrollHorizontal, y:totalScrollVertical};
}

function getOrderedLists(_x = document, selector = 'ol,ul') {
    const lists = Array.from(_x.querySelectorAll(selector));

    return lists.sort((a, b) => {
        const depthA = getDepth(a);
        const depthB = getDepth(b);
        return depthB - depthA; // Sort innermost first
    });
    function getDepth(element) {
        let depth = 0;
        while (element.parentElement) {
            if (element.parentElement.tagName.toLowerCase() === 'ul' || element.parentElement.tagName.toLowerCase() === 'ol') {
                depth++;
            }
            element = element.parentElement;
        }
        return depth;
    }
}

async function checkAndIndicateThatVerseHasNote(bookName, chNumInBk, vNumInChpt, span_verse) {
    let notesForVerse = [];
    let markersForVerse = [];
    
    let allReferencesWithNotes;
    if (window.location.protocol !== 'file:') {
        // In browser
        allReferencesWithNotes = await window.sharedVariableAPI.getAsync();
    } else {
        // In Electron.js
        allReferencesWithNotes = await window.sharedVariableAPI.get();
    }

    for (const folderName in allReferencesWithNotes) {
        if (folderName!='markers' && allReferencesWithNotes.hasOwnProperty.call(allReferencesWithNotes, folderName)) {
            const noteStatus = (folderName=='bible_notes') ? 'noted' : 'user1note';            
            const notes_folder = allReferencesWithNotes[folderName];            
            
            if((arwnbk = notes_folder[bookName]) && (arwnbkChptNum = arwnbk[chNumInBk]) && (arwnbkChptNum.includes(Number(vNumInChpt)))){
                span_verse.classList.add(noteStatus);
                if (span_verse) {span_verse.classList.add(noteStatus);}
                notesForVerse.push(noteStatus);
            }
        }
    }
    if (allReferencesWithNotes && typeof allReferencesWithNotes=='object' && 'markers' in allReferencesWithNotes) {
        if (allReferencesWithNotes.hasOwnProperty.call(allReferencesWithNotes,'markers')) {
            markersForVerse = allReferencesWithNotes['markers'][bookName];
            if(markersForVerse && markersForVerse[chNumInBk] && (mrks = markersForVerse[chNumInBk][vNumInChpt])){
                markersForVerse = mrks;
                if (span_verse) {mrks.forEach(mrk => {span_verse.classList.add(`marker_${mrk}`)});}
            } else {
                markersForVerse = [];
            }
        }
    }
    return {'notes': notesForVerse, 'markers':markersForVerse};
}

async function showNoteForVerseNOTinMainBibleWindow(dis){
    const parentVerse = dis.closest('.verse');
    const [bN, bC, cV] = parentVerse.querySelector('[ref]').getAttribute('ref').split(/[(?<=\s)(?<=:)](?=\d)/);
    const crfnnote = dis.closest('.crfnnote');
    let appendHere = crfnnote.querySelector('.none_mainsection_note');
    if(!appendHere.classList.contains('note_added')){
        await readFromVerseNotesFiles(bN, bC, cV,appendHere);
        appendHere.classList.add('note_added');
        show_crfnnote();
        parentVerse.scrollIntoView({behavior:'smooth',block:'nearest'});
        clickAllLisOnPage(appendHere);
    }
    else if (appendHere.classList.contains('displaynone')){
        show_crfnnote();
        appendHere.classList.remove('displaynone');
        slideUpDown(appendHere, null, 300);
    } else {
        let anim_t = slideUpDown(appendHere, null, 300);
        if(dis.closest('.context_menu') && !context_menu.matches('.showingXref')){
            const t = setTimeout(() => {
                crfnnote.classList.add('displaynone');
                appendHere.classList.add('displaynone');
                clearTimeout(t);
            }, anim_t);
        }
    }

    function show_crfnnote() {
        crfnnote.closest('.displaynone') ? crfnnote.classList.remove('displaynone') : null;//if .crfnnote is hidden, make it visible so that displayed note can be visible
    }
}
function generateRefsInNote(txt, shortForm='false', proofEditText=true) {
    const parser = new DOMParser();
    txt = txt.replace(/\((\d+)\/(\d+)\)/ig, '<sup>$1</sup>&frasl;</sub>$2</sub>'); // modify fractions ())
    const doc = parser.parseFromString(`<div>${txt}</div>`, 'text/html');
    const container = doc.body.firstChild;
    // container.querySelectorAll(".strnum.vnotestrnum").forEach(s => {s.textContent = s.textContent;});
    container.querySelectorAll('span').forEach(s => {
        // Because of nested spans
        // Check if span has exactly one child node and it's also a span
        if (s.childNodes.length === 1 && s.firstChild.nodeType === Node.ELEMENT_NODE && s.firstChild.tagName === 'SPAN') {s.replaceWith(s.firstChild);}
    });
    container.querySelectorAll('span[ref],span[strnum]:not(#context_menu)').forEach(sref => {sref.replaceWith(...sref.childNodes);});
    container.querySelectorAll('span').forEach((s) => {s.innerText.trim()==''?s.remove():null;});

    const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            for (let p = node.parentNode; p; p = p.parentNode) {
                if (p.nodeName.toLowerCase() === 'svg' || p.nodeName.toLowerCase() === 'text') {
                    return NodeFilter.FILTER_REJECT;
                }
            }
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    // Group adjacent text nodes
    let textGroups = [];
    let currentGroup = null;

    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!currentGroup || node.previousSibling !== currentGroup[currentGroup.length - 1]) {
            currentGroup = [];
            textGroups.push(currentGroup);
        }
        currentGroup.push(node);
    }

    // Process each group as a single string
    for (const group of textGroups) {
        if (group.length === 0) continue;

        // Combine text content of the group
        const combinedText = group.map(node => node.textContent).join('');
        let normalizedText = combinedText
            .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
            .replace(/&ZeroWidthSpace;|&#8203;/gi, '')
            .replace(/&nbsp;|&#160;/gi, ' ')
            .replace(/\s+/gi, ' ');

        // Generate new HTML for the combined text
        const newHtml = innerGenerateRefsInNote(normalizedText, shortForm, proofEditText);

        if (newHtml !== normalizedText) {
            const temp = doc.createElement('div');
            temp.innerHTML = newHtml;

            // Replace the entire group with the new HTML's content (not the temp div itself)
            const firstNode = group[0];
            const parent = firstNode.parentNode;
            
            // Insert all child nodes of temp before the first node in the group
            const fragment = doc.createDocumentFragment();
            while (temp.firstChild) {
                fragment.appendChild(temp.firstChild);
            }
            parent.insertBefore(fragment, firstNode);
            
            // Remove all original nodes in the group
            for (const node of group) {
                parent.removeChild(node);
            }
        }
    }

    // Find and Wrap Strong's numbers before returning `txt`
    return container.innerHTML = container.innerHTML.replace(/<p>&nbsp;<\/p>/ig,'').replace(/(?<!<[^>]*)(?!<span[^>]*?strnum[^>]*?>|<text[^>]*?>)((H|G)[0-9]+)(?![^<]*<\/text>)(?![^<]*>)/gi, function(match) {
        const strn = match.toUpperCase();
        return `<span class="strnum ${strn} vnotestrnum" strnum="${strn}">${strn}</span>`;
    });

    function innerGenerateRefsInNote(txt,shortForm='false',proofEditText=true){
        // Step 1: Extract all <svg> or <text> elements
        // let svgPlaceholders = [];
        // txt = txt.replace(/<svg[\s\S]*?<\/svg>/gi, function(match) {
        //     let id = svgPlaceholders.length;
        //     svgPlaceholders.push(match);
        //     return `___SVG_PLACEHOLDER_${id}___`;
        // });

        let bdb=bible.Data.books;
        let preferredBKabrv;
        
        //because of Joh (42) and I Joh (61,62,63) conflict
        let orderOfarray = Array.from({ length: bible.Data.allBooks.length }, (_, i) => i);
        let moved = orderOfarray.splice(61, 3); // removes 61, 62, 63
        orderOfarray.splice(42, 0, ...moved);
        
        //loop through all the arrays of book names and their abbreviations
        for(let k=0;k<orderOfarray.length;k++){
            let i = orderOfarray[k];
            const bkMatchFound=bdb[i].some((bkNabrv) => {
                let rgx = new RegExp(`\\b${bkNabrv}(?=[^a-zA-Z]|$|[\s\n\r])`, 'i');
                return txt.match(rgx)
            });
            if(bkMatchFound){//check if any of the names in the array matches
                preferredBKabrv=bdb[i][1];//NOT USED: if there is a match, pick the second name which is the preferred abbreviation
                for(let j=0;j<bdb[i].length;j++){
                    let bkName2find=bdb[i][j];
                    txt = findAndIndicateScriptureRefs(txt,bkName2find);
                }
            }
        }
        /* WRAP SCRIPTURE REFERENCES FOR RIGHT-CLICKING */
        function findAndIndicateScriptureRefs(txt,bkName2find){
            // Wrap scripture references in spans
            let newBkReg = new RegExp(`(?<!ref="${bkName2find}\\.\\d+\\.\\d+([-,]\\d+)*">)(?![^<]*<text[^>]*>)\\b((?<!notes_img\/)(?<!<span [^>]*)(?<!span ref=")${bkName2find})(?:(?:[\\s:;.,-]*(?:(?::*\\s*\\d+(?:\\d+:*\\s*-\\s*\\d+(?:\\s*,)*)+)|(?:(?:\\d+:*\\s*-\\s*\\d+(?:\\s*,)*)|(?:(?<=[:\\d*])\\d+)|(?<=${bkName2find}\\s*)\\d+|\\d+(?!\\s*\\p{L}))))+)(?!">)(?![^<]*<\/text>)(\\s*-\\s*(?<!ref="${bkName2find}\\.\\d+\\.\\d+([-,]\\d+)*">)(?![^<]*<text[^>]*>)\\b((?<!notes_img\/)(?<!<span [^>]*)(?<!span ref=")${bkName2find})(?:(?:[\\s:;.,-]*(?:(?::*\\s*\\d+(?:\\d+:*\\s*-\\s*\\d+(?:\\s*,)*)+)|(?:(?:\\d+:*\\s*-\\s*\\d+(?:\\s*,)*)|(?:(?<=[:\\d*])\\d+)|(?<=${bkName2find}\\s*)\\d+|\\d+(?!\\s*\\p{L}))))+)(?!">)(?![^<]*<\/text>))*`, 'uig');// So as to match ranges accross chapters, e.g., "Gen 6:20 - Gen 7:3"
            txt = txt.replace(newBkReg, function (mtch) {
                mtch = mtch.replace(/(\p{L})(\d)/ug,'$1 $2').replace(/\s*([.:\-,])\s*/g,'$1').replace(/\s*(;)\s*(\w)/g,'$1 $2');//2Cor3.1==>2Cor 3.1
                let xSplit = /;|:|/.test(mtch)?mtch.split(/;|(?<=[a-zA-Z]+\s*\d+(?:\s*,\s*\d+)*),|,(?=\d+\s*:\s*\d+)/):mtch.split(',');//split match by semi-colons
                newBkReg2 = new RegExp(`(?<!span ref=")${bkName2find}`,'i');
                // console.log(xSplit);
                let rtxt = '';
                
                //refs with book names
                let refWithName = xSplit.shift();
                let bkn = refWithName.match(/[iI0-9]*\s*([a-zA-Z]+\s*)/)[0].trim();
                let chptNvrs = refWithName.replace(/[iI0-9]*\s*[a-zA-Z]+\s*/,'').trim();
                
                refWithName = shortenedBookName(refWithName);
                // /:/ vs. /:|(?:(?:\s|\.)\d+\.\d+)/
                rtxt += /:|(?:(?:\s|\.)\d+\.\d+)/.test(refWithName) ? `<span ref="${refWithName.replace(/\s+(?!$)|:/g,'.')}">${refWithName}</span>`: `<span ref="${turnChptOnlyTOFullRef(bkn,chptNvrs).replace(/\s+(?!$)|:/g,'.')}">${refWithName}</span>`;
                
                if(xSplit.length>0) {
                    xSplit.forEach(r => {
                    if (/:/.test(r)) {//if it has colon, then it is has chapter and verse(s) numbers
                        rtxt += `; <span ${/[a-zA-Z]/.test(r) ? '' : 'bkn="'+ bkn +'" '}ref="${bkn}.${r.trim().replace(/:/,'.')}">${r}</span>`;
                    }
                    
                    else {//if it has colon, then it is has chapter and verse(s) numbers
                        //they are chapter numbers (that don't have verse numbers)
                        let chptsOnlyArray = r.split(/(?<!:(?:\d+|[\s,]*)+),/g).filter(item => item !== undefined);
                        chptsOnlyArray.forEach((chpt,i) => {
                            chpt!=undefined?_r():null;
                            function _r() {
                                let chpt_trm = chpt.trim();
                                let wholeChpt = turnChptOnlyTOFullRef(bkn, chpt_trm);
                                rtxt +=  `${i==0?';':','} <span bkn="${bkn}" ref="${wholeChpt}">${chpt}</span>`;
                            };
                        });
                    }
                    });
                }
                //refs without book name
                return rtxt
            })
            // proofEditText ? txt = modifyQuotationMarks(txt) : null;
            
            return txt

            function turnChptOnlyTOFullRef(bkn, chpt_trm) {
                const xr = breakDownRef(`${bkn} ${chpt_trm}`);
                let wholeChpt = `${bkn}.${chpt_trm}.${xr.cv}-${xr.cv2}`;
                return wholeChpt;
            }

            function shortenedBookName(refWithName) {
                if (shortForm) {
                    refWithName = refWithName.replace(/(\p{L}+)\s*(\d+)\s*(:)\s*(\d+)/gui, '$1 $2$3$4')//Replace name ensure space between name and chapter number
                    refWithName = refWithName.replace(newBkReg2, preferredBKabrv).toLowerCase().replace(/\b\d*\s*(\p{L})/ug, function (match) {
                        return match.toUpperCase();
                    });
                }
                return refWithName.replace(/\bSOS\b/gi,'SoS').replace(/\bJb\b/gi,'Job');
            }
        }
        
        // proofEditText ? txt = modifyQuotationMarks(txt) : null;
        txt = modifyQuotationMarks(txt)
        // Step 3: Restore SVGs
        // txt = txt.replace(/___SVG_PLACEHOLDER_(\d+)___/g, (_, id) => svgPlaceholders[+id]);
        return txt
    }
}
function isFullyScrolledIntoView(el, parentElement, partial = false, tolerance = 10) {
    const t = tolerance, pE = parentElement;
    const rect = el.getBoundingClientRect();
    const parentRect = pE ? pE.getBoundingClientRect() : { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };

    const elemTop = rect.top;
    const elemBottom = rect.bottom;
    const elemLeft = rect.left;
    const elemRight = rect.right;

    // Only completely visible elements return true:
    const fullyVisible = (elemTop >= parentRect.top) && 
                         (elemBottom <= parentRect.bottom) && 
                         (elemLeft >= parentRect.left) && 
                         (elemRight <= parentRect.right);

    // Partially visible elements return true:
    const partiallyVisible = (elemTop < parentRect.bottom - t) && 
                             (elemBottom > parentRect.top + t) && 
                             (elemLeft < parentRect.right - t) && 
                             (elemRight > parentRect.left + t);

    const isVisible = partial ? partiallyVisible : fullyVisible;

    // Check display and opacity
    const style = window.getComputedStyle(el);
    const isDisplayed = style.display !== 'none';
    const isOpaque = parseFloat(style.opacity) > 0;

    return isVisible && isDisplayed && isOpaque;
}
/* GREEK TRANSLITERATOR */
//Match key and replace with value
function keyValueReplacer(str) {
    const greekTransliterationReplacementSET = {
        "au": ["αυ"],"hu": ["\bυ"],"au": ["αυ"],"eu": ["ευ"],"ou": ["ου"],"hu": ["ηυ"],"me": ["μὴ"],"ui": ["υι"],"ng": ["γγ"],"nch": ["γχ"],"nk": ["γκ"],"nx": ["γξ"],"th": ["θ"],"Th": ["Θ"],"ph": ["φ"],"Ph": ["Φ"],"ch": ["χ"],"Ch": ["Χ"],"ps": ["ψ"],"Ps": ["Ψ"],"A": ["Α"],"B": ["Β"],"G": ["Γ"],"D": ["Δ"],"E": ["Ε","Ἔ"],"Z": ["Ζ"],"H": ["Η"],"I": ["Ι"],"K": ["Κ"],"L": ["Λ"],"M": ["Μ"],"N": ["Ν"],"X": ["Ξ"],"O": ["Ο"],"P": ["Π"],"R": ["Ρ"],"S": ["Σ"],"T": ["Τ"],"Y": ["Υ"],"Ō": ["Ω"],"a": ["α","ὰ","ά","ᾶ","ᾰ","ᾱ"],"b": ["β"],"g": ["γ"],"d": ["δ"],"e": ["ε","ὲ","ἐ","ἔ"],"é": ["ἐ"],"z": ["ζ"],"ḗ": ["ή"],"ē": ["η"],"h": ["ὴ","ή","ῆ","ῃ"],"ḗ": ["ή"],"i": ["ι","ὶ","ϊ",'ΐ',"ῖ","ῐ","ῑ"],"k": ["κ"],"l": ["λ"],"m": ["μ"],"n": ["ν"],"x": ["ξ"],"o": ["ο","ὸ"],"p": ["π"],"r": ["ρ"],"s": ["σ","ς"],"t": ["τ"],"y": ["υ","ὺ","ύ","ϋ","ΰ","ῠ","ῡ"],"û": ["ῦ"],"ō": ["ω","ὧ","ῷ","ώ","ὼ","ῶ","ὠ"]}
    if(/[\u0590-\u05FF\u05B0-\u05BD]/.test(str)) {
        return transliterateHebrewToEnglish(str)
    }
    else{
        //GREEK to ENGLISH
        /* For Word Begining */
        str = str.replace(new RegExp(`\\b[υὑ]`, 'g'), 'hu')
        Object.keys(greekTransliterationReplacementSET).forEach(k => greekTransliterationReplacementSET[k].forEach(function (item) {
            str = str.replace(new RegExp(`${item}`, 'g'), k)
        }));
        return str;
    }

    /* HEBREW TRANSLITERATOR */
    function transliterateHebrewToEnglish(hebrewText) {
        const hebrewTransliterationMap = {
          //specialCases
          'אֲ': 'a', 'אֳ': 'o', 'אֱ': 'e', 'עֲ': 'a', 'עֳ': 'o', 'עֱ': 'e', 'עי': 'ay', 'עו': 'ao', 'עה': 'ah', 'עי־': 'ey-', 'עו־': 'ow-', 'עה־': 'ah-', 'נֵ֗י': 'nay',
          'בֲ': 'v',
          'בֳ': 'vo','בֱ': 've','גֲ': 'g','גֳ': 'go','גֱ': 'ge','חֲ': 'h','חֳ': 'ho','חֱ': 'he','כֲ': 'k','כֳ': 'ko','כֱ': 'ke','מֲ': 'm','מֳ': 'mo','מֱ': 'me','פֲ': 'f','פֳ': 'fo','פֱ': 'fe','צֲ': 'ts','צֳ': 'tso','צֱ': 'tse','קֲ': 'q','קֳ': 'qo','קֱ': 'qe','רֲ': 'r','רֳ': 'ro','רֱ': 're',
          'לְ':'lə',
          //single alphabets and punctuation marks
          'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z', 'ח': 'kh', 'ט': 't', 'י': 'y', 'כ': 'k', 'ל': 'l', 'מ': 'm', 'נ': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p', 'צ': 'ts', 'ק': 'q', 'ר': 'r', 'ש': 'sh', 'ת': 't', 'ְ': '', 'ֱ': 'e', 'ֲ': 'a', 'ֳ': 'o', 'ִ': 'i', 'ֵ': 'e', 'ֶ': 'e', 'ַ': 'a', 'ָ': 'a', 'ֹ': 'o', 'ֻ': 'u', 'ּ': '', 'ֹּ': 'o'
        };
      
        const hebrewKeys = Object.keys(hebrewTransliterationMap);
        const hebrewPattern = hebrewKeys.map(key => key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
        const hebrewRegex = new RegExp(hebrewPattern, 'g');
      
        return hebrewText.replace(hebrewRegex, match => hebrewTransliterationMap[match] || match);
    }
}

async function getAllRefsInHighlight(event, selector) {
    const selection = window.getSelection();
    
    // Exit if no valid selection exists
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {return null;}

    // Check if right-click is within any range's bounding rectangle
    for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        const rect = range.getBoundingClientRect();
        
        // Skip collapsed or zero-area ranges
        if (rect.width === 0 && rect.height === 0) continue;
        
        // Check if click coordinates are inside the selection rect
        if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            
            // Find common ancestor container for the selection
            const commonAncestor = range.commonAncestorContainer;
            const searchRoot = commonAncestor.nodeType === Node.ELEMENT_NODE ? commonAncestor : commonAncestor.parentElement;
            
            // Find elements matching the selector within the search root
            const allElements = Array.from(searchRoot.querySelectorAll(selector));

            // Filter elements that are partially/fully in the selection
            const elementsInSelection = allElements.filter(el => selection.containsNode(el, true));
            
            return elementsInSelection.length > 1 ? elementsInSelection : null;
        }
    }
    return null; // Right-click not in selection
}

/* Reduce list of bible refs to shortest form */
function minimalBibleReference(refStr) {
    const refs = refStr.split(';').map(ref => ref.trim()).filter(ref => ref.length > 0);
    const verseDict = {};
    const chapterOrder = [];
    const seenKeys = new Set();

    for (const ref of refs) {
        const parts = ref.split(':');
        if (parts.length < 2) continue;
        const versePart = parts[parts.length - 1].trim();
        const bookChapterStr = parts.slice(0, -1).join(':').trim();
        const tokens = bookChapterStr.split(/\s+/);
        if (tokens.length === 0) continue;
        const chapterStr = tokens[tokens.length - 1];
        const bookStr = tokens.slice(0, -1).join(' ').trim();
        const verseNum = parseInt(versePart, 10);
        if (isNaN(verseNum)) continue;
        const key = `${bookStr} ${chapterStr}`;
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            chapterOrder.push(key);
        }
        if (!verseDict[key]) {
            verseDict[key] = [];
        }
        verseDict[key].push(verseNum);
    }

    function groupVerses(verses) {
        if (verses.length === 0) return [];
        const groups = [];
        let i = 0;
        while (i < verses.length) {
            const currentGroup = [verses[i]];
            let j = i + 1;
            let step = null;
            while (j < verses.length) {
                const last = currentGroup[currentGroup.length - 1];
                const currentVal = verses[j];
                const diff = currentVal - last;
                if (Math.abs(diff) === 1) {
                    if (step === null) {
                        step = diff;
                        currentGroup.push(currentVal);
                    } else if (diff === step) {
                        currentGroup.push(currentVal);
                    } else {
                        break;
                    }
                } else {
                    break;
                }
                j++;
            }
            groups.push(currentGroup);
            i = j;
        }
        return groups;
    }

    const outputList = [];
    for (const key of chapterOrder) {
        const verses = verseDict[key] || [];
        const groupedVerses = groupVerses(verses);
        const verseParts = [];
        for (const group of groupedVerses) {
            if (group.length === 1) {
                verseParts.push(group[0].toString());
            } else {
                verseParts.push(`${group[0]}-${group[group.length - 1]}`);
            }
        }
        const verseStr = verseParts.join(',');
        outputList.push(`${key}:${verseStr}`);
    }

    return outputList.join('; ');
}
