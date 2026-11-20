import {json} from '@/lib/server/http';
import {roomStore} from '@/lib/server/storage';
export const runtime='nodejs';
// Liveness plus storage reachability, without exposing configuration details.
export async function GET(){
 const started=Date.now();
 try{await roomStore().get('health-check-000000');return json({ok:true,storage:'ok',ms:Date.now()-started});}
 catch{return json({ok:false,storage:'unavailable'},503);}
}
