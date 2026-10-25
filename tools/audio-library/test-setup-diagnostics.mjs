import assert from 'node:assert/strict';
import { storageFailure } from './setup-diagnostics.mjs';
for (const [name, expected] of [['SignatureDoesNotMatch', /same creation page/], ['AccessDenied', /Object Read & Write/], ['InvalidAccessKeyId', /did not recognize/], ['RequestTimeTooSkewed', /Windows clock/], ['NoSuchKey', /missing/], ['Unknown', /not identified/]]) {
  const result = storageFailure({ name, message: 'private-secret-request', $metadata: { httpStatusCode: 403 } });
  assert.match(result, expected); assert.ok(result.includes('403')); assert.ok(!result.includes('private-secret-request'));
}
assert.ok(!storageFailure({ name: 'https://private.invalid?secret=bad' }).includes('private.invalid'));
console.log('PASS: safe R2 error classification; no raw request details or credentials exposed.');
