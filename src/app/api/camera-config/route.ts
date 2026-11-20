import {createHmac} from 'node:crypto';
import {identity} from '@/lib/server/auth';
import {failure,HttpError,json,rateLimit} from '@/lib/server/http';
import {readRoom} from '@/lib/server/rooms';
export const runtime='nodejs';
export async function GET(request:Request){try{
 const id=await identity();rateLimit(`camera-config:${id}`,30);
 // Relay credentials are only for members of the room the camera belongs to.
 const room=new URL(request.url).searchParams.get('room');
 if(!room)throw new HttpError(400,'Informe a mesa.');
 await readRoom(room,id);
 const iceServers:RTCIceServer[]=[{urls:'stun:stun.l.google.com:19302'}];
 if(process.env.TURN_URL&&process.env.TURN_SECRET){const username=`${Math.floor(Date.now()/1000)+3600}:${id}`;iceServers.push({urls:process.env.TURN_URL.split(','),username,credential:createHmac('sha1',process.env.TURN_SECRET).update(username).digest('base64')});}
 return json({iceServers});
}catch(e){return failure(e);}}
