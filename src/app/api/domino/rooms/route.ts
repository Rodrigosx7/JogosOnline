import { identity } from '@/lib/server/auth';
import { body, failure, json, clientIp,rateLimit,sharedRateLimit, sameOrigin } from '@/lib/server/http';
import { newDominoRoom, openDominoRooms } from '@/lib/server/domino-rooms';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { rateLimit(`domino-list:${clientIp(request.headers)}`, 60); return json({ rooms: await openDominoRooms() }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request); await sharedRateLimit(`domino-create-ip:${clientIp(request.headers)}`, 30);
    const id = await identity(); await sharedRateLimit(`domino-create:${id}`, 10);
    return json(await newDominoRoom(id, await body(request)), 201);
  } catch (error) { return failure(error); }
}
