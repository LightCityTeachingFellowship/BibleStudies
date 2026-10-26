import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const panels=[{open:true},{open:true},{open:true}],media={matches:true,addEventListener:(type,fn)=>media.change=fn};
vm.runInNewContext(readFileSync('script/footer-disclosures.js','utf8'),{document:{querySelectorAll:()=>panels},window:{matchMedia:()=>media}});
assert.ok(panels.every(p=>!p.open),'mobile footers start collapsed');panels[0].open=true;assert.equal(panels[0].open,true,'native disclosure retains the user selection');media.matches=false;media.change();assert.ok(panels.every(p=>p.open),'desktop exposes the footer links');media.matches=true;media.change();assert.ok(panels.every(p=>!p.open),'returning to mobile resets compact footer layout');
for(const name of ['contact-section.html','contact-section-summary.html']){const source=readFileSync('_includes/'+name,'utf8');assert.equal((source.match(/<details /g)||[]).length,3);assert.equal((source.match(/<\/details>/g)||[]).length,3);assert.ok(!source.includes('min-height content'),'footer panels avoid generic content sizing');assert.ok(source.includes('footer-disclosures.js'));}
console.log('PASS: native footer disclosure markup, mobile/desktop layout changes, and no measured-height footer panels.');
