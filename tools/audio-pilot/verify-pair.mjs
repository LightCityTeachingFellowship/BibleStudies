import { createHash, timingSafeEqual } from 'node:crypto';
export function deriveR2Secret(tokenValue) {
  if (typeof tokenValue !== 'string' || !tokenValue.trim()) throw Error('Missing token');
  return createHash('sha256').update(tokenValue.trim()).digest('hex');
}
export function secretMatchesToken(secretAccessKey, tokenValue) {
  if (!/^[a-f0-9]{64}$/i.test(secretAccessKey) || !tokenValue) return false;
  const expected = createHash('sha256').update(tokenValue).digest();
  return timingSafeEqual(expected, Buffer.from(secretAccessKey, 'hex'));
}
