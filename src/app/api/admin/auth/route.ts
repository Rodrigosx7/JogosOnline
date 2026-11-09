import {adminConfigured,adminLoggedIn,verifyAdminPassword,setAdminSession,clearAdminSession} from '@/lib/server/admin-auth';
import {body,failure,HttpError,json,rateLimit,sameOrigin} from '@/lib/server/http';
export const runtime='nodejs';
export async function GET(){return json({authenticated:await adminLoggedIn(),configured:adminConfigured()});}
export async function POST(request:Request){try{sameOrigin(request);rateLimit(`admin-login:${request.headers.get('x-forwarded-for')?.split(',')[0]??'unknown'}`,5);const input=await body(request);if(typeof input.username!=='string'||typeof input.password!=='string'||!verifyAdminPassword(input.username,input.password))throw new HttpError(401,'Usuário ou senha inválidos.');await setAdminSession();return json({authenticated:true});}catch(e){return failure(e);}}
export async function DELETE(request:Request){try{sameOrigin(request);await clearAdminSession();return json({ok:true});}catch(e){return failure(e);}}
