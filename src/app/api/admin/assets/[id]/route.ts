import {requireAdmin} from '@/lib/server/admin-auth';
import {assetResponse} from '@/lib/server/custom-store';
import {failure} from '@/lib/server/http';
export const runtime='nodejs';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){try{await requireAdmin();return await assetResponse((await context.params).id);}catch(e){return failure(e);}}
