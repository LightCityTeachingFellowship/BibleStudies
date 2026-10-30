import {app,BrowserWindow,Menu,Tray,Notification,ipcMain,shell,nativeImage,clipboard,dialog} from 'electron';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {STUDIO,ENDPOINT,studioURL,externalURL,pairing,cleanReports,reconcile,preferences,reportHeading} from './core.mjs';
const directory=dirname(fileURLToPath(import.meta.url)),smoke=!app.isPackaged&&process.argv.includes('--smoke-test');
if(smoke)app.setPath('userData',join(tmpdir(),'lightcity-studio-desktop-qa'));
app.setAppUserModelId('com.lightcityfellowship.studio');
let main,alerts,tray,quitting=false,owner=null,reports=[],ready=null,settings=preferences(),lastSync=null,notice='',ring=false,connecting=null;
const appURL=STUDIO+'?desktop=windows';
const localPage=pathToFileURL(join(directory,'alerts.html')).href;
const prefsFile=()=>join(app.getPath('userData'),'preferences.json');
function state(){return {reports,ready,settings,lastSync,notice};}
function push(){if(alerts&&!alerts.isDestroyed()&&!alerts.webContents.isLoading()){alerts.webContents.send('alerts:state',{...state(),ring});ring=false;}tray?.setToolTip('LightCity Studio'+(reports.length?' · '+reports.length+' unresolved alerts':''));menu();}
function showMain(){if(!main||main.isDestroyed())return;if(main.isMinimized())main.restore();main.show();main.focus();}
function showAlerts(focus=true){if(!alerts||alerts.isDestroyed())makeAlerts();push();if(smoke)return;if(focus){alerts.show();alerts.focus();}else alerts.showInactive();}
function clearIdentity(){owner=null;reports=[];ready=null;lastSync=null;notice='Sign in to Studio to receive alerts.';ring=false;push();}
async function saveSettings(patch){settings=preferences({...settings,...patch});await mkdir(app.getPath('userData'),{recursive:true});await writeFile(prefsFile(),JSON.stringify(settings));main?.setAlwaysOnTop(settings.alwaysOnTop);if(!smoke)app.setLoginItemSettings({openAtLogin:settings.openAtLogin,path:process.execPath,args:['--background']});main?.webContents.send('studio:settings-changed',settings);push();return settings;}
function menu(){if(!tray)return;tray.setContextMenu(Menu.buildFromTemplate([
 {label:'Open LightCity Studio',click:showMain},{label:'Unresolved alerts ('+reports.length+')',click:()=>showAlerts()},
 {type:'separator'},{label:'Keep Studio above other windows',type:'checkbox',checked:settings.alwaysOnTop,click:item=>void saveSettings({alwaysOnTop:item.checked})},
 {label:'Start with Windows',type:'checkbox',checked:settings.openAtLogin,click:item=>void saveSettings({openAtLogin:item.checked})},
 {label:'Alert sound',type:'checkbox',checked:settings.sound,click:item=>void saveSettings({sound:item.checked})},
 {type:'separator'},{label:'Refresh Studio',click:()=>{if(!smoke)void main?.loadURL(appURL);}},{label:'Quit LightCity Studio',click:()=>app.quit()}
 ]));}
