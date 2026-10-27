import {mkdir,readdir,writeFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
const valid=id=>/^[\w-]{11}$/.test(id||'');
const escape=value=>String(value).replace(/[&<>"'{}]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','{':'&#123;','}':'&#125;'}[c]));
export function videoPreview(video,{sharedId=video.id,audio=false,base='https://lightcityfellowship.com/'}={}){
 if(!valid(video.id)||!valid(sharedId))throw Error('Invalid video ID');
 const site=new URL(base);if(site.protocol!=='https:'||site.username||site.password||site.search||site.hash)throw Error('Invalid website URL');
 const kind=audio?'Audio':'Video',permalink=`/Share/${kind}/${sharedId}/`;
 const canonical=new URL(`Share/${kind}/${sharedId}/`,site).href;
 const target=new URL(`${audio?'Listen':'Watch'}/?v=${video.id}`,site);
 const destination=target.pathname+target.search;
 const title=video.title||'LightCity recording',image=`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
 const description=`${audio?'Listen to':'Watch'} this recording on LightCity Teaching Fellowship.`;
 return `---\nlayout: null\npermalink: ${JSON.stringify(permalink)}\ntitle: ${JSON.stringify(title)}\nsitemap: false\n---\n<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escape(title)} | LightCity</title>
<meta property="og:type" content="website"><meta property="og:site_name" content="LightCity Teaching Fellowship"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:image" content="${escape(image)}"><meta property="og:image:width" content="480"><meta property="og:image:height" content="360"><meta property="og:image:alt" content="${escape(title)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${escape(image)}"><link rel="canonical" href="${escape(canonical)}"></head>
<body style="font-family:system-ui,sans-serif;padding:32px;max-width:800px;margin:auto"><p>LightCity Teaching Fellowship</p><h1>${escape(title)}</h1><p><a href="${escape(destination)}">${audio?'Listen':'Watch'} on LightCity</a></p><script>location.replace(${JSON.stringify(destination)});</script></body></html>\n`;
}
export async function writeVideoSharePages(root,videos){
 const directory=join(root,'share-previews');await mkdir(directory,{recursive:true});const files=new Set();const active=new Set(videos.map(v=>v.id));
 for(const video of videos){
  const ids=[video.id,...(video.replaces||[]).filter(id=>valid(id)&&!active.has(id))];
  for(const id of ids)for(const audio of [false,true]){
   const name=`lc-${audio?'audio':'video'}-${id}.html`;files.add(name);await writeFile(join(directory,name),videoPreview(video,{sharedId:id,audio}));
  }
 }
 for(const name of await readdir(directory))if(/^lc-(?:audio|video)-[\w-]{11}\.html$/.test(name)&&!files.has(name))await unlink(join(directory,name));
 return files.size;
}
