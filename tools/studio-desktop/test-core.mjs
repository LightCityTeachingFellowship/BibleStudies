import test from 'node:test';import assert from 'node:assert/strict';
import {pairing,studioURL,externalURL,cleanReports,reconcile,preferences} from './core.mjs';
test('desktop navigation and external links stay restricted',()=>{
 for(const url of ['https://lightcityfellowship.com/Admin/','https://lightcityfellowship.com/Admin/?reports=1'])assert.equal(studioURL(url),true);
 for(const url of ['https://lightcityfellowship.com.attacker.test/Admin/','https://attacker@lightcityfellowship.com/Admin/','http://lightcityfellowship.com/Admin/','https://lightcityfellowship.com/members/','file:///Admin/','javascript:alert(1)'])assert.equal(studioURL(url),false);
 for(const url of ['file:///C:/a','powershell:run','javascript:alert(1)','https://u:p@example.com/'])assert.equal(externalURL(url),null);
});
test('browser pairing never includes the secret verifier or token in its URL',()=>{const p=pairing(),q=pairing();assert.notEqual(p.id,q.id);assert.match(p.verifier,/^[\w-]{43}$/);assert.ok(!p.url.includes(p.verifier));assert.match(p.code,/^[A-F0-9]{4}-[A-F0-9]{4}$/);assert.equal(new URL(p.url).searchParams.get('desktopChallenge'),p.challenge);});
test('reports stay until resolved; only new or increased reports notify',()=>{
 const a={id:'a'.repeat(64),issue:'volume',sender:{name:'Sam'},count:1,title:'Stream'},b={...a,id:'b'.repeat(64)};
 const old=cleanReports([a]);assert.equal(reconcile(old,cleanReports([a,b])).newRows.length,1);
 assert.equal(reconcile(old,cleanReports([{...a,count:2}])).newRows.length,1);
 assert.equal(reconcile(old,cleanReports([a])).newRows.length,0);
 assert.equal(reconcile(old,cleanReports([{...a,resolved:true}])).rows.length,0);
 assert.equal(cleanReports([{...a,id:'../unsafe'},null]).length,0);
 assert.deepEqual(preferences({sound:false,openAtLogin:true,alwaysOnTop:'yes',extra:true}),{sound:false,openAtLogin:true,alwaysOnTop:false});
});
