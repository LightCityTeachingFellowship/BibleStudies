import {githubPublisher,createStudioPublishing,validHelperBearer,markStudioSelection} from './studio-publishing.mjs';
import { createAdminDashboard } from './admin.mjs';
import { createReadingActivity } from './reading-activity.mjs';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { createMemberHandlers } from './core.mjs';
import { createVideoActivity } from './video-activity.mjs';
import { createAudioSigner, createAudioCredentialCheck, checkAudioLink } from './audio.mjs';
import { createLiveAudio } from './live-audio.mjs';
import { createRecordedCatalog } from './recorded-catalog.mjs';
import { readFileSync } from 'node:fs';
initializeApp();
const registrationCode = defineSecret('CHURCH_REGISTRATION_CODE');
const r2Account = defineString('R2_AUDIO_ACCOUNT_ID');
const r2Bucket = defineString('R2_AUDIO_BUCKET', { default: 'lightcity-audio' });
const r2Access = defineSecret('R2_AUDIO_ACCESS_KEY_ID');
const r2Secret = defineSecret('R2_AUDIO_SECRET_ACCESS_KEY');
const livePlaybackKey = defineSecret('LIVE_AUDIO_PLAYBACK_KEY');
const liveGateway = defineString('LIVE_AUDIO_GATEWAY', { default: 'https://lightcity-live-audio-test.lightcityteachingfellowship.workers.dev' });
const live = createLiveAudio(() => ({ origin: liveGateway.value(), secret: livePlaybackKey.value() }));
const audioConfig = () => ({ accountId: r2Account.value(), bucket: r2Bucket.value(), accessKeyId: r2Access.value(), secretAccessKey: r2Secret.value() });
const audio = {
  credentials: createAudioCredentialCheck(audioConfig),
  check: checkAudioLink,
  catalog: createRecordedCatalog(() => ({ origin: liveGateway.value(), secret: livePlaybackKey.value() }), {
    staticCatalog: JSON.parse(readFileSync(new URL('./audio-catalog.json', import.meta.url), 'utf8')),
    library: async () => { const snapshot = await getFirestore().doc('churchVideoLibrary/current').get(); return snapshot.exists ? snapshot.data()?.videos : null; }
  }),
  sign: createAudioSigner(audioConfig)
};
const handlers = createMemberHandlers({ audio, live, auth: getAuth(), db: getFirestore(), secret: () => registrationCode.value(), fail: HttpsError, stamp: () => FieldValue.serverTimestamp() });
// Browsers must reach the callable handler; it verifies Firebase identity and church membership.
const options = { invoker: 'public', region: 'us-central1', maxInstances: 5, cors: ['https://lightcityfellowship.com', 'https://www.lightcityfellowship.com', 'https://lightcityteachingfellowship.github.io', /^http:\/\/localhost(:\d+)?$/] };
export const registerChurchMember = onCall({ ...options, secrets: [registrationCode] }, handlers.registerChurchMember);
export const getChurchLibrary = onCall(options, handlers.getChurchLibrary);
export const linkChurchDevice = onCall(options, handlers.linkChurchDevice);
export const unlinkChurchDevice = onCall(options, handlers.unlinkChurchDevice);

export const registerGoogleChurchMember = onCall({ ...options, secrets: [registrationCode] }, handlers.registerGoogleChurchMember);

export const getChurchAudio = onCall({ ...options, secrets: [r2Access, r2Secret, livePlaybackKey] }, handlers.getChurchAudio);
export const getChurchLiveAudio = onCall({ ...options, secrets: [livePlaybackKey] }, handlers.getChurchLiveAudio);

const activity = createVideoActivity({ auth: getAuth(), db: getFirestore(), fail: HttpsError });
export const getVideoReplacements = onCall(options, activity.getVideoReplacements);
export const getMyVideoActivity = onCall(options, activity.getMyVideoActivity);
export const updateMyVideoActivity = onCall(options, activity.updateMyVideoActivity);

const readingActivity = createReadingActivity({auth:getAuth(),db:getFirestore(),fail:HttpsError,privateCatalog:JSON.parse(readFileSync(new URL('./reading-private-catalog.json',import.meta.url),'utf8')).publications});
export const getMyReadingActivity = onCall(options, readingActivity.getMyReadingActivity);
export const updateMyReadingActivity = onCall(options, readingActivity.updateMyReadingActivity);

const adminEmails = defineString('CHURCH_ADMIN_EMAILS', { default: 'lightcityteachingfellowship@gmail.com' });
const adminDashboard = createAdminDashboard({ auth:getAuth(), db:getFirestore(), fail:HttpsError, emails:()=>adminEmails.value(), audio:audio.catalog, live,
 privateReadings:JSON.parse(readFileSync(new URL('./reading-private-catalog.json',import.meta.url),'utf8')).publications });
export const getChurchAdminDashboard = onCall({ ...options, secrets:[livePlaybackKey] }, adminDashboard);
const studioGitHubToken=defineSecret('STUDIO_GITHUB_TOKEN');
const studioGitHub=githubPublisher({token:()=>studioGitHubToken.value()});
const studioPublishing=createStudioPublishing({auth:getAuth(),db:getFirestore(),fail:HttpsError,emails:()=>adminEmails.value(),github:studioGitHub});
export const publishChurchStudioVideo=onCall({...options,secrets:[studioGitHubToken],timeoutSeconds:180},studioPublishing.publish);
export const getChurchStudioPublication=onCall(options,studioPublishing.status);
// Only the trusted local upload helper can read the desired source lists.
let studioSourceCache=null;
export const getStudioHelperLibrary=onRequest({...options,secrets:[studioGitHubToken,livePlaybackKey]},async(req,res)=>{
 const provided=Buffer.from(String(req.get('authorization')||'').replace(/^Bearer /,'')),expected=Buffer.from(livePlaybackKey.value());
 res.set('Cache-Control','no-store');
 if(req.method!=='POST'||!validHelperBearer(req.get('authorization'),livePlaybackKey.value())){res.status(403).json({error:'Access denied'});return;}
 try{
  if(!studioSourceCache||Date.now()-studioSourceCache.at>10000){const [source,requests]=await Promise.all([studioGitHub.snapshot(),getFirestore().collection('churchStudioPublications').orderBy('requestedAt','desc').limit(1).get()]);const videos=[...source.lists.public.map(id=>({id,visibility:'public'})),...source.lists.members.map(id=>({id,visibility:'members'}))];studioSourceCache={at:Date.now(),videos:markStudioSelection(videos,requests.docs[0]?.data())};}
  res.json({videos:studioSourceCache.videos});
 }catch{res.status(503).json({error:'Source library unavailable'});}
});