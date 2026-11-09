import { createHmac, timingSafeEqual } from 'node:crypto';

export function signSession(id: string, secret: Buffer): string {
  return `${id}.${createHmac('sha256', secret).update(id).digest('hex')}`;
}
export function verifySession(value: string | undefined, secret: Buffer): string | null {
  if (!value) return null;
  const parts = value.split('.');
  const [id, signature] = parts;
  if (parts.length !== 2 || !/^[0-9a-f-]{36}$/.test(id) || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const expected = signSession(id, secret).split('.')[1];
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? id : null;
}
