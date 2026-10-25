import assert from 'node:assert/strict';
import { verifyChannel, lookupFailure } from './setup-channel.mjs';
const key = 'secret_DO_NOT_PRINT_' + 'x'.repeat(20), channelId = 'UC' + 'a'.repeat(22);
for (const reason of ['SERVICE_DISABLED', 'API_KEY_INVALID', 'API_KEY_HTTP_REFERRER_BLOCKED', 'API_KEY_SERVICE_BLOCKED', 'quotaExceeded']) {
 const data = { error: { message: key, details: [{ reason, metadata: { credential: key } }] } };
 const message = lookupFailure(403, data);
 assert.ok(message.includes(reason)); assert.ok(!message.includes(key));
 await assert.rejects(verifyChannel(key, undefined, async () => Response.json(data, { status: 403 })), error => error.message === message);
}
assert.ok(!lookupFailure(403, { error: { status: key, errors: [{ reason: key }], message: key } }).includes(key));
await assert.rejects(verifyChannel(key, undefined, async () => { throw Error(key); }), error => !error.message.includes(key) && /connect/.test(error.message));
await assert.rejects(verifyChannel(key, undefined, async () => Response.json({ items: [] })), /key was accepted/);
const result = await verifyChannel(key, undefined, async url => {
 assert.equal(url.searchParams.get('forHandle'), 'LightCityTeachingFellowship');
 assert.equal(url.searchParams.get('key'), key);
 return Response.json({ items: [{ id: channelId, snippet: { title: 'LightCity' } }] });
});
assert.deepEqual(result, { channelId, channelTitle: 'LightCity' });
console.log('PASS: setup distinguishes API restrictions, disabled API, invalid key, quota, missing handle, and network failure without printing credentials.');
