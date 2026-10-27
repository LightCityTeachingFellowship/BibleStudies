export function videoShareLink(id,{audio=false,base='https://lightcityfellowship.com/'}={}){
 if(!/^[\w-]{11}$/.test(id||''))return null;
 const url=new URL(base);if(url.protocol!=='https:')return null;
 url.search='';url.hash='';url.pathname=url.pathname.replace(/\/Watch\/?$/,'/');if(!url.pathname.endsWith('/'))url.pathname+='/';
 return new URL(`Share/${audio?'Audio':'Video'}/${id}/`,url).href;
}
