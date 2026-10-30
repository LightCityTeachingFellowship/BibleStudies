import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {EventEmitter} from 'node:events';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';import * as core from './core.mjs';
test('native app validates callers, deduplicates alerts, waits for server acknowledgement and keeps running in the tray',async()=>{
 const handlers=new Map(),windows=[],toasts=[],opened=[],files=[];const app=new EventEmitter();Object.assign(app,{isPackaged:false,setAppUserModelId(){},requestSingleInstanceLock:()=>true,whenReady:async()=>{},getPath:()=>'/qa',setLoginItemSettings(){},quit(){app.emit('before-quit');}});
 class Contents extends EventEmitter{constructor(){super();this.mainFrame={url:''};this.messages=[];this.session={setPermissionRequestHandler(){},setPermissionCheckHandler(){}};}setWindowOpenHandler(fn){this.popup=fn;}send(...v){this.messages.push(v);}isLoading(){return false;}}
 class Window extends EventEmitter{constructor(config){super();this.config=config;this.webContents=new Contents();this.top=config.alwaysOnTop;this.visible=false;windows.push(this);}isDestroyed(){return false;}isMinimized(){return false;}restore(){}show(){this.visible=true;}showInactive(){this.visible=true;}focus(){}hide(){this.visible=false;}setAlwaysOnTop(value){this.top=value;}loadURL(url){this.webContents.mainFrame.url=url;return Promise.resolve();}loadFile(path){this.webContents.mainFrame.url=pathToFileURL(path).href;return Promise.resolve();}}
 class Toast extends EventEmitter{static isSupported(){return true;}constructor(data){super();this.data=data;toasts.push(this);}show(){}}
 const ipcMain=new EventEmitter();ipcMain.handle=(name,fn)=>handlers.set(name,fn);
 const electron={app,BrowserWindow:Window,Menu:{buildFromTemplate:v=>v,setApplicationMenu(){}},Tray:class extends EventEmitter{setToolTip(){}setContextMenu(){}},Notification:Toast,ipcMain,shell:{openExternal:async url=>opened.push(url)},nativeImage:{createFromPath:()=>({resize(){return this;}})},clipboard:{writeText:value=>files.push(value)},dialog:{showMessageBox:async()=>{throw Error('Unexpected startup failure');}}};
 const fs={readFile:async()=>{throw Error('Not found');},mkdir:async()=>{},writeFile:async(...args)=>files.push(args)};
 const context=vm.createContext({URL,AbortSignal,console,process:{argv:['node','test'],execPath:'electron.exe'},setTimeout:fn=>{queueMicrotask(fn);return 0;},fetch:async()=>Response.json({result:{state:'approved',token:'test-one-use-token'}}),Response});
 const synthetic=values=>{const mod=new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context});return mod;};
 const source=readFileSync(new URL('./main.mjs',import.meta.url),'utf8');const module=new vm.SourceTextModule(source,{context,initializeImportMeta:meta=>{meta.url=new URL('./main.mjs',import.meta.url).href;}});
 await module.link(async name=>name==='electron'?synthetic(electron):name==='node:fs/promises'?synthetic(fs):name==='./core.mjs'?synthetic(core):synthetic(await import(name)));await module.evaluate();for(let i=0;i<12;i++)await Promise.resolve();
 assert.equal(windows.length,2);const [main,alerts]=windows;assert.equal(main.config.webPreferences.nodeIntegration,false);assert.equal(main.config.webPreferences.sandbox,true);assert.equal(main.config.webPreferences.contextIsolation,true);assert.equal(main.config.webPreferences.backgroundThrottling,false);
 const invoke=(name,data,local=false)=>{const wc=(local?alerts:main).webContents;return handlers.get(name)({sender:wc,senderFrame:wc.mainFrame},data);};
 const report={id:'a'.repeat(64),title:'Prayer meeting',issue:'volume',sender:{name:'Samuel'},count:1};
 await invoke('studio:reports',{uid:'admin',reports:[report]});assert.equal(toasts.length,1);assert.ok(alerts.visible);
 await invoke('studio:reports',{uid:'admin',reports:[report]});assert.equal(toasts.length,1,'polling does not repeat the same toast');
 await invoke('studio:reports',{uid:'admin',reports:[{...report,count:2}]});assert.equal(toasts.length,2);
 await invoke('alerts:action',{type:'handled',value:report.id},true);assert.equal(main.webContents.messages.at(-1)[0],'studio:handle-report');
 const latest=()=>alerts.webContents.messages.filter(v=>v[0]==='alerts:state').at(-1)[1];assert.equal(latest().reports.length,1,'no optimistic acknowledgement');
 await invoke('studio:handled-result',{uid:'admin',id:report.id,ok:false});assert.equal(latest().reports.length,1);
 await invoke('studio:handled-result',{uid:'admin',id:report.id,ok:true});assert.equal(latest().reports.length,0);
 await invoke('studio:ready',{uid:'admin',title:'Ready',url:'javascript:alert(1)'});assert.equal(latest().ready,null);
 await invoke('studio:ready',{uid:'admin',title:'Ready',url:core.STUDIO});assert.equal(latest().ready.title,'Ready');
 await invoke('studio:reports',{uid:null,reports:[]});assert.equal(latest().ready,null);assert.equal(latest().reports.length,0);
 main.webContents.mainFrame.url='https://untrusted.example/Admin/';await assert.rejects(invoke('studio:show-alerts'),/only inside/);main.webContents.mainFrame.url=core.STUDIO;
 await assert.rejects(handlers.get('studio:show-alerts')({sender:main.webContents,senderFrame:{url:core.STUDIO}}),/only inside/,'child frames cannot invoke native actions');
 await invoke('alerts:action',{type:'settings',value:{alwaysOnTop:true,sound:false}},true);assert.equal(main.top,true);
 main.show();main.emit('close',{preventDefault(){}});assert.equal(main.visible,false,'closing hides instead of quitting');
 const token=await invoke('studio:connect');assert.equal(token,'test-one-use-token');assert.equal(new URL(opened.at(-1)).origin,core.ORIGIN);assert.ok(!opened.at(-1).includes(token));assert.ok(!JSON.stringify(files).includes(token),'token is never saved by the native shell');
 });
