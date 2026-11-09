import { NextResponse } from 'next/server';

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } });
}
export function failure(error: unknown) {
  return error instanceof HttpError ? json({ error: error.message }, error.status) : json({ error: 'Não foi possível atualizar a mesa. Tente novamente.' }, 503);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const reject = () => { throw new HttpError(403, 'Origem da solicitação inválida.'); };
  if (request.headers.get('sec-fetch-site') === 'cross-site') reject();
  if (!origin) return;
  try {
    const source = new URL(origin);
    if (!['http:', 'https:'].includes(source.protocol) || source.origin !== origin) reject();
    // Next may reconstruct request.url with its bind address (0.0.0.0).
    // Host is the browser-facing authority; never trust arbitrary forwarded origins.
    const host = request.headers.get('host') ?? new URL(request.url).host;
    if (!/^[A-Za-z0-9.\[\]:-]+$/.test(host)) reject();
    const target = new URL(`${source.protocol}//${host}`);
    if (!target.hostname || source.host !== target.host) reject();
  } catch { reject(); }
}
const limits = new Map<string, { count: number; until: number }>();
export function rateLimit(key: string, maximum: number) {
  const now = Date.now();
  if (limits.size > 10_000) for (const [key, value] of limits) if (value.until < now) limits.delete(key);
  const current = limits.get(key);
  if (!current || current.until <= now) { limits.set(key, { count: 1, until: now + 60_000 }); return; }
  if (++current.count > maximum) throw new HttpError(429, 'Muitas solicitações. Aguarde um minuto.');
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'Envie JSON.');
  if (Number(request.headers.get('content-length')) > 4096) throw new HttpError(413, 'Solicitação muito grande.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'JSON inválido.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new HttpError(413, 'Solicitação muito grande.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const text = new TextDecoder().decode(bytes);
  let value: unknown; try { value = JSON.parse(text); } catch { throw new HttpError(400, 'JSON inválido.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Solicitação inválida.');
  return value as Record<string, unknown>;
}
export function name(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'Informe seu nome.');
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 24 || /[\x00-\x1f\x7f]/.test(normalized))
    throw new HttpError(400, 'Use um nome de 2 a 24 caracteres.');
  return normalized;
}
