import type {Ball,PhysicsResult} from './physics';
export type Group='solids'|'stripes';
export const groupOf=(id:number):Group|null=>id>=1&&id<=7?'solids':id>=9&&id<=15?'stripes':null;
export const remaining=(balls:Ball[],group:Group)=>balls.filter(b=>!b.pocketed&&groupOf(b.id)===group).length;
export const mayShootEight=(balls:Ball[],group:Group|null)=>group?remaining(balls,group)===0:remaining(balls,'solids')===0||remaining(balls,'stripes')===0;
export type Judgement={foul:string|null;winner:number|null;assigned:Group|null;keep:boolean;spotEight:boolean;message:string};
export function judgeStroke(before:Ball[],result:PhysicsResult,groups:(Group|null)[],team:number,isBreak:boolean,calledPocket?:number):Judgement{
  const pocketed=result.pocketed,objects=pocketed.filter(p=>p.id!==0),eight=pocketed.find(p=>p.id===8),scratch=pocketed.some(p=>p.id===0),own=groups[team];
  let foul:string|null=scratch?'Branca encaçapada.':result.firstContact===null?'A branca não tocou nenhuma bola.':null;
  const eligibleEight=mayShootEight(before,own);
  if(!isBreak&&!foul){if(result.firstContact===8&&!eligibleEight)foul='A preta foi atingida antes de limpar o grupo.';else if(own&&result.firstContact!==8&&groupOf(result.firstContact!)!==own)foul='Primeiro contato com uma bola adversária.';else if(own&&eligibleEight&&result.firstContact!==8)foul='Seu grupo acabou: o primeiro contato deve ser com a preta.';}
  if(!foul&&isBreak&&!objects.length&&new Set(result.rails.filter(r=>r.id!==0).map(r=>r.id)).size<4)foul='Saída inválida: encaçape uma bola ou leve quatro bolas às tabelas.';
  if(!foul&&!isBreak&&!objects.length&&!result.rails.some(r=>result.firstContactTime!==null&&r.t>=result.firstContactTime-1e-7))foul='Nenhuma bola encaçapada ou tabela após o contato.';
  if(eight&&!isBreak){const legal=!foul&&eligibleEight&&calledPocket===eight.pocket;return{foul,winner:legal?team:1-team,assigned:null,keep:false,spotEight:false,message:legal?'A preta caiu na caçapa marcada. Vitória!':!eligibleEight?'Preta encaçapada antes de limpar o grupo.':foul?`Preta encaçapada com falta. ${foul}`:'A preta caiu em uma caçapa diferente da marcada.'};}
  let assigned:Group|null=null;
  if(!isBreak&&!own&&!foul){const first=objects.find(p=>groupOf(p.id)!==null);if(first)assigned=groupOf(first.id);}
  const group=own??assigned,keep=!foul&&(isBreak?objects.length>0:objects.some(p=>groupOf(p.id)===group&&group!==null));
  return{foul,winner:null,assigned,keep,spotEight:!!eight&&isBreak,message:foul?`Falta! ${foul} Adversários com a branca na mão.`:isBreak?eight?'Preta recolocada após a saída.':keep?'Saída legal: a equipe continua. Mesa aberta.':'Mesa aberta. Vez da outra equipe.':keep?'Bola encaçapada. A equipe continua.':'Tacada legal. Vez da outra equipe.'};
}
