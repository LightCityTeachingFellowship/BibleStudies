import assert from 'node:assert/strict';
import {createAudioArchive,archiveFilename} from './audio-archive.mjs';
class Failure extends Error{constructor(code,message){super(message);this.code=code;}}
const id='a'.repeat(32),commands=[];let time=1000;
class Client{async send(command){commands.push(command.input);return {Body:{transformToString:async()=>JSON.stringify({recordings:[{id,title:'A message / question?',group:'Fellowship Days',durationSeconds:3600,secret:'never expose',objectKey:'untrusted'}]})}};}destroy(){}}
let signed;
const api=createAudioArchive(()=>({accountId:'b'.repeat(32),bucket:'lightcity-audio',accessKeyId:'test',secretAccessKey:'test'}),Failure,{Client,now:()=>time,sign:async(client,command)=>{signed=command.input;return 'https://example.com/signed';}});
const list=await api({data:{}});assert.equal(list.recordings.length,1);assert.equal(list.recordings[0].secret,undefined);assert.equal(list.recordings[0].objectKey,undefined);assert.equal(list.recordings[0].url,undefined);
await assert.rejects(api({data:{id:'../private'}}),e=>e.code==='invalid-argument');
await assert.rejects(api({data:{id:'c'.repeat(32)}}),e=>e.code==='not-found');
const result=await api({data:{id,download:true,objectKey:'private.json'}});assert.equal(result.url,'https://example.com/signed');assert.equal(signed.Key,'archive/'+id+'.mp3');assert.equal(signed.ResponseContentType,'audio/mpeg');assert.match(signed.ResponseContentDisposition,/A%20message/);assert.equal(commands.length,1);
assert.equal(archiveFilename('../a?'),'.. a.mp3');time+=31000;await api({data:{}});assert.equal(commands.length,2);
console.log('PASS: public metadata only, unsafe/unknown IDs rejected, strict object keys, MP3 downloads and catalogue cache expiry.');

