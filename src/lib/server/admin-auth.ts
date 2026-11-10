import { randomBytes, randomUUID,createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { HttpError } from './http';
import {loadAdminCredentials,saveAdminCredentials} from './custom-store';
import {serialized} from './storage';

const cookieName='mesa_admin';
export function adminConfigured() { return !!process.env.ADMIN_USERNAME && !!process.env.ADMIN_PASSWORD_HASH && (process.env.ADMIN_SESSION_SECRET?.length ?? 0)>=32; }
function safeEqual(a:Buffer,b:Buffer) { return a.length===b.length && timingSafeEqual(a,b); }
export function verifyAdminPassword(username:string,password:string,passwordHash=process.env.ADMIN_PASSWORD_HASH) {
  if(!adminConfigured() || username.length>64 || password.length>256) return false;
  const [salt,hash]=(passwordHash??'').split(':');
  if(!salt||!hash||!/^[a-f0-9]{128}$/.test(hash)) return false;
  const valid=safeEqual(scryptSync(password,salt,64),Buffer.from(hash,'hex'));
  return valid && safeEqual(Buffer.from(username),Buffer.from(process.env.ADMIN_USERNAME!));
}
function signature(value:string) { return createHmac('sha256',process.env.ADMIN_SESSION_SECRET!).update(value).digest('base64url'); }
export function verifyAdminSession(token:string|undefined,now=Date.now(),expectedVersion='initial') {
  if(!adminConfigured() || !token || token.length>300) return false;
  const parts=token.split('.');if(parts.length!==3&&parts.length!==4)return false;
  const [expires,nonce]=parts,version=parts.length===4?parts[2]:'initial',mac=parts.at(-1),payload=parts.slice(0,-1).join('.');
  return version===expectedVersion && !!nonce && /^\d+$/.test(expires) && Number(expires)>now && Number(expires)<=now+8*60*60*1000 && !!mac && safeEqual(Buffer.from(mac),Buffer.from(signature(payload)));
}
export async function authenticateAdmin(username:string,password:string){const record=await loadAdminCredentials();return verifyAdminPassword(username,password,record.passwordHash)?record:null;}
export async function adminLoggedIn() {const token=(await cookies()).get(cookieName)?.value;if(!token||!adminConfigured())return false;return verifyAdminSession(token,Date.now(),(await loadAdminCredentials()).version);}
export async function requireAdmin() { if(!await adminLoggedIn()) throw new HttpError(401,'Entre como administrador.'); }
export async function setAdminSession(version?:string) {
  const currentVersion=version??(await loadAdminCredentials()).version;
  const payload=`${Date.now()+8*60*60*1000}.${randomBytes(24).toString('base64url')}.${currentVersion}`;
  (await cookies()).set(cookieName,`${payload}.${signature(payload)}`,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/admin',maxAge:8*60*60});
}
export async function clearAdminSession() { (await cookies()).set(cookieName,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/admin',maxAge:0}); }
export async function changeAdminPassword(currentPassword:string,newPassword:string){
  if(newPassword.trim().length<10||newPassword.length>128)throw new HttpError(400,'Use uma frase ou senha com 10 a 128 caracteres.');
  return serialized('admin-password-change',async()=>{
    const current=await loadAdminCredentials();
    if(!verifyAdminPassword(process.env.ADMIN_USERNAME??'',currentPassword,current.passwordHash))throw new HttpError(400,'A senha atual não confere.');
    if(verifyAdminPassword(process.env.ADMIN_USERNAME??'',newPassword,current.passwordHash))throw new HttpError(400,'Escolha uma senha diferente da atual.');
    const salt=randomBytes(16).toString('hex'),record={passwordHash:`${salt}:${scryptSync(newPassword,salt,64).toString('hex')}`,version:randomUUID()};
    await saveAdminCredentials(record);return record.version;
  });
}
