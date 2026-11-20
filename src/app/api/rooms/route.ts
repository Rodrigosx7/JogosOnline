import { identity } from '@/lib/server/auth';
import { body, failure, json, clientIp,rateLimit,sharedRateLimit, sameOrigin } from '@/lib/server/http';
import { newRoom, openRooms } from '@/lib/server/rooms';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    rateLimit(`list-ip:${clientIp(request.headers)}`, 60);
    return json({ rooms: await openRooms() });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await sharedRateLimit(`create-ip:${clientIp(request.headers)}`, 30);
    const playerId = await identity();
    await sharedRateLimit(`create:${playerId}`, 10);
    return json(await newRoom(playerId, await body(request)), 201);
  } catch (error) { return failure(error); }
}
