// Bounded startup retries allow YouTube time to recognise the OBS stream.
export async function findBroadcast({lookup,active,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 for(const delay of [0,20000,20000,40000]){if(delay)await wait(delay);if(!active())return null;let url;try{url=await lookup();}catch{}if(!active())return null;if(url)return url;}
 return null;
}
