// Local preferences need no account and never change the publication itself.
const key='lightcity-reading-appearance-v1';
const fonts={original:'',system:'system-ui, -apple-system, "Segoe UI", sans-serif',georgia:'Georgia, "Times New Roman", serif',verdana:'Verdana, Geneva, sans-serif',times:'"Times New Roman", Times, serif'};
const normalize=value=>({font:Object.hasOwn(fonts,value?.font)?value.font:'original',size:Number.isFinite(Number(value?.size))?Math.min(180,Math.max(80,Math.round(Number(value.size)/10)*10)):100});
let preferences;try{preferences=normalize(JSON.parse(localStorage.getItem(key)));}catch{preferences=normalize();}
const content=document.querySelector('[data-study-body] > main');
const dialog=document.querySelector('[data-reading-settings]');
if(content&&dialog){
  const opener=document.querySelector('[data-reading-settings-open]');
  // Keep the dialog outside the reading body so changing fonts never alters its controls.
  document.body.append(dialog);
  const toolbar=document.querySelector('.lc-study-toolbar');
  const actions=toolbar?.querySelector('.lc-study-toolbar-actions')||toolbar;
  actions?.append(opener);
  const family=dialog.querySelector('[data-reading-font]'),size=dialog.querySelector('[data-reading-size]'),output=dialog.querySelector('[data-reading-size-output]');
  const smaller=dialog.querySelector('[data-reading-smaller]'),larger=dialog.querySelector('[data-reading-larger]');
  const originals=new Map();
  const excluded='button, input, select, textarea, script, style, svg, math, [role="button"], [role="dialog"], [aria-hidden="true"], .fa, .fas, .far, .fab, #context_menu, .buttons, .crfnnote_btns';
  const tags='main, header, section, div, h1, h2, h3, h4, h5, h6, p, li, ol, ul, blockquote, table, td, th, caption, span, a, strong, b, em, i, u, s, sub, sup, small, code, pre, font';
  function restore(){
    for(const [node,original] of originals){
      for(const name of ['font-size','font-family']){
        const property=original[name];
        if(property.value)node.style.setProperty(name,property.value,property.priority);
        else node.style.removeProperty(name);
      }
      if(!node.isConnected)originals.delete(node);
    }
  }
  function apply(){
    // Measure all original sizes before writing any scaled size, so nested text
    // scales once and headings retain their hierarchy, including responsive CSS.
    // Older publication styles animate all properties. Freeze those transitions
    // while measuring, otherwise repeated clicks would measure an in-between size.
    content.setAttribute('data-reading-sizing','');
    restore();
    const nodes=[content,...content.querySelectorAll(tags)].filter(node=>!node.closest(excluded));
    const measurements=nodes.map(node=>{
      if(!originals.has(node))originals.set(node,Object.fromEntries(['font-size','font-family'].map(name=>[name,{value:node.style.getPropertyValue(name),priority:node.style.getPropertyPriority(name)}])));
      return [node,parseFloat(getComputedStyle(node).fontSize)];
    });
    for(const [node,pixels] of measurements){
      if(preferences.size!==100&&Number.isFinite(pixels))node.style.setProperty('font-size',pixels*preferences.size/100+'px','important');
      if(fonts[preferences.font])node.style.setProperty('font-family',fonts[preferences.font],'important');
    }
    void content.offsetWidth;
    content.removeAttribute('data-reading-sizing');
    family.value=preferences.font;size.value=preferences.size;output.value=preferences.size+'%';
    size.setAttribute('aria-valuetext',preferences.size+' percent');
    smaller.disabled=preferences.size<=80;larger.disabled=preferences.size>=180;
  }
  function update(next){preferences=normalize(next);try{localStorage.setItem(key,JSON.stringify(preferences));}catch{}apply();}
  opener.hidden=false;
  opener.onclick=()=>dialog.showModal();
  for(const close of dialog.querySelectorAll('[data-reading-settings-close]'))close.onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>opener.focus({preventScroll:true}));
  let outside=false;
  const isOutside=event=>{const box=dialog.getBoundingClientRect();return event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom;};
  dialog.addEventListener('pointerdown',event=>{outside=event.target===dialog&&isOutside(event);});
  dialog.addEventListener('click',event=>{if(outside&&event.target===dialog&&isOutside(event))dialog.close();outside=false;});
  family.onchange=()=>update({...preferences,font:family.value});
  size.oninput=()=>update({...preferences,size:Number(size.value)});
  smaller.onclick=()=>update({...preferences,size:preferences.size-10});
  larger.onclick=()=>update({...preferences,size:preferences.size+10});
  dialog.querySelector('[data-reading-reset]').onclick=()=>update({font:'original',size:100});
  let frame;
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(apply);}
  // Re-measure when responsive styles change or Bible references add reading text.
  window.addEventListener('resize',schedule);
  new MutationObserver(schedule).observe(content,{childList:true,subtree:true});
  window.addEventListener('storage',event=>{if(event.key===key){try{preferences=normalize(JSON.parse(event.newValue));}catch{preferences=normalize();}apply();}});
  apply();
}
