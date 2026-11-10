import {requireAdmin,changeAdminPassword,setAdminSession} from '@/lib/server/admin-auth';
import {body,failure,HttpError,json,rateLimit,sameOrigin} from '@/lib/server/http';
export const runtime='nodejs';
export async function PUT(request:Request){try{
  sameOrigin(request);await requireAdmin();rateLimit(`admin-password:${request.headers.get('x-forwarded-for')?.split(',')[0]??'unknown'}`,5);
  const input=await body(request);
  if(typeof input.currentPassword!=='string'||input.currentPassword.length>256||typeof input.newPassword!=='string'||typeof input.confirmPassword!=='string')throw new HttpError(400,'Preencha a senha atual, a nova senha e a confirmação.');
  if(input.newPassword!==input.confirmPassword)throw new HttpError(400,'A confirmação da nova senha não confere.');
  const version=await changeAdminPassword(input.currentPassword,input.newPassword);await setAdminSession(version);
  return json({ok:true});
}catch(e){return failure(e);}}
