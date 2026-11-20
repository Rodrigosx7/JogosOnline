import { createPublicKey, verify, type webcrypto } from 'node:crypto';

// Verifies Supabase access tokens signed with asymmetric keys (ES256/RS256) against the
// project's public JWKS, so polling does not call the Auth server on every request.
// Returns null whenever local verification is not possible; the caller then asks Supabase.
type Jwk = webcrypto.JsonWebKey & { kid?: string; alg?: string };
let cache: { url: string; at: number; keys: Jwk[] } | null = null;
const TTL = 10 * 60_000;

async function keys(url: string, refresh = false): Promise<Jwk[]> {
  if (!refresh && cache?.url === url && Date.now() - cache.at < TTL) return cache.keys;
  const response = await fetch(`${url}/auth/v1/.well-known/jwks.json`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error('JWKS unavailable');
  const body = await response.json() as { keys?: Jwk[] };
  cache = { url, at: Date.now(), keys: Array.isArray(body.keys) ? body.keys : [] };
  return cache.keys;
}
const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

export async function verifySupabaseToken(token: string, url: string, now = Date.now()): Promise<string | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = decode(parts[0]) as { alg?: string; kid?: string };
    if ((header.alg !== 'ES256' && header.alg !== 'RS256') || !header.kid) return null;
    let jwk = (await keys(url)).find(k => k.kid === header.kid);
    if (!jwk) jwk = (await keys(url, true)).find(k => k.kid === header.kid);
    if (!jwk) return null;
    const key = createPublicKey({ key: jwk, format: 'jwk' });
    const data = Buffer.from(`${parts[0]}.${parts[1]}`), signature = Buffer.from(parts[2], 'base64url');
    const valid = header.alg === 'ES256'
      ? verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, signature)
      : verify('sha256', data, key, signature);
    if (!valid) return null;
    const claims = decode(parts[1]) as { sub?: string; exp?: number; iss?: string; role?: string };
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now + 5_000) return null;
    if (claims.iss !== `${url}/auth/v1`) return null;
    if (claims.role !== 'authenticated' || typeof claims.sub !== 'string' || !/^[0-9a-f-]{36}$/.test(claims.sub)) return null;
    return claims.sub;
  } catch { return null; }
}
