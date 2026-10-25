import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
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
export const getMyVideoActivity = onCall(options, activity.getMyVideoActivity);
export const updateMyVideoActivity = onCall(options, activity.updateMyVideoActivity);
