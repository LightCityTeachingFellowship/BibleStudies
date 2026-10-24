import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { createMemberHandlers } from './core.mjs';
import { createAudioSigner, createAudioCredentialCheck, checkAudioLink } from './audio.mjs';
import { readFileSync } from 'node:fs';
initializeApp();
const registrationCode = defineSecret('CHURCH_REGISTRATION_CODE');
const r2Account = defineString('R2_AUDIO_ACCOUNT_ID');
const r2Bucket = defineString('R2_AUDIO_BUCKET', { default: 'lightcity-audio' });
const r2Access = defineSecret('R2_AUDIO_ACCESS_KEY_ID');
const r2Secret = defineSecret('R2_AUDIO_SECRET_ACCESS_KEY');
const audioConfig = () => ({ accountId: r2Account.value(), bucket: r2Bucket.value(), accessKeyId: r2Access.value(), secretAccessKey: r2Secret.value() });
const audio = {
  credentials: createAudioCredentialCheck(audioConfig),
  check: checkAudioLink,
  catalog: JSON.parse(readFileSync(new URL('./audio-catalog.json', import.meta.url), 'utf8')),
  sign: createAudioSigner(audioConfig)
};
const handlers = createMemberHandlers({ audio, auth: getAuth(), db: getFirestore(), secret: () => registrationCode.value(), fail: HttpsError, stamp: () => FieldValue.serverTimestamp() });
// Browsers must reach the callable handler; it verifies Firebase identity and church membership.
const options = { invoker: 'public', region: 'us-central1', maxInstances: 5, cors: ['https://lightcityfellowship.com', 'https://www.lightcityfellowship.com', 'https://lightcityteachingfellowship.github.io', /^http:\/\/localhost(:\d+)?$/] };
export const registerChurchMember = onCall({ ...options, secrets: [registrationCode] }, handlers.registerChurchMember);
export const getChurchLibrary = onCall(options, handlers.getChurchLibrary);
export const linkChurchDevice = onCall(options, handlers.linkChurchDevice);
export const unlinkChurchDevice = onCall(options, handlers.unlinkChurchDevice);

export const registerGoogleChurchMember = onCall({ ...options, secrets: [registrationCode] }, handlers.registerGoogleChurchMember);

export const getChurchAudio = onCall({ ...options, secrets: [r2Access, r2Secret] }, handlers.getChurchAudio);
