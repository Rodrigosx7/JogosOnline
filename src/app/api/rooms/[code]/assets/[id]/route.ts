import {identity} from '@/lib/server/auth';
import {accessRoom} from '@/lib/server/rooms';
import {assetResponse} from '@/lib/server/custom-store';
import {referencedAsset} from '@/lib/custom-mode';
import {failure,HttpError,rateLimit} from '@/lib/server/http';
export const runtime='nodejs';
export async function GET(_request:Request,context:{params:Promise<{code:string;id:string}>}){try{const {code,id}=await context.params,user=await identity();rateLimit(`assets:${user}`,180);const {view}=await accessRoom(code,user);if(!view.custom||!referencedAsset(view.custom.config,id))throw new HttpError(404,'Arquivo não encontrado.');return await assetResponse(id);}catch(e){return failure(e);}}
