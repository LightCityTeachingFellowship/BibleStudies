const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('StudioAlerts',Object.freeze({
 action:(type,value)=>ipcRenderer.invoke('alerts:action',{type,value}),
 onState:callback=>{ipcRenderer.on('alerts:state',(_event,state)=>callback(state));ipcRenderer.send('alerts:loaded');}
}));