function toast(title,body){if(smoke||!Notification.isSupported())return;const n=new Notification({title,body:String(body).slice(0,240),icon:join(directory,'assets/studio.png'),timeoutType:'never',silent:true});n.on('click',()=>showAlerts());n.on('failed',()=>{notice='Windows could not display the banner. Your alerts remain here.';push();});n.show();}
function trusted(event,local=false){const expected=local?event.sender===alerts?.webContents:event.sender===main?.webContents;if(!expected||event.senderFrame!==event.sender.mainFrame)return false;return local?event.senderFrame.url===localPage:studioURL(event.senderFrame.url);}
function handle(channel,fn,local=false){ipcMain.handle(channel,async(event,...args)=>{if(!trusted(event,local))throw Error('This action is available only inside LightCity Studio.');return fn(...args);});}
function secureNavigation(window){window.webContents.setWindowOpenHandler(({url})=>{const target=externalURL(url);if(target&&!smoke)void shell.openExternal(target);return {action:'deny'};});window.webContents.on('will-navigate',(event,url)=>{if(studioURL(url))return;event.preventDefault();const target=externalURL(url);if(target&&!smoke)void shell.openExternal(target);});window.webContents.on('will-redirect',(event,url)=>{if(!studioURL(url))event.preventDefault();});window.webContents.on('will-attach-webview',event=>event.preventDefault());}
function makeAlerts(){
 alerts=new BrowserWindow({title:'LightCity Studio alerts',width:440,height:640,minWidth:360,minHeight:420,show:false,alwaysOnTop:true,icon:join(directory,'assets/studio.png'),webPreferences:{preload:join(directory,'alerts-preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,autoplayPolicy:'no-user-gesture-required'}});
 alerts.webContents.setWindowOpenHandler(()=>({action:'deny'}));alerts.webContents.on('will-navigate',event=>event.preventDefault());alerts.on('close',event=>{if(!quitting){event.preventDefault();alerts.hide();}});void alerts.loadFile(join(directory,'alerts.html'));
}
async function connect(){
 if(connecting)return connecting;
 connecting=(async()=>{
  const p=pairing();notice='Approve connection '+p.code+' in your browser.';push();
  main.webContents.send('studio:connection-code',{code:p.code});
  await shell.openExternal(p.url);
  const end=Date.now()+180000;
  while(Date.now()<end&&!quitting){
   await new Promise(resolve=>setTimeout(resolve,3500));
   let response;try{response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{action:'redeem',id:p.id,verifier:p.verifier}}),redirect:'error',signal:AbortSignal.timeout(12000)});}catch{notice='Waiting for a connection. Check your internet and approve '+p.code+' in the browser.';push();continue;}
   if(response.status===404)throw Error('Deploy the Windows Studio sign-in service first, then try again.');
   const body=await response.json();if(!response.ok)throw Error(body.error?.message||'Desktop sign-in is unavailable. Deploy the desktop sign-in service and try again.');
   const result=body.result||body.data;if(result?.state==='approved'&&typeof result.token==='string'){notice='Connected. Opening your Studio account…';push();showMain();return result.token;}
  }
  throw Error('Sign-in timed out. Start again and approve the connection in your browser.');
 })();try{return await connecting;}catch(error){notice=error.message||'Sign-in did not finish.';push();throw error;}finally{connecting=null;}
}
function makeMain(){main=new BrowserWindow({title:'LightCity Studio',width:1280,height:900,minWidth:620,minHeight:500,show:false,alwaysOnTop:settings.alwaysOnTop,icon:join(directory,'assets/studio.png'),webPreferences:{preload:join(directory,'preload.cjs'),partition:'persist:lightcity-studio',contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 main.webContents.session.setPermissionRequestHandler((_contents,permission,callback)=>callback(permission==='clipboard-sanitized-write'));
 main.webContents.session.setPermissionCheckHandler((_contents,permission)=>permission==='clipboard-sanitized-write');
 secureNavigation(main);main.on('close',event=>{if(!quitting){event.preventDefault();main.hide();}});
 main.once('ready-to-show',()=>{if(!smoke&&!process.argv.includes('--background'))main.show();});
 main.webContents.on('did-fail-load',(_event,code,_description,_url,isMainFrame)=>{if(isMainFrame&&code!==-3)void main.loadFile(join(directory,'offline.html'));});
 if(!smoke)void main.loadURL(appURL);
}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',showMain);app.on('before-quit',()=>{quitting=true;});
 app.on('window-all-closed',()=>{if(quitting)app.quit();});
 app.whenReady().then(async()=>{
  try{settings=preferences(JSON.parse(await readFile(prefsFile(),'utf8')));}catch{}
  makeMain();makeAlerts();
  tray=new Tray(nativeImage.createFromPath(join(directory,'assets/studio.png')).resize({width:20,height:20}));tray.on('double-click',showMain);menu();
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Studio',submenu:[{label:'Unresolved alerts',click:()=>showAlerts()},{label:'Desktop settings',click:()=>{notice='Desktop settings';showAlerts();}},{type:'separator'},{role:'quit'}]},{label:'View',submenu:[{label:'Refresh Studio',click:()=>{if(!smoke)void main.loadURL(appURL);}},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}]));
  handle('studio:connect',connect);
  handle('studio:reports',data=>{
   if(!data||!Array.isArray(data.reports))throw Error('Invalid alert update');
   const uid=typeof data.uid==='string'&&data.uid.length<=128?data.uid:null;if(!uid){clearIdentity();return;}
   if(owner!==uid){clearIdentity();owner=uid;}
   const result=reconcile(reports,cleanReports(data.reports));reports=result.rows;lastSync=Date.now();notice='';
   if(result.newRows.length){ring=settings.sound;for(const row of result.newRows.slice(0,3))toast(reportHeading(row),row.message||row.title);showAlerts(false);}push();return {count:reports.length};
  });
  handle('studio:ready',data=>{if(typeof data?.uid!=='string'||data.uid!==owner||!studioURL(STUDIO))return;const url=externalURL(data.url);if(!url||new URL(url).origin!==new URL(STUDIO).origin)return;ready={uid:owner,title:String(data.title||'Ready to share').slice(0,300),url};ring=settings.sound;toast('LightCity link ready',ready.title);showAlerts(false);push();});
  handle('studio:handled-result',data=>{if(data?.uid!==owner)return;if(data.ok){reports=reports.filter(r=>r.id!==data.id);notice='Marked handled on all devices.';}else notice=String(data.message||'Could not mark handled. Please try again.').slice(0,240);push();});
  handle('studio:show-alerts',()=>showAlerts());handle('studio:settings',()=>{showAlerts();return settings;});
  ipcMain.on('alerts:loaded',event=>{if(trusted(event,true))push();});
  handle('alerts:action',async({type,value}={})=>{
   if(type==='open')showMain();
   else if(type==='handled'&&reports.some(r=>r.id===value)){main.webContents.send('studio:handle-report',{id:value,uid:owner});notice='Updating the shared report…';push();}
   else if(type==='settings'){if(!value||Object.keys(value).some(k=>!['sound','alwaysOnTop','openAtLogin'].includes(k)))throw Error('Invalid settings');return saveSettings(value);}
   else if(type==='copy'&&ready){clipboard.writeText(ready.url);notice='Share link copied.';push();}
   else if(type==='dismiss-ready'){ready=null;push();}
   else if(type==='retry'){if(!smoke)void main.loadURL(appURL);showMain();}
   else if(type==='hide')alerts.hide();
   return state();
  },true);
  if(smoke){owner='qa-admin';reports=cleanReports([{id:'a'.repeat(64),title:'LightCity Prayer Meeting',issue:'volume',sender:{name:'Samuel Example'},count:1,createdAt:Date.now(),videoId:'abcdefghijk'}]);lastSync=Date.now();push();}
 }).catch(async()=>{await dialog.showMessageBox({type:'error',message:'LightCity Studio could not start. Please reopen it.'});quitting=true;app.quit();});
}
