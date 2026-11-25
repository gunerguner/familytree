import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

export function issueToken(secret: string): { cookie: string; hash: string } {
  const raw = randomBytes(32);
  const body = raw.toString('base64url');
  const mac = createHmac('sha256', secret).update(body).digest('hex');
  return {
    cookie: `${body}.${mac}`,
    hash: createHash('sha256').update(raw).digest('hex'),
  };
}

export function tokenHash(cookie: string, secret: string): string | null {
  const dot = cookie.indexOf('.');
  if (dot <= 0) return null;
  const body = cookie.slice(0, dot);
  const mac = cookie.slice(dot + 1);
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const actualBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(actualBuf, expectedBuf)) return null;
  const raw = Buffer.from(body, 'base64url');
  if (raw.length !== 32) return null;
  return createHash('sha256').update(raw).digest('hex');
}
