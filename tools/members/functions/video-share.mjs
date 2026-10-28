import {shareVideoUrl} from './direct-library.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function serveVideoShare(req,res,db){
 res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(req.method)){res.status(405).send('Method not allowed');return;}
 const match=req.path.match(/^\/Share\/(Video|Audio)\/([\w-]{11})\/$/);
 if(!match){res.status(404).send('Video unavailable');return;}
 const [,kind,id]=match,current=await db.doc('churchVideoLibrary/current').get(),videos=current.data()?.videos;
 if(!Array.isArray(videos)){res.status(503).send('Please try again shortly');return;}
 // A preview of a known member ID may show its title, just like existing share cards.
 // It grants no access: the destination still verifies church membership.
 const row=videos.find(v=>v.id===id)||videos.find(v=>v.replaces?.includes(id));
 if(!row){res.status(404).send('Video unavailable');return;}
 const target='https://lightcityfellowship.com/Watch/?v='+row.id+(kind==='Audio'?'&mode=audio':''),title=escape(row.title||'LightCity video'),description=kind==='Audio'?'Listen to this recording on LightCity Teaching Fellowship.':'Watch this video on LightCity Teaching Fellowship.';
 const image='https://i.ytimg.com/vi/'+row.id+'/mqdefault.jpg',url=shareVideoUrl(id,kind==='Audio');
 res.status(200).type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | LightCity</title><meta property="og:type" content="video.other"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="${image}"><meta property="og:image:width" content="320"><meta property="og:image:height" content="180"><meta property="og:url" content="${escape(url)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:image" content="${image}"><meta http-equiv="refresh" content="0;url=${escape(target)}"><meta name="robots" content="noindex"></head><body><p>Opening ${title}…</p><a href="${escape(target)}">Open on LightCity</a><script>location.replace(${JSON.stringify(target).replace(/</g,'\\u003c')})</script></body></html>`);
}