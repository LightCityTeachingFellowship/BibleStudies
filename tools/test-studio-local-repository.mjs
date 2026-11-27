import assert from 'node:assert/strict';
import {syncLocalRepository} from './studio-local-repository.mjs';
function fake({branch='master',edits='',same=false,conflict=false}={}){const calls=[];return {calls,run:async(_command,args)=>{calls.push(args);const action=args[0];if(action==='branch')return {stdout:branch+'\n'};if(action==='status')return {stdout:edits};if(action==='fetch')return {stdout:''};if(action==='rev-parse')return {stdout:args[1]==='HEAD'?'local':same?'local':'remote'};if(action==='merge'){if(conflict)throw Object.assign(Error('conflict'),{stderr:'Local edits conflict'});return {stdout:'ok'}}throw Error('unexpected git command');}}}
let f=fake({edits:'?? Posts-Summaries/_posts/new.html\0'});assert.equal((await syncLocalRepository('x',{run:f.run})).reason,'local-learning-edits');assert.ok(!f.calls.some(a=>a[0]==='fetch'||a[0]==='merge'));
f=fake({branch:'other'});assert.equal((await syncLocalRepository('x',{run:f.run})).reason,'branch');
f=fake();assert.equal((await syncLocalRepository('x',{run:f.run})).changed,true);assert.ok(f.calls.some(a=>a[0]==='merge'&&a.includes('--ff-only')));assert.ok(!f.calls.some(a=>['reset','stash','push','commit'].includes(a[0])));
f=fake({conflict:true});assert.equal((await syncLocalRepository('x',{run:f.run})).reason,'needs-review');
console.log('PASS: background repository sync fast-forwards only and preserves unsynced learning files.');
