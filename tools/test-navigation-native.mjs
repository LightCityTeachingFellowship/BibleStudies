import assert from 'node:assert/strict';
const calls=[];
const parent={location:{origin:'https://lightcity.example'},LightCityNavigationShell:{isAndroid:true,async plugins(){return {audio:{async stop(){calls.push('stop')}},auth:{async signOut(){calls.push('signout')},async signInWithGoogle(){return {credential:{idToken:'test-token'}}}}}}}};
globalThis.location={origin:'https://lightcity.example'};
globalThis.parent=parent;
globalThis.frameElement={parentElement:{id:'lightcity-pages'}};
const native=await import('../script/native-app.mjs?shell-test');
assert.equal(native.isAndroidApp(),true);
assert.equal((await native.nativeGoogleCredential()).idToken,'test-token');
await native.nativeSignOut();
assert.deepEqual(calls,['stop','signout']);
globalThis.frameElement={parentElement:{id:'other-frame'}};
assert.equal(native.isAndroidApp(),false,'only a navigation shell page can use its bridge');
console.log('PASS: shell pages delegate Android authentication and playback calls to the main window');

