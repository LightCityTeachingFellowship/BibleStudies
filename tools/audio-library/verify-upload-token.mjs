import { secretMatchesToken } from '../audio-pilot/verify-pair.mjs';
export async function verifyUploadToken({ accountId, accessKeyId, secretAccessKey, tokenValue }, send = fetch) {
  if (!/^[a-f\d]{32}$/i.test(accountId || '') || !/^[a-f\d]{32}$/i.test(accessKeyId || '') || !secretMatchesToken(secretAccessKey, tokenValue)) throw Error('Upload token pair did not match.');
  const response = await send(`https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`, {
    headers: { Authorization: 'Bearer ' + tokenValue }, redirect: 'error', signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) { await response.body?.cancel(); throw Error('Upload token account verification was not accepted.'); }
  const data = await response.json();
  if (!data.success || data.result?.id !== accessKeyId || data.result?.status !== 'active') throw Error('Upload token identity is not active or does not match.');
}
