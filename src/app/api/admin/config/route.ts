import {requireAdmin} from '@/lib/server/admin-auth';
import {loadCustomConfig,saveCustomConfig} from '@/lib/server/custom-store';
import {body,failure,json,sameOrigin} from '@/lib/server/http';
export const runtime='nodejs';
export async function GET(){try{await requireAdmin();return json(await loadCustomConfig());}catch(e){return failure(e);}}
export async function PUT(request:Request){try{sameOrigin(request);await requireAdmin();return json(await saveCustomConfig(await body(request)));}catch(e){return failure(e);}}
