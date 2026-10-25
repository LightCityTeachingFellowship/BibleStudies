const encoder = new TextEncoder();
export const validSession = value => /^session-\d{13}$/.test(value || '');
export const validSecret = value => /^[a-f0-9]{64}$/.test(value || '');
export async function sha256(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', value)), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function key(secret) {
  if (!validSecret(secret)) throw Error('Secret not configured');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function sameSecret(supplied, expected) {
  if (!validSecret(supplied) || !validSecret(expected)) return false;
  const a = await sha256(encoder.encode(supplied)), b = await sha256(encoder.encode(expected));
  let difference = 0; for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export async function issueToken(session, secret, expiresAt) {
  if (!validSession(session) || !Number.isSafeInteger(expiresAt)) throw Error('Invalid session or expiry');
  const bytes = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(`lightcity-live-test:v1:${session}:${expiresAt}`));
  return expiresAt + '.' + Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function verifyToken(session, token, secret, now = Date.now()) {
  if (!validSession(session) || !validSecret(secret) || typeof token !== 'string') return false;
  const match = token.match(/^(\d{10})\.([a-f0-9]{64})$/);
  if (!match) return false;
  const expiresAt = Number(match[1]), seconds = Math.floor(now / 1000);
  // Owner-test links last one hour; the two-hour maximum allows small clock skew.
  if (expiresAt <= seconds || expiresAt > seconds + 7200) return false;
  const signature = Uint8Array.from(match[2].match(/../g), byte => parseInt(byte, 16));
  return crypto.subtle.verify('HMAC', await key(secret), signature, encoder.encode(`lightcity-live-test:v1:${session}:${expiresAt}`));
}
export function parsePlaylist(text) {
  if (text.length > 2 * 1024 * 1024 || !text.startsWith('#EXTM3U\n')) throw Error('Invalid playlist');
  const lines = text.trimEnd().split('\n');
  const tags = /^(?:#EXTM3U|#EXT-X-VERSION:\d+|#EXT-X-TARGETDURATION:\d+|#EXT-X-MEDIA-SEQUENCE:0|#EXT-X-PLAYLIST-TYPE:EVENT|#EXT-X-PROGRAM-DATE-TIME:[\dT:.+Z-]+|#EXTINF:\d+(?:\.\d+)?,|#EXT-X-ENDLIST)$/;
  const segments = [];
  for (const line of lines) {
    if (/^segment-\d{6,}\.ts$/.test(line)) segments.push(line);
    else if (!tags.test(line)) throw Error('Unexpected playlist content');
  }
  if (!segments.length || segments.length > 12000 || new Set(segments).size !== segments.length || lines.filter(line => line.startsWith('#EXTINF:')).length !== segments.length || lines.filter(line => line.startsWith('#EXT-X-PROGRAM-DATE-TIME:')).length !== segments.length) throw Error('Invalid playlist segments');
  return { lines, segments, ended: lines.includes('#EXT-X-ENDLIST') };
}
export function workerOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname) || url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/') throw Error('Use the HTTPS workers.dev address shown by Cloudflare');
  return url.origin;
}
