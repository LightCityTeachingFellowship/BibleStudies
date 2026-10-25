import { ROOT, json, client } from './import.mjs';
import { join } from 'node:path';
import { storageFailure } from './setup-diagnostics.mjs';
import { verifyUploadToken } from './verify-upload-token.mjs';
import { workerOrigin, validSecret } from '../live-audio/cloud/auth.mjs';
let connection;
try {
  const keys = await json(join(ROOT, 'tools/live-audio/work/cloud-secrets.json'));
  if (!validSecret(keys.LIVE_UPLOAD_KEY)) throw Error('Existing gateway setup is missing.');
  const origin = workerOrigin('https://lightcity-live-audio-test.lightcityteachingfellowship.workers.dev');
  const response = await fetch(origin + '/upload/recordings/CwSrbPtbUOw.json', { headers: { Authorization: 'Bearer ' + keys.LIVE_UPLOAD_KEY }, redirect: 'error', signal: AbortSignal.timeout(15000) });
  // 404 from this endpoint is also returned by old workers: use the authenticated catalogue route for capability detection.
  await response.body?.cancel();
  const catalog = await fetch(origin + '/recordings/catalog', { headers: { Authorization: 'Bearer ' + keys.LIVE_PLAYBACK_KEY }, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!catalog.ok || !Array.isArray((await catalog.json()).recordings)) throw Error('Deploy the updated audio gateway before setup.');
  if (process.env.R2_UPLOAD_TOKEN_VALUE) {
    await verifyUploadToken({ accountId: process.env.R2_AUDIO_ACCOUNT_ID, accessKeyId: process.env.R2_UPLOAD_ACCESS_KEY_ID, secretAccessKey: process.env.R2_UPLOAD_SECRET_ACCESS_KEY, tokenValue: process.env.R2_UPLOAD_TOKEN_VALUE });
    console.log('Upload token identity and derived secret verified.');
  }
  connection = await client();
  // HEAD errors omit R2's XML error code. A one-byte GET returns that safe code.
  const checked = await connection.s3.send(new connection.sdk.GetObjectCommand({ Bucket: 'lightcity-audio', Key: 'audio/R42uVd9spDw.m4a', Range: 'bytes=0-0' }), { abortSignal: AbortSignal.timeout(15000) });
  checked.Body?.destroy();
  console.log('Gateway registration endpoint and R2 credentials verified. The token must also have Object Read & Write permission for uploads.');
} catch (error) {
  console.error(error.$metadata ? storageFailure(error) : 'Automatic setup verification failed. Confirm the gateway deployment, internet connection, and R2 credentials.');
  process.exitCode = 1;
} finally { connection?.s3.destroy(); }
