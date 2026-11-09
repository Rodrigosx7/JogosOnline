import { identity } from '@/lib/server/auth';
import { body, failure, json, rateLimit, sameOrigin } from '@/lib/server/http';
import { accessDominoRoom } from '@/lib/server/domino-rooms';

export const runtime = 'nodejs';
type Context = { params: Promise<{ code: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const id = await identity(); rateLimit(`domino-read:${id}`, 180);
    const result = await accessDominoRoom((await context.params).code, id);
    return json(result.view, result.status);
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request); const id = await identity(); rateLimit(`domino-command:${id}`, 120);
    const result = await accessDominoRoom((await context.params).code, id, await body(request));
    return json(result.view, result.status);
  } catch (error) { return failure(error); }
}
