import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const AUDIO_LINK_SECONDS = 8 * 60 * 60;
// Only server-approved catalogue keys reach this signer. It performs no download.
export function createAudioSigner(config, now = () => Date.now()) {
  return async objectKey => {
    const { accountId, bucket, accessKeyId, secretAccessKey } = config();
    if (!/^[a-f0-9]{32}$/.test(accountId) || !bucket || !accessKeyId || !secretAccessKey || !/^audio\/[\w-]{11}\.m4a$/.test(objectKey)) throw Error('Invalid audio configuration');
    const client = new S3Client({ region: 'auto', forcePathStyle: true, endpoint: 'https://' + accountId + '.r2.cloudflarestorage.com', credentials: { accessKeyId, secretAccessKey } });
    try {
      const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: objectKey, ResponseContentType: 'audio/mp4' }), { expiresIn: AUDIO_LINK_SECONDS });
      return { url, expiresAt: now() + AUDIO_LINK_SECONDS * 1000 };
    } finally { client.destroy(); }
  };
}
