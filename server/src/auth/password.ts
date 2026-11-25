import { scryptSync, timingSafeEqual, randomBytes } from 'crypto';

const N = 16384;
const R = 8;
const P = 1;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const cost = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!cost || !r || !p) return false;
  const salt = Buffer.from(parts[4], 'base64url');
  const expected = Buffer.from(parts[5], 'base64url');
  const actual = scryptSync(password, salt, expected.length, { N: cost, r, p });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
