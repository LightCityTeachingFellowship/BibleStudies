import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const AUDIO_LINK_SECONDS = 8 * 60 * 60;
function audioClient(config) {
  const { accountId, bucket, accessKeyId, secretAccessKey } = Object.fromEntries(Object.entries(config()).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
  if (!/^[a-f0-9]{32}$/.test(accountId) || !bucket || !accessKeyId || !secretAccessKey) throw Error('Invalid audio configuration');
  return { bucket, client: new S3Client({ region: 'auto', forcePathStyle: true, endpoint: 'https://' + accountId + '.r2.cloudflarestorage.com', credentials: { accessKeyId, secretAccessKey } }) };
}
export function createAudioCredentialCheck(config) {
  return async objectKey => {
    if (!/^audio\/[\w-]{11}\.m4a$/.test(objectKey)) throw Error('Invalid audio key');
    const { client, bucket } = audioClient(config);
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }), { abortSignal: AbortSignal.timeout(10000) });
      return 'OK';
    } catch (error) {
      // Never return SDK error messages, request details, headers or credentials.
      return /^[A-Za-z0-9]{1,80}$/.test(error.name) ? error.name : 'CredentialCheckFailed';
    } finally { client.destroy(); }
  };
}
// Probe a freshly server-signed link, never a caller-supplied address.
export async function checkAudioLink(signedUrl, request = fetch) {
  const url = new URL(signedUrl);
  if (url.protocol !== 'https:' || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(url.hostname)) throw Error('Invalid storage endpoint');
  try {
    const response = await request(url, { headers: { Range: 'bytes=0-0' }, redirect: 'error', signal: AbortSignal.timeout(10000) });
    let code = '';
    const reader = response.body?.getReader();
    if (reader) {
      try {
        if (!response.ok) {
          const chunk = await reader.read();
          code = new TextDecoder().decode(chunk.value?.slice(0, 4096)).match(/<Code>([A-Za-z0-9]{1,80})<\/Code>/)?.[1] || '';
        }
      } finally { await reader.cancel(); }
    }
    return { ok: response.ok, status: response.status, code };
  } catch { return { ok: false, status: 0, code: 'StorageUnreachable' }; }
}
// Only server-approved catalogue keys reach this signer. It performs no download.
export function createAudioSigner(config, now = () => Date.now()) {
  return async objectKey => {
    if (!/^audio\/[\w-]{11}\.m4a$/.test(objectKey)) throw Error('Invalid audio key');
    const { client, bucket } = audioClient(config);
    try {
      const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: objectKey, ResponseContentType: 'audio/mp4' }), { expiresIn: AUDIO_LINK_SECONDS });
      return { url, expiresAt: now() + AUDIO_LINK_SECONDS * 1000 };
    } finally { client.destroy(); }
  };
}
