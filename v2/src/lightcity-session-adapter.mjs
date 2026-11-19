// Bridge to the existing, server-verified LightCity membership service.
// Nothing in this adapter reads private access from local storage.
export function createLightCitySessionAdapter({ api, events }) {
 if (!api?.ready || !events?.addEventListener) throw Error('Membership service is unavailable');
 return {
  observe(onChange) {
   let active=true;
   const notify=()=>{if(active&&!api.loading)onChange(api.user)};
   events.addEventListener('lightcity-members-changed',notify);
   Promise.resolve(api.ready).then(notify,()=>{if(active)onChange(null)});
   return()=>{active=false;events.removeEventListener('lightcity-members-changed',notify)};
  },
  async verify(user) {
   await api.ready;
   if(api.loading||!api.user||api.user.isAnonymous||api.user.uid!==user.uid||!Array.isArray(api.library))throw Error('Membership has not been verified');
   return {library:api.library};
  },
  hasVerifiedAccess(user){return !!api.user&&!api.user.isAnonymous&&api.user.uid===user.uid&&Array.isArray(api.library)},
  isCurrent(user){return !!api.user&&!api.user.isAnonymous&&api.user.uid===user.uid},
  signIn(){return api.signInForVideos()},
  signOut(){return api.signOut()}
 };
}
