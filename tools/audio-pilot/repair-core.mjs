import { deriveR2Secret } from './verify-pair.mjs';
export async function repairCredentials(config, { verify, read, save }) {
  if (!/^[a-f0-9]{32}$/i.test(config.accessKeyId) || !config.apiTokenValue) throw Error('INPUT');
  const identity = await verify(config);
  if (identity.status !== 'active' || identity.id !== config.accessKeyId) throw Error('TOKEN');
  const repaired = { accountId: config.accountId, bucket: config.bucket, accessKeyId: config.accessKeyId, secretAccessKey: deriveR2Secret(config.apiTokenValue) };
  const check = await read(repaired);
  if (!check.ok) throw Error('READ');
  // Do not change Firebase until Cloudflare identity and an actual R2 read pass.
  await save('R2_AUDIO_ACCESS_KEY_ID', repaired.accessKeyId);
  await save('R2_AUDIO_SECRET_ACCESS_KEY', repaired.secretAccessKey);
}
