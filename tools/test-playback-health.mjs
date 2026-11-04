import assert from 'node:assert/strict';
import {watchPlayback} from '../script/playback-health.mjs';
class Audio extends EventTarget{currentTime=20;paused=false;ended=false;seeking=false;}
const callbacks=new Map();let next=0,recoveries=0,active=true;
const timers={setTimeout(fn){callbacks.set(++next,fn);return next;},clearTimeout(id){callbacks.delete(id);}};
const run=()=>{for(const [id,fn]of [...callbacks]){callbacks.delete(id);fn();}};
const audio=new Audio(),health=watchPlayback(audio,{active:()=>active,recover:()=>{recoveries++;},timers});
audio.dispatchEvent(new Event('waiting'));assert.equal(callbacks.size,1);run();assert.equal(recoveries,1,'A transport that stops progressing retries');
audio.dispatchEvent(new Event('stalled'));audio.currentTime++;run();assert.equal(recoveries,1,'Recovered buffering is left alone');
audio.dispatchEvent(new Event('waiting'));audio.dispatchEvent(new Event('timeupdate'));assert.equal(callbacks.size,0);
audio.dispatchEvent(new Event('waiting'));audio.paused=true;audio.dispatchEvent(new Event('pause'));run();assert.equal(recoveries,1,'An intentional pause never resumes');
audio.paused=false;audio.seeking=true;health.check();assert.equal(callbacks.size,0);audio.seeking=false;
audio.dispatchEvent(new Event('waiting'));active=false;run();assert.equal(recoveries,1,'Switching playback mode cancels recovery');
active=true;audio.dispatchEvent(new Event('waiting'));health.dispose();run();assert.equal(recoveries,1,'Disposal cancels all recovery work');
console.log('PASS: stalled transport recovery, progressing playback, explicit pause, seeking, mode changes and disposal.');
