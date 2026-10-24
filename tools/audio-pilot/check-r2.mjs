import { createRequire } from 'node:module';
import { createAudioSigner, checkAudioLink } from '../members/functions/audio.mjs';
import { minimalAudioLink } from './minimal-signature.mjs';
import { secretMatchesToken } from './verify-pair.mjs';
const require = createRequire(new URL('../members/functions/package.json', import.meta.url));
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const safe = value => /^[A-Za-z0-9]{1,80}$/.test(value) ? value : 'Unknown';
let client;
try {
  let input = '';
  for await (const chunk of process.stdin) { input += chunk; if (input.length > 10000) throw Error('InvalidInput'); }
  const config = Object.fromEntries(Object.entries(JSON.parse(input)).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
  input = '';
  const { accountId, bucket, accessKeyId, secretAccessKey } = config;
  if (!/^[a-f0-9]{32}$/.test(accountId) || bucket !== 'lightcity-audio' || !accessKeyId || !secretAccessKey) throw Error('InvalidInput');
  // Report format only, never any credential characters or hashes.
  console.log('Access Key ID format: ' + (/^[a-f0-9]{32}$/i.test(accessKeyId) ? '32 hexadecimal characters' : 'unexpected format'));
  console.log('Secret Access Key format: ' + (/^[a-f0-9]{64}$/i.test(secretAccessKey) ? '64 hexadecimal characters' : 'unexpected format'));
  console.log('Access Key ID differs from Account ID: ' + (accessKeyId !== accountId ? 'YES' : 'NO — copy Access Key ID, not Account ID'));
  if (config.apiTokenValue) {
    console.log('Secret belongs to this Token value: ' + (secretMatchesToken(secretAccessKey, config.apiTokenValue) ? 'MATCH' : 'MISMATCH'));
    try {
      // Read-only token verification, sent only to Cloudflare's official account API.
      const verified = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`, { headers: { Authorization: 'Bearer ' + config.apiTokenValue }, signal: AbortSignal.timeout(15000), redirect: 'error' });
      const answer = await verified.json();
      if (answer.success && answer.result?.id) {
        console.log('Token account verification: ' + safe(answer.result.status));
        console.log('Access Key ID belongs to this Token value: ' + (answer.result.id === accessKeyId ? 'MATCH' : 'MISMATCH'));
      } else console.log('Token account verification: HTTP ' + verified.status + ' (not verified)');
    } catch { console.log('Token account verification: unavailable'); }
    delete config.apiTokenValue;
  } else console.log('Token pair verification: skipped');
  try {
    const response = await fetch(`https://${accountId}.r2.cloudflarestorage.com`, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
    const serverTime = Date.parse(response.headers.get('date'));
    if (Number.isFinite(serverTime)) console.log('Clock difference: ' + Math.round(Math.abs(Date.now() - serverTime) / 1000) + ' seconds');
  } catch { console.log('Clock check: unavailable'); }
  client = new S3Client({ region: 'auto', forcePathStyle: true, endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: 'audio/0xma1jqVwsg.m4a', Range: 'bytes=0-0' }), { abortSignal: AbortSignal.timeout(15000) });
    response.Body?.destroy();
    console.log('Direct R2 read: OK (HTTP ' + response.$metadata.httpStatusCode + ')');
  } catch (error) {
    console.log('Direct R2 read: ' + safe(error.name) + ' (HTTP ' + Number(error.$metadata?.httpStatusCode || 0) + ')');
  }
  const signed = await createAudioSigner(() => config)('audio/0xma1jqVwsg.m4a');
  const diagnostic = await checkAudioLink(signed.url);
  console.log('Signed R2 read: ' + (diagnostic.ok ? 'OK' : safe(diagnostic.code)) + ' (HTTP ' + diagnostic.status + ')');
  const minimal = await checkAudioLink(minimalAudioLink(config));
  console.log('Independent minimal read: ' + (minimal.ok ? 'OK' : safe(minimal.code)) + ' (HTTP ' + minimal.status + ')');
} catch { console.log('The local check could not finish. Confirm both values were entered and the functions dependencies are installed.'); process.exitCode = 1; }
finally { client?.destroy(); }
