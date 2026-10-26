// Uses the existing controller fixtures, then exercises real persistence hooks against a real tracked player.
import '../test-media-switch.mjs';
import assert from 'node:assert/strict';
import { personal } from '../../script/video-personal.js?v=study-1';
const id='R42uVd9spDw';
document.getElementById=name=>name==='lc-public-video-data'?{textContent:JSON.stringify({[id]:'Teaching'})}:null;
const BasePlayer=window.YT.Player;
window.YT.Player=class extends BasePlayer {constructor(...args){super(...args);this.time=0;this.state=5;}getDuration(){return 3600;}getVideoData(){return {title:'Teaching'};}pauseVideo(){super.pauseVideo();this.events.onStateChange?.({target:this,data:2});}};
personal.progress({videoId:id,title:'Teaching',seconds:123.75,duration:3600,mode:'video',rate:1});
const frame=document.createElement('iframe');frame.src=`https://www.youtube-nocookie.com/embed/${id}`;const viewport=document.createElement('div');viewport.appendChild(frame);
const player=await LightCityMedia.trackYouTube(frame);assert.equal(player.getCurrentTime(),123.75,'opening Watch resumes the saved timestamp');
player.playVideo();player.time=245.5;player.pauseVideo();assert.equal(personal.history(id).seconds,245.5,'video pause saves exact fractional position');
const item=LightCityMedia.mount({viewport,videoId:id,title:'Teaching'});await item.switchTo('audio');assert.equal(item.audio.currentTime,245.5);
await item.audio.play();item.audio.currentTime=300.25;item.audio.dispatchEvent(new Event('timeupdate'));assert.equal(personal.history(id).seconds,300.25);assert.equal(personal.history(id).mode,'audio');
await item.switchTo('video');assert.equal(player.getCurrentTime(),300.25);assert.equal(personal.history(id).mode,'video');
await item.switchTo('audio');await item.audio.play();item.audio.currentTime=315.75;item.dispose();item.audio.currentTime=0;item.audio.dispatchEvent(new Event('pause'));item.dispose();assert.equal(personal.history(id).seconds,315.75,'disposing and clearing the media source cannot overwrite the saved timestamp with zero');
personal.setIdentity('another-user');player.playVideo();player.time=400;player.pauseVideo();assert.equal(personal.history(id),null,'old player callbacks cannot write into a newly signed-in account');
item.dispose();frame.isConnected=false;
console.log('PASS: actual controller restores video history, saves fractional pause positions, shares progress with audio, and rejects callbacks after an account change.');
