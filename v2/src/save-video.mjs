export async function toggleSavedVideo({services,id,title}){
 if(!/^[A-Za-z0-9_-]{11}$/.test(id||''))throw Error('Invalid recording');
 const personal=await services.getPersonal();await personal.ready;
 const state=services.session.state,expected=state.user&&!state.user.isAnonymous?'user:'+state.user.uid:'device';
 if(personal.scope!==expected)throw Error('Your library is still updating. Please try again.');
 const wanted=!personal.saved(id);personal.save(id,title,wanted);void personal.flush?.();return wanted;
}
