import { identity } from '@/lib/server/auth';
import { body, failure, json, rateLimit, sameOrigin } from '@/lib/server/http';
import { newDominoRoom, openDominoRooms } from '@/lib/server/domino-rooms';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { rateLimit(`domino-list:${request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local'}`, 60); return json({ rooms: await openDominoRooms() }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request); rateLimit(`domino-create-ip:${request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local'}`, 30);
    const id = await identity(); rateLimit(`domino-create:${id}`, 10);
    return json(await newDominoRoom(id, await body(request)), 201);
  } catch (error) { return failure(error); }
}
