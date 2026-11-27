// Treat encoded and literal brackets as the same publication path.
export function sameReadingURL(a,b,origin){try{const x=new URL(a,origin),y=new URL(b,origin);return x.origin===y.origin&&decodeURI(x.pathname).normalize('NFC')===decodeURI(y.pathname).normalize('NFC')&&x.search===y.search}catch{return false}}
export function waitForReadingSession(session,signal,timeout=15000){
 if(!['loading','verifying'].includes(session.state.status))return Promise.resolve();
 return new Promise((resolve,reject)=>{let unsubscribe=()=>{},done=false;const finish=error=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);unsubscribe();error?reject(error):resolve()};const abort=()=>finish(Object.assign(Error('Cancelled'),{name:'AbortError'}));const timer=setTimeout(()=>finish(Error('Sign-in is taking too long. Please refresh and try again.')),timeout);if(signal?.aborted)return abort();signal?.addEventListener('abort',abort,{once:true});unsubscribe=session.subscribe(state=>{if(!['loading','verifying'].includes(state.status))finish()});if(done)unsubscribe()});
}
