import {POCKETS,TABLE,freeCuePosition,simulateStroke,validCuePosition,type Ball,type Stroke} from './physics';
import {groupOf,judgeStroke,mayShootEight} from './rules';
import {applyPool,type Pool} from './game';
function clearPath(balls:Ball[],ax:number,ay:number,bx:number,by:number,ignore:number[]){const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;return balls.every(b=>{if(b.pocketed||ignore.includes(b.id))return true;const t=Math.max(0,Math.min(1,((b.x-ax)*dx+(b.y-ay)*dy)/len));return Math.hypot(b.x-ax-t*dx,b.y-ay-t*dy)>2*TABLE.radius+.1;});}
export function choosePoolShot(room:Pool):{stroke:Stroke;position?:{x:number;y:number}} {
  const own=room.currentSeat%2,group=room.groups[own],eligible=mayShootEight(room.balls,group),targets=room.balls.filter(b=>!b.pocketed&&b.id!==0&&(eligible?b.id===8:group?groupOf(b.id)===group:b.id!==8));
  const cue=room.balls.find(b=>b.id===0)!,positions=[{x:cue.x,y:cue.y},...(room.ballInHand==='any'?[{x:240,y:120},{x:240,y:380},{x:500,y:250},{x:760,y:120}].filter(p=>validCuePosition(room.balls,p.x,p.y)):[])];
  if(room.isBreak)return {stroke:{angle:Math.atan2(250-cue.y,720-cue.x),power:.95}};
  const candidates:{stroke:Stroke;position:{x:number;y:number};cost:number}[]=[];
  for(const position of positions)for(const target of targets)for(let pocket=0;pocket<6;pocket++){
    const p=POCKETS[pocket],d=Math.hypot(p.x-target.x,p.y-target.y),nx=(p.x-target.x)/d,ny=(p.y-target.y)/d,gx=target.x-2*TABLE.radius*nx,gy=target.y-2*TABLE.radius*ny,cd=Math.hypot(gx-position.x,gy-position.y),cut=((gx-position.x)*nx+(gy-position.y)*ny)/cd;
    if(cut<.18||gx<TABLE.radius||gx>1000-TABLE.radius||gy<TABLE.radius||gy>500-TABLE.radius||!clearPath(room.balls,position.x,position.y,gx,gy,[0,target.id])||!clearPath(room.balls,target.x,target.y,p.x,p.y,[0,target.id]))continue;
    const power=Math.min(1,Math.sqrt(2*TABLE.friction*(cd+d/(cut*cut*.95)))/TABLE.maxSpeed*1.12);
    candidates.push({stroke:{angle:Math.atan2(gy-position.y,gx-position.x),power:Math.max(.12,power),...(eligible?{calledPocket:pocket}:{})},position,cost:d+cd+(1-cut)*1000});
  }
  candidates.sort((a,b)=>a.cost-b.cost);let best:typeof candidates[number]|undefined,score=-Infinity;
  for(const candidate of candidates.slice(0,10)){const balls=structuredClone(room.balls);Object.assign(balls.find(b=>b.id===0)!,candidate.position);const result=simulateStroke(balls,candidate.stroke),decision=judgeStroke(balls,result,room.groups,own,false,candidate.stroke.calledPocket),value=decision.winner===own?10000:decision.winner!==null?-10000:decision.foul?-1000:result.pocketed.filter(p=>p.id!==0&&p.id!==8&&(!group||groupOf(p.id)===group)).length*100-candidate.cost/10000;if(value>score){score=value;best=candidate;}if(value>=99)break;}
  if(best&&score>0)return{stroke:best.stroke,...(room.ballInHand?{position:best.position}:{})};
  const target=targets.sort((a,b)=>Math.hypot(a.x-cue.x,a.y-cue.y)-Math.hypot(b.x-cue.x,b.y-cue.y))[0];
  return{stroke:{angle:target?Math.atan2(target.y-cue.y,target.x-cue.x):0,power:.58,...(eligible?{calledPocket:0}:{})}};
}
export function advancePoolBots(room:Pool,now:number):Pool{
  let r=room;const bots=r.players.filter(p=>p.isBot);
  if((r.status==='finished'||r.status==='cancelled')&&r.rematchVotes.some(id=>r.players.some(p=>p.id===id&&!p.isBot))){for(const bot of bots)if(!r.rematchVotes.includes(bot.id))r=applyPool(r,bot.id,{type:'rematch'},now);}
  if(r.status!=='playing'||r.pending)return r;const bot=r.players.find(p=>p.seat===r.currentSeat&&p.isBot);if(!bot)return r;
  const key=`${r.revision}:${bot.id}`;if(r.botAction?.key!==key){r.botAction={key,at:now+1000};return r;}if(r.botAction.at>now)return r;
  r=structuredClone(r);r.botAction=null;if(r.ballInHand&&!validCuePosition(r.balls,r.balls[0].x,r.balls[0].y,r.ballInHand==='break'))Object.assign(r.balls[0],freeCuePosition(r.balls,r.ballInHand==='break'));
  const choice=choosePoolShot(r);if(choice.position)r=applyPool(r,bot.id,{type:'place',...choice.position},now);return applyPool(r,bot.id,{type:'shoot',...choice.stroke},now);
}
