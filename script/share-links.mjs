export function videoShareLink(id,{audio=false,base='https://auth.lightcityfellowship.com/'}={}){
 if(!/^[\w-]{11}$/.test(id||''))return null;
 const url=new URL(base);if(url.protocol!=='https:')return null;if(url.hostname==='lightcityfellowship.com'||url.hostname==='www.lightcityfellowship.com')url.hostname='auth.lightcityfellowship.com';
 url.search='';url.hash='';url.pathname=url.pathname.replace(/\/Watch\/?$/,'/');if(!url.pathname.endsWith('/'))url.pathname+='/';
 return new URL(`Share/${audio?'Audio':'Video'}/${id}/`,url).href;
}
