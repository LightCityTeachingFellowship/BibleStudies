export function storageFailure(error) {
  const code = /^[A-Za-z0-9]{1,80}$/.test(error?.name || '') ? error.name : 'StorageError';
  const status = Number.isInteger(error?.$metadata?.httpStatusCode) ? error.$metadata.httpStatusCode : 0;
  const hints = {
    SignatureDoesNotMatch: 'The signing check failed. Check that Access Key ID and Secret Access Key came from the same creation page; use Secret Access Key, not Token value.',
    InvalidAccessKeyId: 'R2 did not recognize this Access Key ID for the account endpoint. Check the account and active token.',
    AccessDenied: 'R2 denied object access. Check that the token is active, applies to lightcity-audio, and has Object Read & Write permission. IP restrictions can also deny access.',
    RequestTimeTooSkewed: 'Synchronize the Windows clock, then retry.',
    NoSuchKey: 'The existing pilot audio used for verification is missing from this bucket.',
    NoSuchBucket: 'The selected account does not contain the expected lightcity-audio bucket.'
  };
  return `Storage verification failed: ${code} (HTTP ${status}). ${hints[code] || 'The exact cause is not identified. Use the read-only R2 diagnostic to check the pair and request signature.'}`;
}
