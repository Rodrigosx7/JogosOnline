import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifySupabaseToken } from './jwt';

const url = 'https://example-project.supabase.co';
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'ES256' };
const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(claims: object, kid = 'k1') {
  const head = part({ alg: 'ES256', kid, typ: 'JWT' }), body = part(claims);
  const signature = sign('sha256', Buffer.from(`${head}.${body}`), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${body}.${signature}`;
}
const sub = '3f1c2b9e-1111-4222-8333-944455556666';
const valid = { sub, role: 'authenticated', iss: `${url}/auth/v1`, exp: Math.floor(Date.now() / 1000) + 600 };

test('Supabase access tokens are verified locally against the project JWKS', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ keys: [jwk] }))) as typeof fetch;
  try {
    assert.equal(await verifySupabaseToken(token(valid), url), sub);
    assert.equal(await verifySupabaseToken(token({ ...valid, exp: 1 }), url), null);
    assert.equal(await verifySupabaseToken(token({ ...valid, iss: 'https://evil.example/auth/v1' }), url), null);
    assert.equal(await verifySupabaseToken(token({ ...valid, role: 'anon' }), url), null);
    assert.equal(await verifySupabaseToken(token(valid, 'unknown'), url), null);
    const tampered = token(valid).split('.'); tampered[1] = part({ ...valid, sub: '00000000-0000-4000-8000-000000000000' });
    assert.equal(await verifySupabaseToken(tampered.join('.'), url), null);
    // HS256 tokens cannot be checked without the secret: fall back to the Auth server.
    assert.equal(await verifySupabaseToken(`${part({ alg: 'HS256' })}.${part(valid)}.x`, url), null);
  } finally { globalThis.fetch = original; }
});
