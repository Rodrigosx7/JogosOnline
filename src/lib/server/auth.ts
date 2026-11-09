import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cookies } from 'next/headers';
import { cloudConfigured } from './storage';
import { signSession, verifySession } from './session';

let secret: Promise<Buffer> | undefined;
function localSecret() {
  return secret ??= (async () => {
    if (process.env.APP_SESSION_SECRET) {
      if (process.env.APP_SESSION_SECRET.length < 32) throw new Error('Session secret too short');
      return Buffer.from(process.env.APP_SESSION_SECRET);
    }
    const directory = path.join(process.cwd(), '.data');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const file = path.join(directory, 'session-secret');
    try { await writeFile(file, randomBytes(32), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    return readFile(file);
  })();
}

export async function identity(): Promise<string> {
  const jar = await cookies();
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 };
  if (!cloudConfigured()) {
    const existing = jar.get('mesa_session')?.value;
    const key = await localSecret();
    const verified = verifySession(existing, key);
    if (verified) return verified;
    const id = randomUUID(); jar.set('mesa_session', signSession(id, key), options); return id;
  }
  const url = process.env.SUPABASE_URL!;
  const headers = { apikey: process.env.SUPABASE_ANON_KEY!, 'Content-Type': 'application/json' };
  const access = jar.get('mesa_access')?.value;
  if (access) {
    const result = await fetch(`${url}/auth/v1/user`, { headers: { ...headers, Authorization: `Bearer ${access}` }, cache: 'no-store' });
    if (result.ok) { const user = await result.json(); if (user.id) return user.id; }
  }
  const refresh = jar.get('mesa_refresh')?.value;
  let result = refresh ? await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers, body: JSON.stringify({ refresh_token: refresh }), cache: 'no-store',
  }) : null;
  if (!result?.ok) result = await fetch(`${url}/auth/v1/signup`, { method: 'POST', headers, body: '{}', cache: 'no-store' });
  if (!result.ok) throw new Error('Anonymous authentication unavailable');
  const session = await result.json();
  if (!session.user?.id || !session.access_token || !session.refresh_token) throw new Error('Invalid authentication response');
  jar.set('mesa_access', session.access_token, options);
  jar.set('mesa_refresh', session.refresh_token, options);
  return session.user.id;
}
