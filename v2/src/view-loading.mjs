export function createViewLoading(document, message='Loading…'){
 const element=document.createElement('div'),spinner=document.createElement('span'),label=document.createElement('span');
 element.className='lc-view-loading';element.setAttribute('role','status');spinner.className='lc-view-loading-spinner';spinner.setAttribute('aria-hidden','true');label.textContent=message;element.append(spinner,label);return element;
}
