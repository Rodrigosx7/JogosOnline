import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFile,writeFile,mkdir,rename } from 'node:fs/promises';
import path from 'node:path';
import { cloudConfigured, serialized } from './storage';
import { defaultCustomConfig, validAssetId, SOUND_EVENTS, type CustomConfig } from '../custom-mode';
import { makeDeck } from '../truco-rules';
import { HttpError } from './http';

const bucket='custom-game-assets', root=path.join(process.cwd(),'.data','custom-mode');
const mime:Record<string,string>={png:'image/png',jpg:'image/jpeg',webp:'image/webp',mp3:'audio/mpeg',ogg:'audio/ogg',wav:'audio/wav'};
export type AdminCredentials={passwordHash:string;version:string};
export async function loadAdminCredentials():Promise<AdminCredentials> {
  let record:AdminCredentials;
  if(cloudConfigured()) {const {data,error}=await storage().from(bucket).download('settings/admin-credentials.json');if(error){if(String(error.status)==='404'||/not found|does not exist/i.test(error.message))return {passwordHash:process.env.ADMIN_PASSWORD_HASH??'',version:'initial'};throw new Error('Acesso administrativo indisponível');}record=JSON.parse(await data.text());}
  else try{record=JSON.parse(await readFile(path.join(root,'admin-credentials.json'),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {passwordHash:process.env.ADMIN_PASSWORD_HASH??'',version:'initial'};throw e;}
  if(!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(record.passwordHash)||!/^[a-f0-9-]{36}$/.test(record.version))throw new Error('Credenciais inválidas');
  return record;
}
export async function saveAdminCredentials(record:AdminCredentials) {
  if(cloudConfigured()){await ensureBucket();const {error}=await storage().from(bucket).upload('settings/admin-credentials.json',JSON.stringify(record),{contentType:'application/json',upsert:true,cacheControl:'0'});if(error)throw new Error('Falha ao alterar senha');}
  else{await mkdir(root,{recursive:true});const temporary=path.join(root,`admin-${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify(record),{mode:0o600});await rename(temporary,path.join(root,'admin-credentials.json'));}
}
function storage(){return createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}).storage;}
async function ensureBucket(){const s=storage();const {data,error}=await s.getBucket(bucket);if(data)return;if(error&&String(error.status)!=='404'&&!/not found/i.test(error.message))throw new Error('Storage indisponível');const result=await s.createBucket(bucket,{public:false,fileSizeLimit:3*1024*1024,allowedMimeTypes:[...Object.values(mime),'application/json']});if(result.error&&!/already exists/i.test(result.error.message))throw new Error('Falha ao preparar arquivos');}
export function validateConfig(input:any):CustomConfig {
  if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.length>40||typeof input.enabled!=='boolean')throw new HttpError(400,'Informe nome e disponibilidade do modo.');
  const cards:Record<string,string>={},sounds:CustomConfig['sounds']={};
  if(!input.cards||typeof input.cards!=='object'||Array.isArray(input.cards)||!input.sounds||typeof input.sounds!=='object'||Array.isArray(input.sounds))throw new HttpError(400,'Configuração inválida.');
  for(const [id,asset] of Object.entries(input.cards)){if(!makeDeck().some(c=>c.id===id)||typeof asset!=='string'||!validAssetId(asset)||!/\.(png|jpg|webp)$/.test(asset))throw new HttpError(400,'Foto de carta inválida.');cards[id]=asset;}
  for(const [event,asset] of Object.entries(input.sounds)){if(!SOUND_EVENTS.includes(event as any)||typeof asset!=='string'||!validAssetId(asset)||!/\.(mp3|ogg|wav)$/.test(asset))throw new HttpError(400,'Áudio inválido.');sounds[event as keyof typeof sounds]=asset;}
  return {version:randomUUID(),name:input.name.trim(),enabled:input.enabled,cards,sounds};
}
export async function loadCustomConfig():Promise<CustomConfig> {
  if(cloudConfigured()) {const {data,error}=await storage().from(bucket).download('settings/current.json');if(error){if(String(error.status)==='404'||/not found|does not exist/i.test(error.message))return defaultCustomConfig();throw new Error('Configuração indisponível');}return JSON.parse(await data.text());}
  try{return JSON.parse(await readFile(path.join(root,'current.json'),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return defaultCustomConfig();throw e;}
}
export async function saveCustomConfig(input:unknown) {
  const config=validateConfig(input);
  // Only administrator-uploaded objects can be published; snapshots keep existing rooms stable.
  for(const id of new Set([...Object.values(config.cards),...Object.values(config.sounds)]))if(id)await readCustomAsset(id);
  if(cloudConfigured()){await ensureBucket();const {error}=await storage().from(bucket).upload('settings/current.json',JSON.stringify(config),{contentType:'application/json',upsert:true,cacheControl:'0'});if(error)throw new Error('Falha ao salvar configuração');}
  else await serialized('custom-config',async()=>{await mkdir(root,{recursive:true});const temp=path.join(root,`settings-${randomUUID()}.tmp`);await writeFile(temp,JSON.stringify(config));await rename(temp,path.join(root,'current.json'));});
  return config;
}
export function identifyUpload(bytes:Buffer) {
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';
  if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'webp';
  if(bytes.toString('ascii',0,3)==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224))return 'mp3';
  if(bytes.toString('ascii',0,4)==='OggS')return 'ogg';
  if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE')return 'wav';
  throw new HttpError(400,'Use PNG, JPG, WebP, MP3, OGG ou WAV.');
}
export async function saveCustomAsset(file:File) {
  if(!file.size||file.size>3*1024*1024)throw new HttpError(400,'Cada arquivo pode ter até 3 MB.');
  const bytes=Buffer.from(await file.arrayBuffer()),ext=identifyUpload(bytes),id=`${randomUUID()}.${ext}`;
  if(cloudConfigured()){await ensureBucket();const {error}=await storage().from(bucket).upload(`assets/${id}`,bytes,{contentType:mime[ext],upsert:false});if(error)throw new Error('Falha ao enviar arquivo');}
  else{await mkdir(path.join(root,'assets'),{recursive:true});await writeFile(path.join(root,'assets',id),bytes,{flag:'wx'});}
  return {id,type:mime[ext]};
}
export async function readCustomAsset(id:string) {
  if(!validAssetId(id))throw new HttpError(404,'Arquivo não encontrado.');
  let bytes:Buffer;
  if(cloudConfigured()){const {data,error}=await storage().from(bucket).download(`assets/${id}`);if(error)throw new HttpError(404,'Arquivo não encontrado.');bytes=Buffer.from(await data.arrayBuffer());}
  else try{bytes=await readFile(path.join(root,'assets',id));}catch{throw new HttpError(404,'Arquivo não encontrado.');}
  return {bytes,type:mime[id.split('.').pop()!]};
}
export async function assetResponse(id:string) {const {bytes,type}=await readCustomAsset(id);return new Response(new Uint8Array(bytes),{headers:{'Content-Type':type,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});}
