import { randomBytes, createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { HttpError } from './http';

const cookieName='mesa_admin';
export function adminConfigured() { return !!process.env.ADMIN_USERNAME && !!process.env.ADMIN_PASSWORD_HASH && (process.env.ADMIN_SESSION_SECRET?.length ?? 0)>=32; }
function safeEqual(a:Buffer,b:Buffer) { return a.length===b.length && timingSafeEqual(a,b); }
export function verifyAdminPassword(username:string,password:string) {
  if(!adminConfigured() || username.length>64 || password.length>256) return false;
  const [salt,hash]=process.env.ADMIN_PASSWORD_HASH!.split(':');
  if(!salt||!hash||!/^[a-f0-9]{128}$/.test(hash)) return false;
  const valid=safeEqual(scryptSync(password,salt,64),Buffer.from(hash,'hex'));
  return valid && safeEqual(Buffer.from(username),Buffer.from(process.env.ADMIN_USERNAME!));
}
function signature(value:string) { return createHmac('sha256',process.env.ADMIN_SESSION_SECRET!).update(value).digest('base64url'); }
export function verifyAdminSession(token:string|undefined,now=Date.now()) {
  if(!adminConfigured() || !token || token.length>300) return false;
  const [expires,nonce,mac]=token.split('.');const payload=`${expires}.${nonce}`;
  return !!nonce && /^\d+$/.test(expires) && Number(expires)>now && Number(expires)<=now+8*60*60*1000 && !!mac && safeEqual(Buffer.from(mac),Buffer.from(signature(payload)));
}
export async function adminLoggedIn() { return verifyAdminSession((await cookies()).get(cookieName)?.value); }
export async function requireAdmin() { if(!await adminLoggedIn()) throw new HttpError(401,'Entre como administrador.'); }
export async function setAdminSession() {
  const payload=`${Date.now()+8*60*60*1000}.${randomBytes(24).toString('base64url')}`;
  (await cookies()).set(cookieName,`${payload}.${signature(payload)}`,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/admin',maxAge:8*60*60});
}
export async function clearAdminSession() { (await cookies()).set(cookieName,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/admin',maxAge:0}); }
