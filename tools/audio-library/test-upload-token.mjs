import assert from 'node:assert/strict';
import { deriveR2Secret } from '../audio-pilot/verify-pair.mjs';
import { verifyUploadToken } from './verify-upload-token.mjs';
const tokenValue = 'test-token-for-upload-verification-only', accessKeyId = 'a'.repeat(32), accountId = 'b'.repeat(32);
const input = { accountId, accessKeyId, tokenValue, secretAccessKey: deriveR2Secret(tokenValue) };
let calls = 0;
const send = async (url, init) => { calls++; assert.equal(new URL(url).hostname, 'api.cloudflare.com'); assert.ok(!url.includes(tokenValue)); assert.equal(init.headers.Authorization, 'Bearer ' + tokenValue); return Response.json({ success: true, result: { id: accessKeyId, status: 'active' } }); };
await verifyUploadToken(input, send); assert.equal(calls, 1);
await assert.rejects(verifyUploadToken({ ...input, secretAccessKey: '0'.repeat(64) }, send), /did not match/); assert.equal(calls, 1);
for (const result of [{ id: 'c'.repeat(32), status: 'active' }, { id: accessKeyId, status: 'disabled' }]) {
  await assert.rejects(verifyUploadToken(input, async () => Response.json({ success: true, result })), /not active or does not match/);
}
await assert.rejects(verifyUploadToken(input, async () => new Response('', { status: 403 })), /not accepted/);
console.log('PASS: derived upload secret, active matching account token, rejected mismatches, and token sent only in authorization header.');
