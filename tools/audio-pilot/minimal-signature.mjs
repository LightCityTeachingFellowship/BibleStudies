import { createHash, createHmac } from 'node:crypto';
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase());
// Independent, minimal AWS SigV4 GET for this read-only diagnostic. URLs stay in memory.
export function minimalAudioLink({ accountId, bucket, accessKeyId, secretAccessKey }, date = new Date()) {
  if (!/^[a-f0-9]{32}$/.test(accountId) || bucket !== 'lightcity-audio' || !accessKeyId || !secretAccessKey) throw Error('Invalid diagnostic settings');
  const hostname = accountId + '.r2.cloudflarestorage.com';
  const path = '/' + bucket + '/audio/0xma1jqVwsg.m4a';
  const timestamp = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const scope = timestamp.slice(0, 8) + '/auto/s3/aws4_request';
  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': accessKeyId + '/' + scope,
    'X-Amz-Date': timestamp,
    'X-Amz-Expires': '300',
    'X-Amz-SignedHeaders': 'host'
  };
  const query = Object.keys(params).sort().map(key => encode(key) + '=' + encode(params[key])).join('&');
  const canonical = ['GET', path, query, 'host:' + hostname + '\n', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const hash = value => createHash('sha256').update(value).digest('hex');
  let signingKey = Buffer.from('AWS4' + secretAccessKey);
  for (const component of scope.split('/')) signingKey = createHmac('sha256', signingKey).update(component).digest();
  const signature = createHmac('sha256', signingKey).update(['AWS4-HMAC-SHA256', timestamp, scope, hash(canonical)].join('\n')).digest('hex');
  return 'https://' + hostname + path + '?' + query + '&X-Amz-Signature=' + signature;
}
