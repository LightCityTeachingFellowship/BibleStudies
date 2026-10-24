import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, createHmac } from 'node:crypto';
import { minimalAudioLink } from './minimal-signature.mjs';
import { secretMatchesToken } from './verify-pair.mjs';
const require = createRequire(new URL('../members/functions/package.json', import.meta.url));
const { S3RequestPresigner } = require('@aws-sdk/s3-request-presigner');
const { HttpRequest } = require('@smithy/core/protocols');
class Sha256 {
  constructor(secret) { this.hash = secret ? createHmac('sha256', secret) : createHash('sha256'); }
  update(data) { this.hash.update(data); }
  async digest() { return this.hash.digest(); }
}
const config = { accountId: 'a'.repeat(32), bucket: 'lightcity-audio', accessKeyId: 'fake-access', secretAccessKey: 'fake-secret' };
const signingDate = new Date('2026-10-24T12:34:56Z');
const actual = new URL(minimalAudioLink(config, signingDate));
const signer = new S3RequestPresigner({ credentials: config, region: 'auto', sha256: Sha256 });
const expected = await signer.presign(new HttpRequest({ hostname: actual.hostname, protocol: 'https:', method: 'GET', path: actual.pathname }), { expiresIn: 300, signingDate });
assert.equal(actual.searchParams.get('X-Amz-Signature'), expected.query['X-Amz-Signature']);
assert.equal(actual.searchParams.get('X-Amz-SignedHeaders'), 'host');
assert.equal(actual.searchParams.get('X-Amz-Expires'), '300');
console.log('PASS: independent minimal signature exactly matches AWS SDK low-level presigner using test credentials; no network calls.');
const token = 'fake-token-value-for-local-test';
const secret = createHash('sha256').update(token).digest('hex');
assert.equal(secretMatchesToken(secret, token), true);
assert.equal(secretMatchesToken(secret, 'other-token'), false);
assert.equal(secretMatchesToken('invalid', token), false);
console.log('PASS: matching and mismatched token/secret pairs are recognized without displaying any values.');
