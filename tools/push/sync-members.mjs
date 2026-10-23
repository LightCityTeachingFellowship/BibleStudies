import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { fileURLToPath } from 'node:url';
import { loadVideoLibrary } from '../video-library.mjs';
const videos = await loadVideoLibrary(fileURLToPath(new URL('../..', import.meta.url)));
if (Buffer.byteLength(JSON.stringify(videos)) > 850000) throw Error('Library is too large for one document; split it before syncing.');
if (process.env.DRY_RUN === 'true') { console.log(`Validated ${videos.length} member-library records. No remote changes.`); }
else {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  await getFirestore().doc('churchVideoLibrary/current').set({ videos, updatedAt: FieldValue.serverTimestamp() });
  console.log(`Synced ${videos.length} library records. No notifications sent.`);
}
