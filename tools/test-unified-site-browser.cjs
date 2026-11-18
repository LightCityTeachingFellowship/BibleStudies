const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve('_site');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server = http.createServer((req,res)=>{
 try { let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); let file=path.resolve(root,'.'+pathname); if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return} if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html'); if(!fs.existsSync(file)){res.writeHead(404).end();return}res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(file).pipe(res); } catch {res.writeHead(500).end();}
});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;let browser;
 try {browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let releaseBible;const bibleGate=new Promise(resolve=>releaseBible=resolve);await page.route('**/data/LSJ*',async r=>{await bibleGate;await r.continue()});
 await page.route('**/script/members-v2.js*',r=>r.fulfill({contentType:'text/javascript',body:`globalThis.LightCityMembers={ready:Promise.resolve(),loading:false,user:null,library:null,publicLibrary:[{id:'abcdefghijk',title:'Public video',visibility:'public'}],getAudio:async()=>({recordings:[]}),getLiveAudio:async()=>({recordings:[]}),learning:async()=>({resources:[]})};`}));
 await page.route('**/script/pwa.js*',r=>r.fulfill({contentType:'text/javascript',body:''}));
 await page.goto(origin+'/Home/');await page.waitForURL('**/v2/',{timeout:30000});await page.getByRole('heading',{name:'Grow in the Word.'}).waitFor();assert.equal(await page.locator('#sign-in svg path').getAttribute('d'),'M6 3h12v18l-6-4-6 4z');
 await page.goto(origin+'/Head%20Covering/');await page.waitForURL('**/v2/read/**',{timeout:30000});const article=page.frameLocator('.lc-original-reader');await article.locator('[data-study-body]').waitFor({timeout:60000});assert.equal(await article.locator('script[data-lc-delayed]').count(),9);assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('lc-v2-reader-active')),true);releaseBible();
 await page.goto(origin+'/Jesus/');await page.waitForURL('**/v2/categories/**',{timeout:30000});await page.getByRole('heading',{name:'Jesus',exact:true}).waitFor();
 await page.goto(origin+'/BibleNodesGraph/Access%20To%20God.html');await page.waitForURL('**/v2/legacy/**',{timeout:30000});await page.locator('.lc-v2-legacy-frame:visible').waitFor({timeout:60000});assert.equal(await page.locator('.lc-v2-legacy-frame').getAttribute('title'),'Access To God');
 await page.goto(origin+'/Watch/?v=abcdefghijk');await page.waitForURL('**/v2/watch/',{timeout:30000});assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('lc-v2-watch-active')),true);
 assert.deepEqual(errors,[]);console.log('PASS: built home, original article reader, old category, Bible graph and video links open in the unified app.');
 }finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
