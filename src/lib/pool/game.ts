import {randomInt,randomUUID} from 'node:crypto';
import {rackBalls,simulateStroke,freeCuePosition,validCuePosition,TABLE,type Ball,type Stroke,type Frame} from './physics';
import {judgeStroke,mayShootEight,remaining,type Group,type Judgement} from './rules';
import type {ChatMessage} from '../social';
export type PoolPlayer={id:string;name:string;seat:number;ready:boolean;lastSeen:number;isBot?:boolean};
export type Pool={game:'pool';code:string;mode:'1x1'|'2x2';listed:boolean;revision:number;socialRevision:number;status:'waiting'|'playing'|'finished'|'cancelled';players:PoolPlayer[];spectators:{id:string;name:string;lastSeen:number}[];hostId:string|null;removedIds:string[];balls:Ball[];groups:(Group|null)[];currentSeat:number;nextSeats:number[];breaker:number;isBreak:boolean;ballInHand:'break'|'any'|null;deadline:number|null;winner:number|null;message:string;shotNumber:number;replay:{id:string;startedAt:number;duration:number;stroke:Stroke;frames:Frame[];events:{kind:'ball'|'rail'|'pocket';t:number;id:number}[]}|null;pending:{balls:Ball[];decision:Judgement;shooter:number}|null;chat:ChatMessage[];rematchVotes:string[];botAction?:{key:string;at:number}|null};
export const poolCapacity=(r:Pool)=>r.mode==='2x2'?4:2;
const team=(seat:number)=>seat%2;
const fail=(message:string):never=>{throw new Error(message);};
const TURN=45000,ABSENCE=120000;
export function createPool(code:string,mode:'1x1'|'2x2',listed=false):Pool{return{game:'pool',code,mode,listed,revision:0,socialRevision:0,status:'waiting',players:[],spectators:[],hostId:null,removedIds:[],balls:[],groups:[null,null],currentSeat:0,nextSeats:[0,1],breaker:-1,isBreak:true,ballInHand:null,deadline:null,winner:null,message:'Esperando os jogadores ficarem prontos.',shotNumber:0,replay:null,pending:null,chat:[],rematchVotes:[]};}
function start(r:Pool,now:number){const order=Array.from({length:15},(_,i)=>i+1);for(let i=14;i>0;i--){const j=randomInt(i+1);[order[i],order[j]]=[order[j],order[i]];}r.balls=rackBalls(order);r.groups=[null,null];r.breaker=r.breaker<0?randomInt(poolCapacity(r)):(r.breaker+1)%poolCapacity(r);r.currentSeat=r.breaker;r.nextSeats=[r.breaker%2===0?r.breaker:0,r.breaker%2===1?r.breaker:1];r.status='playing';r.isBreak=true;r.ballInHand='break';r.deadline=now+TURN;r.winner=null;r.replay=null;r.pending=null;r.rematchVotes=[];r.shotNumber=0;r.botAction=null;r.players.forEach(p=>p.lastSeen=now);r.message='Saída: posicione a branca atrás da linha e abra o jogo.';}
function spot(r:Pool,id:number){const b=r.balls.find(b=>b.id===id)!;const preferred=id===8?720:240;for(let pass=0;pass<2;pass++)for(let x=pass===0?preferred:30;x<980;x+=22)for(const y of pass===0?[250]:[40,100,160,220,280,340,400,460])if(r.balls.every(other=>other.id===id||other.pocketed||Math.hypot(other.x-x,other.y-y)>2*TABLE.radius+.2)){Object.assign(b,{x,y,vx:0,vy:0,sx:0,sy:0,pocketed:false});return;}fail('Não foi possível recolocar a bola.');}
function nextShooter(r:Pool,shooter:number,keep:boolean){const own=team(shooter);r.nextSeats[own]=r.mode==='2x2'?(shooter+2)%4:shooter;r.currentSeat=r.nextSeats[keep?own:1-own];}
function settle(r:Pool,now:number){const pending=r.pending!;r.balls=pending.balls;r.message=pending.decision.message;const own=team(pending.shooter),decision=pending.decision;
  if(decision.spotEight)spot(r,8);
  if(decision.assigned){r.groups[own]=decision.assigned;r.groups[1-own]=decision.assigned==='solids'?'stripes':'solids';}
  r.isBreak=false;r.pending=null;
  if(decision.winner!==null){r.status='finished';r.winner=decision.winner;r.deadline=null;return;}
  nextShooter(r,pending.shooter,decision.keep);
  r.ballInHand=decision.foul?'any':null;if(decision.foul)spot(r,0);
  r.deadline=now+TURN;
}
function shoot(r:Pool,p:PoolPlayer,stroke:Stroke,now:number){if(p.seat!==r.currentSeat)fail('Aguarde sua vez de jogar.');if(r.pending)fail('Espere as bolas pararem.');if(!stroke||!Number.isFinite(stroke.angle)||Math.abs(stroke.angle)>Math.PI*100||!Number.isFinite(stroke.power)||stroke.power<.05||stroke.power>1)fail('Mira ou força inválida.');
  if(stroke.calledPocket!==undefined&&(!Number.isInteger(stroke.calledPocket)||stroke.calledPocket<0||stroke.calledPocket>5))fail('Caçapa inválida.');
  if(!r.isBreak&&mayShootEight(r.balls,r.groups[team(p.seat)])&&stroke.calledPocket===undefined)fail('Marque a caçapa da preta antes de jogar.');
  const result=simulateStroke(r.balls,stroke),decision=judgeStroke(r.balls,result,r.groups,team(p.seat),r.isBreak,stroke.calledPocket);
  r.shotNumber++;r.replay={id:randomUUID(),startedAt:now+900,duration:result.duration*1000,stroke,frames:result.frames,events:result.events};r.pending={balls:result.balls,decision,shooter:p.seat};r.deadline=r.replay.startedAt+r.replay.duration+500;r.ballInHand=null;r.botAction=null;r.message=`${p.name} deu a tacada. Espere as bolas pararem.`;
}
export function applyPool(room:Pool,id:string,command:any,now:number):Pool{const r=structuredClone(room),p=r.players.find(p=>p.id===id),watcher=r.spectators.find(p=>p.id===id);if(!command||typeof command.type!=='string')fail('Comando inválido.');if(r.removedIds.includes(id))fail('Você foi removido desta sala.');
  if(command.type==='join'||command.type==='watch'){
    if(command.type==='join'&&p)return r;if(command.type==='watch'&&watcher)return r;
    if(command.type==='watch'&&p&&r.status!=='waiting')fail('Só pode trocar de lugar antes de começar.');
    const name=p?.name??watcher?.name??(typeof command.name==='string'?command.name.trim().slice(0,24):'');if(!name)fail('Informe seu apelido.');
    if(command.type==='watch'){if(r.spectators.length>=32)fail('A sala atingiu o limite de espectadores.');r.players=r.players.filter(p=>p.id!==id);r.spectators.push({id,name,lastSeen:now});}
    else{if(r.status!=='waiting'||r.players.length>=poolCapacity(r))fail('Mesa cheia ou partida iniciada. Você pode assistir.');const seat=Array.from({length:poolCapacity(r)},(_,i)=>i).find(seat=>!r.players.some(p=>p.seat===seat))!;r.players.push({id,name,seat,ready:false,lastSeen:now});r.spectators=r.spectators.filter(p=>p.id!==id);r.hostId??=id;}
  }else{
    if(!p&&!watcher)fail('Entre na sala primeiro.');
    if(command.type==='leave'||command.type==='kick'){
      if(command.type==='kick'&&(r.hostId!==id||r.status!=='waiting'))fail('Só o anfitrião pode remover pessoas no lobby.');
      if(command.type==='leave'&&p&&r.status==='playing')fail('Aguarde o fim da partida para sair.');
      const target=command.type==='kick'?command.targetId:id;if(command.type==='kick'&&(target===id||![...r.players,...r.spectators].some(v=>v.id===target)))fail('Participante inválido.');
      r.players=r.players.filter(p=>p.id!==target);r.spectators=r.spectators.filter(p=>p.id!==target);if(command.type==='kick')r.removedIds=[...r.removedIds,target].slice(-128);if(r.hostId===target)r.hostId=r.players.find(p=>!p.isBot)?.id??r.spectators[0]?.id??null;
    }else if(command.type==='chat'){
      const text=typeof command.text==='string'?command.text.replace(/[\u0000-\u001f\u007f]/g,' ').trim():'';if(!text||text.length>240)fail('Escreva até 240 caracteres.');if(r.chat.some(m=>m.playerId===id&&now-m.at<1000))fail('Aguarde um segundo entre mensagens.');r.chat=[...r.chat.slice(-49),{id:randomUUID(),playerId:id,name:(p??watcher)!.name,text,at:now}];r.socialRevision++;return r;
    }else if(command.type==='fill-bots'){
      if(r.status!=='waiting'||r.hostId!==id)fail('Só o anfitrião pode completar a mesa no lobby.');
      for(let seat=0;seat<poolCapacity(r);seat++)if(!r.players.some(p=>p.seat===seat))r.players.push({id:randomUUID(),name:`Bot da casa ${seat+1}`,seat,ready:true,lastSeen:now,isBot:true});if(r.players.every(p=>p.ready))start(r,now);
    }else if(command.type==='seat'){
      if(r.status!=='waiting'||!Number.isInteger(command.seat)||command.seat<0||command.seat>=poolCapacity(r)||r.players.some(v=>v.id!==id&&v.seat===command.seat))fail('Lugar indisponível.');if(p){p.seat=command.seat;p.ready=false;}else{r.players.push({id,name:watcher!.name,seat:command.seat,ready:false,lastSeen:now});r.spectators=r.spectators.filter(v=>v.id!==id);}
    }else{if(!p)fail('Espectadores podem assistir e conversar, mas não jogar.');
      if(command.type==='ready'){if(r.status!=='waiting')fail('A partida já começou.');p!.ready=!p!.ready;if(r.players.length===poolCapacity(r)&&r.players.every(p=>p.ready))start(r,now);}
      else if(command.type==='rematch'){if(r.status!=='finished'&&r.status!=='cancelled')fail('A partida ainda não terminou.');if(!r.rematchVotes.includes(id))r.rematchVotes.push(id);if(r.rematchVotes.length===poolCapacity(r))start(r,now);}
      else{if(r.status!=='playing')fail('A partida não está em andamento.');if(r.pending)fail('Espere as bolas pararem.');if(p!.seat!==r.currentSeat)fail('Aguarde sua vez.');
        if(command.type==='place'){if(!r.ballInHand||!validCuePosition(r.balls,command.x,command.y,r.ballInHand==='break'))fail('Coloque a branca em um local livre, dentro da área permitida.');Object.assign(r.balls.find(b=>b.id===0)!,{x:command.x,y:command.y,pocketed:false});}
        else if(command.type==='shoot')shoot(r,p!,command,now);else fail('Comando desconhecido.');
      }
    }
  }
  r.revision++;return r;
}
export function reconcilePool(room:Pool,now:number):Pool{const r=structuredClone(room);while(r.status==='playing'){
  const absent=Math.min(...r.players.filter(p=>!p.isBot).map(p=>p.lastSeen+ABSENCE)),event=Math.min(absent,r.deadline??Infinity);if(event>now||!Number.isFinite(event))break;
  if(event===absent){const teams=new Set(r.players.filter(p=>!p.isBot&&p.lastSeen+ABSENCE===absent).map(p=>team(p.seat)));r.status=teams.size>1?'cancelled':'finished';r.winner=teams.size>1?null:1-[...teams][0];r.deadline=null;r.pending=null;r.message=teams.size>1?'Partida cancelada: os dois lados ficaram ausentes.':'Partida encerrada por abandono.';}
  else if(r.pending)settle(r,event);
  else{const shooter=r.currentSeat;nextShooter(r,shooter,false);r.ballInHand='any';spot(r,0);r.deadline=event+TURN;r.message='Tempo esgotado. Adversários com a branca na mão.';}
  r.revision++;
}return r;}
export function poolView(r:Pool,id:string,now:number){const p=r.players.find(p=>p.id===id),spectator=r.spectators.some(p=>p.id===id),own=p?.seat===r.currentSeat&&r.status==='playing'&&!r.pending;
  return{game:'pool' as const,code:r.code,mode:r.mode,playerId:id,revision:r.revision,socialRevision:r.socialRevision,status:r.status,players:r.players.map(({id,name,seat,ready,isBot})=>({id,name,seat,ready,isBot:!!isBot})),spectators:r.spectators.map(({id,name})=>({id,name})),hostId:r.hostId,isSpectator:spectator,balls:r.balls.map(({id,x,y,pocketed})=>({id,x,y,pocketed})),groups:r.groups,currentSeat:r.currentSeat,ballInHand:r.ballInHand,isBreak:r.isBreak,deadline:r.deadline,winner:r.winner,message:r.message,shotNumber:r.shotNumber,moving:!!r.pending,replay:r.replay,legal:{shoot:!!own,place:!!own&&!!r.ballInHand,callEight:!!own&&!r.isBreak&&mayShootEight(r.balls,r.groups[r.currentSeat%2])},remaining:r.groups.map(g=>g?remaining(r.balls,g):7),chat:p||spectator?r.chat:[],rematchVotes:r.rematchVotes,serverTime:now};
}
export type PoolView=ReturnType<typeof poolView>;
