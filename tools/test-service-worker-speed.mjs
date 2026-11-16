import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync('service-worker.js','utf8').replace(/^---[\s\S]*?---\s*/,'');
const handlers=new Map(); let resolveNetwork, saved;
const cached={label:'cached'},fresh={label:'fresh',ok:true,headers:{get:()=> 'text/javascript'},clone(){return this;}};
const caches={match:async()=>cached,open:async()=>({put:async(_req,res)=>{saved=res;},keys:async()=>[]})};
const self={location:{href:'https://example.com/service-worker.js'},LIGHTCITY_PUSH:{enabled:false},addEventListener:(name,fn)=>handlers.set(name,fn)};
vm.runInNewContext(code,{self,URL,Date,Map,caches,Response:{error:()=>({error:true})},fetch:()=>new Promise(r=>{resolveNetwork=r;}),importScripts(){}});
async function request(path,destination){let response,background;handlers.get('fetch')({request:{method:'GET',url:'https://example.com/'+path,destination},respondWith:p=>response=p,waitUntil:p=>background=p});return {response,background};}
const first=await request('script/test.js?v=1','script');
assert.equal(await Promise.race([first.response,new Promise(resolve=>setTimeout(()=>resolve('timeout'),50))]),cached,'versioned cached scripts should not wait for the network');
resolveNetwork(fresh);await first.background;assert.equal(saved,fresh,'network refresh updates the cache');
const second=await request('script/test.js','script');
assert.equal(await Promise.race([second.response,new Promise(resolve=>setTimeout(()=>resolve('waiting'),50))]),'waiting','unversioned assets stay network-first');
resolveNetwork(fresh);assert.equal(await second.response,fresh);
console.log('PASS: cached versioned assets respond without waiting for the network; updates refresh in background and unversioned assets remain network-first.');
