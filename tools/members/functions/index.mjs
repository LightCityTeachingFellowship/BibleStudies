import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { createMemberHandlers } from './core.mjs';
initializeApp();
const registrationCode = defineSecret('CHURCH_REGISTRATION_CODE');
const handlers = createMemberHandlers({ auth: getAuth(), db: getFirestore(), secret: () => registrationCode.value(), fail: HttpsError, stamp: () => FieldValue.serverTimestamp() });
// Browsers must reach the callable handler; it verifies Firebase identity and church membership.
const options = { invoker: 'public', region: 'us-central1', maxInstances: 5, cors: ['https://lightcityfellowship.com', 'https://www.lightcityfellowship.com', 'https://lightcityteachingfellowship.github.io', /^http:\/\/localhost(:\d+)?$/] };
export const registerChurchMember = onCall({ ...options, secrets: [registrationCode] }, handlers.registerChurchMember);
export const getChurchLibrary = onCall(options, handlers.getChurchLibrary);
export const linkChurchDevice = onCall(options, handlers.linkChurchDevice);
export const unlinkChurchDevice = onCall(options, handlers.unlinkChurchDevice);

export const registerGoogleChurchMember = onCall({ ...options, secrets: [registrationCode] }, handlers.registerGoogleChurchMember);
