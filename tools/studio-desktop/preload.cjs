const {contextBridge,ipcRenderer}=require('electron');
// The document's origin can still be opaque during a sandboxed preload.
// Main-process IPC checks the final production URL and rejects child frames.
if(process.isMainFrame){
 const subscribe=(channel,fn)=>{if(typeof fn!=='function')return()=>{};const listener=(_event,value)=>fn(value);ipcRenderer.on(channel,listener);return()=>ipcRenderer.removeListener(channel,listener);};
 contextBridge.exposeInMainWorld('LightCityDesktop',Object.freeze({
  version:'0.1.1',connect:()=>ipcRenderer.invoke('studio:connect'),
  syncReports:data=>ipcRenderer.invoke('studio:reports',data),
  linkReady:data=>ipcRenderer.invoke('studio:ready',data),
  acknowledgeResult:data=>ipcRenderer.invoke('studio:handled-result',data),
  showAlerts:()=>ipcRenderer.invoke('studio:show-alerts'),
  openSettings:()=>ipcRenderer.invoke('studio:settings'),
  onConnectionCode:fn=>subscribe('studio:connection-code',fn),
  onHandle:fn=>subscribe('studio:handle-report',fn),
  onSettingsChanged:fn=>subscribe('studio:settings-changed',fn)
 }));
}
