import {identity} from '@/lib/server/auth';import{body,failure,json,rateLimit,sameOrigin}from'@/lib/server/http';import{newPoolRoom,openPoolRooms}from'@/lib/server/pool-rooms';
export const runtime='nodejs';
export async function GET(request:Request){try{rateLimit(`pool-list:${request.headers.get('x-forwarded-for')??'unknown'}`,60);return json({rooms:await openPoolRooms()});}catch(e){return failure(e);}}
export async function POST(request:Request){try{sameOrigin(request);const id=await identity();rateLimit(`pool-create:${id}`,15);return json(await newPoolRoom(id,await body(request)),201);}catch(e){return failure(e);}}
