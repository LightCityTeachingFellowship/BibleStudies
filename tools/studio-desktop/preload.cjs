const {contextBridge,ipcRenderer}=require('electron');
if(location.origin==='https://lightcityfellowship.com'&&/^\/Admin\/?$/.test(location.pathname)){
 const subscribe=(channel,fn)=>{if(typeof fn!=='function')return()=>{};const listener=(_event,value)=>fn(value);ipcRenderer.on(channel,listener);return()=>ipcRenderer.removeListener(channel,listener);};
 contextBridge.exposeInMainWorld('LightCityDesktop',Object.freeze({
  version:'0.1.0',connect:()=>ipcRenderer.invoke('studio:connect'),
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
