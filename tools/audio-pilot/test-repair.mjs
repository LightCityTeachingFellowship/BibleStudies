import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { repairCredentials } from './repair-core.mjs';
const config = { accountId: 'b'.repeat(32), bucket: 'lightcity-audio', accessKeyId: 'a'.repeat(32), apiTokenValue: 'fake-token-for-offline-test' };
let writes = [], reads = 0;
const dependencies = {
  verify: async () => ({ status: 'active', id: config.accessKeyId }),
  read: async settings => { reads++; assert.equal(settings.secretAccessKey, createHash('sha256').update(config.apiTokenValue).digest('hex')); assert.equal(settings.apiTokenValue, undefined); return { ok: true }; },
  save: async (name, value) => writes.push({ name, value })
};
await assert.rejects(() => repairCredentials(config, { ...dependencies, verify: async () => ({ status: 'active', id: 'other' }) }), /TOKEN/);
assert.equal(reads, 0); assert.equal(writes.length, 0);
await assert.rejects(() => repairCredentials(config, { ...dependencies, read: async () => ({ ok: false }) }), /READ/);
assert.equal(writes.length, 0);
await repairCredentials(config, dependencies);
assert.deepEqual(writes.map(item => item.name), ['R2_AUDIO_ACCESS_KEY_ID', 'R2_AUDIO_SECRET_ACCESS_KEY']);
assert.equal(writes[1].value, createHash('sha256').update(config.apiTokenValue).digest('hex'));
console.log('PASS: repair derives the correct secret and saves only after matching token identity and successful R2 read; failed checks make no Firebase writes.');
