import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const hints = {
  API_KEY_INVALID: 'Google did not accept this API key. Copy the API key again from its Google Cloud project.',
  keyInvalid: 'Google did not accept this API key. Copy the API key again from its Google Cloud project.',
  SERVICE_DISABLED: 'YouTube Data API v3 is not enabled in the project that owns this key. Enable it there, then retry.',
  accessNotConfigured: 'YouTube Data API v3 is not enabled in the project that owns this key. Enable it there, then retry.',
  API_KEY_SERVICE_BLOCKED: 'This key does not permit YouTube Data API v3. Check its API restrictions in Google Cloud.',
  API_KEY_HTTP_REFERRER_BLOCKED: 'This key permits website requests only. This computer helper needs a separate key for YouTube Data API v3 that permits requests from this computer.',
  ipRefererBlocked: 'The key restrictions block requests from this computer. Check the application restrictions on this key.',
  API_KEY_IP_ADDRESS_BLOCKED: 'The key IP restrictions block this computer. Check its permitted IP addresses.',
  quotaExceeded: 'The YouTube API quota for this key project is exhausted. Check its quota before retrying.',
  dailyLimitExceeded: 'The YouTube API daily quota for this key project is exhausted.',
  rateLimitExceeded: 'Google is limiting requests temporarily. Wait briefly before retrying.',
  PERMISSION_DENIED: 'Google denied this lookup. Check that this key permits YouTube Data API v3 and requests from this computer.'
};
export function lookupFailure(status, data) {
  const reasons = [...(data?.error?.details || []).map(item => item?.reason), ...(data?.error?.errors || []).map(item => item?.reason), data?.error?.status];
  const reason = reasons.find(value => Object.hasOwn(hints, value));
  return `YouTube lookup: HTTP ${Number.isInteger(status) ? status : 0}${reason ? ' (' + reason + ')' : ''}. ${reason ? hints[reason] : 'Google rejected the lookup. Check the API key, API access, restrictions, and quota in Google Cloud.'}`;
}
export async function verifyChannel(key, handle = 'LightCityTeachingFellowship', send = fetch) {
  key = key.trim(); handle = handle.replace(/^@/, '');
  if (!/^[\w.-]{3,100}$/.test(handle)) throw Error('The channel handle is invalid.');
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(key)) throw Error('The pasted key has unexpected characters or length. Copy only the API key value and retry.');
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.search = new URLSearchParams({ part: 'id,snippet', forHandle: handle, key, fields: 'items(id,snippet(title))' });
  let response;
  try { response = await send(url, { redirect: 'error', signal: AbortSignal.timeout(15000) }); }
  catch { throw Error('YouTube lookup could not connect or timed out. Check this computer\'s internet connection and retry.'); }
  let data;
  try { data = await response.json(); }
  catch { throw Error(`YouTube lookup returned an unreadable response (HTTP ${response.status}).`); }
  if (!response.ok) throw Error(lookupFailure(response.status, data));
  if (!data.items?.length) throw Error('The API key was accepted, but the configured YouTube handle was not found. Check the channel handle.');
  if (data.items.length !== 1 || !/^UC[\w-]{22}$/.test(data.items[0].id) || typeof data.items[0].snippet?.title !== 'string') throw Error('YouTube returned an unexpected channel response.');
  return { channelId: data.items[0].id, channelTitle: data.items[0].snippet.title };
}
async function main() {
  let key = '';
  try {
    for await (const chunk of process.stdin) key += chunk;
    console.log(JSON.stringify(await verifyChannel(key, process.argv[2])));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { key = ''; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
