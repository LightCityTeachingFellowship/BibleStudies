import {S3Client,GetObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
export const validArchiveId=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
export function archiveFilename(title){return (String(title||'LightCity message').replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g,' ').trim().slice(0,170)||'LightCity message')+'.mp3';}
export function createAudioArchive(config,fail,{Client=S3Client,sign=getSignedUrl,now=Date.now}={}){
 let cached=[],until=0;
 return async request=>{
  const data=request.data||{};
  if(data.id!==undefined&&!validArchiveId(data.id))throw new fail('invalid-argument','Invalid archive message');
  const c=config(),client=new Client({region:'auto',forcePathStyle:true,endpoint:`https://${c.accountId}.r2.cloudflarestorage.com`,credentials:{accessKeyId:c.accessKeyId,secretAccessKey:c.secretAccessKey}});
  try{
   if(now()>until){try{const object=await client.send(new GetObjectCommand({Bucket:c.bucket,Key:'archive/catalog.json'}),{abortSignal:AbortSignal.timeout(15000)});const result=JSON.parse(await object.Body.transformToString());if(!Array.isArray(result.recordings))throw Error();cached=result.recordings.filter(r=>validArchiveId(r.id)&&typeof r.title==='string'&&Number(r.durationSeconds)>0).map(({id,title,group,year,series,durationSeconds,bytes})=>({id,title,group,year,series,durationSeconds,bytes}));until=now()+30000;}catch(e){if(e.$metadata?.httpStatusCode===404){cached=[];until=now()+10000;}else throw new fail('unavailable','The message archive could not load. Please retry.');}}
   if(!data.id)return {recordings:cached};
   const row=cached.find(r=>r.id===data.id);if(!row)throw new fail('not-found','Message not found');
   const disposition=data.download?"attachment; filename=\"LightCity message.mp3\"; filename*=UTF-8''"+encodeURIComponent(archiveFilename(row.title)).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase()):undefined;
   const url=await sign(client,new GetObjectCommand({Bucket:c.bucket,Key:`archive/${row.id}.mp3`,ResponseContentType:'audio/mpeg',...(disposition?{ResponseContentDisposition:disposition}:{})}),{expiresIn:28800});
   return {...row,url,expiresAt:now()+28800000};
  }finally{client.destroy();}
 };
}
