import {randomBytes} from 'node:crypto';
import {applyPool,createPool,poolView,reconcilePool,type Pool} from '../pool/game';
import {advancePoolBots} from '../pool/bot';
import {HttpError,name} from './http';
import {roomStore,type RoomStore} from './storage';
function parse(value:unknown){if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpError(400,'Comando inválido.');const input=value as Record<string,unknown>;
  switch(input.type){case'join':case'watch':return{type:input.type,...(input.name!==undefined?{name:name(input.name)}:{})};case'ready':case'fill-bots':case'rematch':case'leave':return{type:input.type};
    case'seat':if(Number.isInteger(input.seat)&&Number(input.seat)>=0&&Number(input.seat)<=3)return{type:'seat',seat:input.seat};break;
    case'kick':if(typeof input.targetId==='string'&&input.targetId.length<=100)return{type:'kick',targetId:input.targetId};break;
    case'chat':if(typeof input.text==='string'&&input.text.length<=240)return{type:'chat',text:input.text};break;
    case'place':if(typeof input.x==='number'&&typeof input.y==='number'&&Number.isFinite(input.x)&&Number.isFinite(input.y))return{type:'place',x:input.x,y:input.y};break;
    case'shoot':if(typeof input.angle==='number'&&typeof input.power==='number'&&[input.angle,input.power,input.spinX??0,input.spinY??0].every(v=>typeof v==='number'&&Number.isFinite(v))&&(input.calledPocket===undefined||Number.isInteger(input.calledPocket)))return{type:'shoot',angle:input.angle,power:input.power,spinX:input.spinX??0,spinY:input.spinY??0,...(input.calledPocket!==undefined?{calledPocket:input.calledPocket}:{})};break;
  }throw new HttpError(400,'Comando inválido.');}
export async function newPoolRoom(id:string,input:Record<string,unknown>,store:RoomStore=roomStore()){
  if(input.mode!=='1x1'&&input.mode!=='2x2')throw new HttpError(400,'Escolha 1x1 ou 2x2.');if([input.listed,input.practice].some(v=>v!==undefined&&typeof v!=='boolean'))throw new HttpError(400,'Configuração inválida.');const displayName=name(input.name);
  for(let attempt=0;attempt<3;attempt++){const code=randomBytes(18).toString('base64url'),now=Date.now();let state=applyPool(createPool(code,input.mode,input.listed===true&&!input.practice),id,{type:'join',name:displayName},now);if(input.practice)state=applyPool(state,id,{type:'fill-bots'},now);if(await store.create(code,{state,requests:{}}))return{code};}throw new HttpError(503,'Não foi possível abrir a mesa.');
}
export async function openPoolRooms(store:RoomStore=roomStore(),now=Date.now()){return (await store.listOpen() as unknown as Pool[]).filter(r=>r.game==='pool'&&r.status==='waiting'&&r.listed&&r.players.length<(r.mode==='2x2'?4:2)&&r.players[0]?.lastSeen>now-120000).slice(0,20).map(r=>({code:r.code,mode:r.mode,host:r.players[0].name,players:r.players.length,capacity:r.mode==='2x2'?4:2}));}
export async function accessPoolRoom(code:string,id:string,input?:Record<string,unknown>,store:RoomStore=roomStore()){
  if(!/^[A-Za-z0-9_-]{18,64}$/.test(code))throw new HttpError(404,'Mesa de sinuca não encontrada.');const command=input?parse(input.command):undefined;
  if(input&&(!Number.isSafeInteger(input.revision)||Number(input.revision)<0||typeof input.requestId!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(input.requestId)))throw new HttpError(400,'Solicitação inválida.');
  for(let attempt=0;attempt<10;attempt++){const stored=await store.get<Pool>(code);if(!stored||stored.document.state.game!=='pool')throw new HttpError(404,'Mesa de sinuca não encontrada.');const now=Date.now();let r=reconcilePool(stored.document.state,now);
    if(r.removedIds.includes(id))throw new HttpError(403,'Você foi removido desta mesa.');if(![...r.players,...r.spectators].some(p=>p.id===id)&&!['join','watch'].includes(command?.type??''))throw new HttpError(403,'Entre na mesa pelo convite.');
    const requests=stored.document.requests,duplicate=!!input&&(requests[id]??[]).includes(input.requestId as string),conflict=!!command&&!duplicate&&!['join','watch','chat'].includes(command.type)&&input!.revision!==r.revision;
    if(command&&!duplicate&&!conflict){try{r=applyPool(r,id,command,now);}catch(e){throw new HttpError(400,e instanceof Error?e.message:'Tacada inválida.');}requests[id]=[...(requests[id]??[]).slice(-127),input!.requestId as string];}
    const member=[...r.players,...r.spectators].find(p=>p.id===id);if(member)member.lastSeen=now;r=advancePoolBots(r,now);
    if(await store.compareAndSwap(code,stored.version,{state:r,requests}))return{status:conflict?409:200,view:poolView(r,id,now)};
  }throw new HttpError(409,'A mesa recebeu outra jogada. Atualize para continuar.');
}
