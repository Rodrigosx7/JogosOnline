import { identity } from '@/lib/server/auth';
import { body, failure, json, rateLimit, sameOrigin } from '@/lib/server/http';
import { newRoom, openRooms } from '@/lib/server/rooms';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    rateLimit(`list-ip:${request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local'}`, 60);
    return json({ rooms: await openRooms() });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    rateLimit(`create-ip:${request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local'}`, 30);
    const playerId = await identity();
    rateLimit(`create:${playerId}`, 10);
    return json(await newRoom(playerId, await body(request)), 201);
  } catch (error) { return failure(error); }
}
