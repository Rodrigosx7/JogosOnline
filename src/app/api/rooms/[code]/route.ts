import { identity } from '@/lib/server/auth';
import { body, failure, json, rateLimit, sameOrigin } from '@/lib/server/http';
import { accessRoom } from '@/lib/server/rooms';

export const runtime = 'nodejs';
type Context = { params: Promise<{ code: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const playerId = await identity();
    rateLimit(`read:${playerId}`, 180);
    const { code } = await context.params;
    const result = await accessRoom(code, playerId);
    return json(result.view, result.status);
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const playerId = await identity();
    rateLimit(`command:${playerId}`, 120);
    const { code } = await context.params;
    const result = await accessRoom(code, playerId, await body(request));
    return json(result.view, result.status);
  } catch (error) { return failure(error); }
}
