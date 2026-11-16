import {createHmac} from 'node:crypto';
import {identity} from '@/lib/server/auth';
export async function GET(){
 const id=await identity();
 const iceServers:RTCIceServer[]=[{urls:'stun:stun.l.google.com:19302'}];
 if(process.env.TURN_URL&&process.env.TURN_SECRET){const username=`${Math.floor(Date.now()/1000)+3600}:${id}`;iceServers.push({urls:process.env.TURN_URL.split(','),username,credential:createHmac('sha1',process.env.TURN_SECRET).update(username).digest('base64')});}
 return Response.json({iceServers},{headers:{'Cache-Control':'no-store'}});
}
