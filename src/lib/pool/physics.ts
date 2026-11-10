export const TABLE={width:1000,height:500,radius:10.5,maxSpeed:1200,friction:125};
export const POCKETS=[{x:0,y:0},{x:500,y:-3},{x:1000,y:0},{x:0,y:500},{x:500,y:503},{x:1000,y:500}];
export type Ball={id:number;x:number;y:number;vx:number;vy:number;sx:number;sy:number;pocketed:boolean};
export type Stroke={angle:number;power:number;spinX?:number;spinY?:number;calledPocket?:number};
export type Frame={t:number;p:number[]};
export type PhysicsResult={balls:Ball[];frames:Frame[];duration:number;firstContact:number|null;firstContactTime:number|null;pocketed:{id:number;pocket:number;t:number}[];rails:{id:number;t:number}[];events:{kind:'ball'|'rail'|'pocket';t:number;id:number}[]};
const R=TABLE.radius,DT=1/240,EPS=1e-7;
const segments=[{axis:'y',pos:R,lo:28,hi:474,dir:-1},{axis:'y',pos:R,lo:526,hi:972,dir:-1},{axis:'y',pos:500-R,lo:28,hi:474,dir:1},{axis:'y',pos:500-R,lo:526,hi:972,dir:1},{axis:'x',pos:R,lo:28,hi:472,dir:-1},{axis:'x',pos:1000-R,lo:28,hi:472,dir:1}] as const;
const jaws=[{x:28,y:0},{x:474,y:0},{x:526,y:0},{x:972,y:0},{x:28,y:500},{x:474,y:500},{x:526,y:500},{x:972,y:500},{x:0,y:28},{x:0,y:472},{x:1000,y:28},{x:1000,y:472}];
export const ball=(id:number,x:number,y:number):Ball=>({id,x,y,vx:0,vy:0,sx:0,sy:0,pocketed:false});
export function rackBalls(order?:number[]):Ball[]{
  const remaining=(order??Array.from({length:15},(_,i)=>i+1)).filter(id=>![1,8,9].includes(id));
  const balls=[ball(0,240,250)];let index=0;
  for(let row=0;row<5;row++)for(let column=0;column<=row;column++)balls.push(ball(row===2&&column===1?8:row===4&&column===0?1:row===4&&column===4?9:remaining[index++],720+row*(2*R+.08)*Math.sqrt(3)/2,250+(column-row/2)*(2*R+.08)));
  return balls.sort((a,b)=>a.id-b.id);
}
export function validCuePosition(balls:Ball[],x:number,y:number,breakOnly=false){return Number.isFinite(x)&&Number.isFinite(y)&&x>=R&&x<=1000-R&&y>=R&&y<=500-R&&(!breakOnly||x<=250)&&balls.every(b=>b.id===0||b.pocketed||Math.hypot(b.x-x,b.y-y)>=2*R+.2)&&POCKETS.every(p=>Math.hypot(p.x-x,p.y-y)>24);}
export function freeCuePosition(balls:Ball[],breakOnly=false){for(const x of [240,160,320,400,80,560,640,800,880,950])for(const y of [250,100,400,180,320,50,450])if(validCuePosition(balls,x,y,breakOnly))return{x,y};for(let x=30;x<980;x+=24)for(let y=30;y<480;y+=24)if(validCuePosition(balls,x,y,breakOnly))return{x,y};throw Error('Não há posição livre para a branca.');}
function circleTime(dx:number,dy:number,vx:number,vy:number,radius:number,maximum:number){const a=vx*vx+vy*vy,b=2*(dx*vx+dy*vy),c=dx*dx+dy*dy-radius*radius;if(a<EPS||b>=0)return Infinity;if(c<=EPS)return 0;const discriminant=b*b-4*a*c;if(discriminant<0)return Infinity;const t=(-b-Math.sqrt(discriminant))/(2*a);return t>=-EPS&&t<=maximum+EPS?Math.max(0,t):Infinity;}
export function simulateStroke(initial:Ball[],stroke:Stroke):PhysicsResult{
  if(!Number.isFinite(stroke.angle)||!Number.isFinite(stroke.power)||stroke.power<.05||stroke.power>1||!Number.isFinite(stroke.spinX??0)||!Number.isFinite(stroke.spinY??0)||Math.hypot(stroke.spinX??0,stroke.spinY??0)>1.001)throw Error('Tacada inválida.');
  const balls=structuredClone(initial).sort((a,b)=>a.id-b.id),cue=balls.find(b=>b.id===0);if(!cue||cue.pocketed)throw Error('Posicione a branca antes de jogar.');
  for(const b of balls){b.vx=0;b.vy=0;b.sx=0;b.sy=0;}
  cue.vx=Math.cos(stroke.angle)*stroke.power*TABLE.maxSpeed;cue.vy=Math.sin(stroke.angle)*stroke.power*TABLE.maxSpeed;cue.sx=stroke.spinX??0;cue.sy=stroke.spinY??0;
  const result:PhysicsResult={balls,frames:[],duration:0,firstContact:null,firstContactTime:null,pocketed:[],rails:[],events:[]};
  const capture=(t:number)=>{if(result.frames.length&&Math.abs(result.frames.at(-1)!.t-t)<.00001)result.frames.pop();result.frames.push({t,p:balls.flatMap(b=>b.pocketed?[-1,-1]:[Math.round(b.x*1000)/1000,Math.round(b.y*1000)/1000])});};
  capture(0);let time=0;
  for(let step=0;step<3360;step++){
    let remaining=DT,iterations=0,collided=false;
    while(remaining>EPS&&iterations++<48){
      let earliest=remaining+1,kind='',i=-1,j=-1;
      const consider=(t:number,k:string,a:number,b:number)=>{if(t<earliest-EPS){earliest=t;kind=k;i=a;j=b;}};
      for(let a=0;a<balls.length;a++){const b=balls[a];if(b.pocketed||Math.hypot(b.vx,b.vy)<.01)continue;
        for(let p=0;p<POCKETS.length;p++)consider(circleTime(b.x-POCKETS[p].x,b.y-POCKETS[p].y,b.vx,b.vy,23.5,remaining),'pocket',a,p);
        for(let s=0;s<segments.length;s++){const wall=segments[s],v=wall.axis==='x'?b.vx:b.vy;if(v*wall.dir<=0)continue;const pos=wall.axis==='x'?b.x:b.y,t=(wall.pos-pos)/v,coordinate=wall.axis==='x'?b.y+b.vy*t:b.x+b.vx*t;if(t>=-EPS&&t<=remaining+EPS&&coordinate>=wall.lo-EPS&&coordinate<=wall.hi+EPS)consider(Math.max(0,t),'wall',a,s);}
        for(let k=0;k<jaws.length;k++)consider(circleTime(b.x-jaws[k].x,b.y-jaws[k].y,b.vx,b.vy,R+5,remaining),'jaw',a,k);
      }
      for(let a=0;a<balls.length;a++)for(let b=a+1;b<balls.length;b++){const one=balls[a],two=balls[b];if(one.pocketed||two.pocketed||(Math.abs(one.vx)+Math.abs(one.vy)+Math.abs(two.vx)+Math.abs(two.vy)<.01))continue;consider(circleTime(two.x-one.x,two.y-one.y,two.vx-one.vx,two.vy-one.vy,2*R,remaining),'ball',a,b);}
      const move=earliest<=remaining?earliest:remaining;
      for(const b of balls)if(!b.pocketed){b.x+=b.vx*move;b.y+=b.vy*move;}
      remaining-=move;if(earliest>move+EPS||!kind)break;
      const at=time+DT-remaining,one=balls[i];collided=true;
      if(kind==='pocket'){one.pocketed=true;one.vx=one.vy=0;result.pocketed.push({id:one.id,pocket:j,t:at});result.events.push({kind:'pocket',id:one.id,t:at});}
      else if(kind==='ball'){
        const two=balls[j],distance=Math.hypot(two.x-one.x,two.y-one.y)||2*R,nx=(two.x-one.x)/distance,ny=(two.y-one.y)/distance,closing=(one.vx-two.vx)*nx+(one.vy-two.vy)*ny;
        if(closing>0){const impulse=.98*closing;one.vx-=impulse*nx;one.vy-=impulse*ny;two.vx+=impulse*nx;two.vy+=impulse*ny;
          const correction=Math.max(.00001,(2*R-distance)/2+.00001);one.x-=nx*correction;one.y-=ny*correction;two.x+=nx*correction;two.y+=ny*correction;
          if(one.id===0||two.id===0){if(result.firstContact===null){result.firstContact=one.id===0?two.id:one.id;result.firstContactTime=at;}const object=one.id===0?two:one,dx=(object.x-cue.x)/(2*R),dy=(object.y-cue.y)/(2*R);cue.vx+=dx*cue.sy*closing*.2;cue.vy+=dy*cue.sy*closing*.2;cue.sy*=.3;}
          result.events.push({kind:'ball',id:two.id,t:at});
        }
      }else{
        let nx=0,ny=0;
        if(kind==='wall'){const wall=segments[j];nx=wall.axis==='x'?-wall.dir:0;ny=wall.axis==='y'?-wall.dir:0;}
        else{const d=Math.hypot(one.x-jaws[j].x,one.y-jaws[j].y)||1;nx=(one.x-jaws[j].x)/d;ny=(one.y-jaws[j].y)/d;}
        const incoming=one.vx*nx+one.vy*ny;if(incoming<0){const speed=Math.hypot(one.vx,one.vy);one.vx-=1.84*incoming*nx;one.vy-=1.84*incoming*ny;one.vx+=-ny*one.sx*speed*.08;one.vy+=nx*one.sx*speed*.08;one.sx*=.6;one.x+=nx*.0001;one.y+=ny*.0001;result.rails.push({id:one.id,t:at});result.events.push({kind:'rail',id:one.id,t:at});}
      }
      // Guarantee progress through simultaneous contacts in a tightly packed rack.
      if(move<EPS){const tiny=Math.min(remaining,1e-7);for(const b of balls)if(!b.pocketed){b.x+=b.vx*tiny;b.y+=b.vy*tiny;}remaining-=tiny;}
    }
    time+=DT;let moving=false;
    for(const b of balls)if(!b.pocketed){const speed=Math.hypot(b.vx,b.vy),nextSpeed=Math.max(0,Math.min(TABLE.maxSpeed,speed)-TABLE.friction*DT);if(nextSpeed<1.5){b.vx=b.vy=0;}else{b.vx*=nextSpeed/speed;b.vy*=nextSpeed/speed;moving=true;}b.sx*=.993;b.sy*=.993;
      if(b.x< -2*R||b.x>1000+2*R||b.y< -2*R||b.y>500+2*R){const pocket=POCKETS.reduce((best,p,k)=>Math.hypot(p.x-b.x,p.y-b.y)<Math.hypot(POCKETS[best].x-b.x,POCKETS[best].y-b.y)?k:best,0);b.pocketed=true;b.vx=b.vy=0;result.pocketed.push({id:b.id,pocket,t:time});result.events.push({kind:'pocket',id:b.id,t:time});}}
    if(step%12===0||(collided&&time-result.frames.at(-1)!.t>1/120))capture(time);
    if(!moving)break;
  }
  for(const b of balls){b.vx=b.vy=0;b.sx=b.sy=0;}
  result.duration=time;capture(time);return result;
}

export function aimGuide(balls:Ball[],angle:number){const cue=balls.find(b=>b.id===0&&!b.pocketed);if(!cue)return null;const dx=Math.cos(angle),dy=Math.sin(angle);let distance=1200,target:Ball|undefined;
  for(const b of balls)if(b.id!==0&&!b.pocketed){const t=circleTime(cue.x-b.x,cue.y-b.y,dx,dy,2*R,1200);if(t<distance){distance=t;target=b;}}
  for(const t of [(R-cue.x)/dx,(1000-R-cue.x)/dx,(R-cue.y)/dy,(500-R-cue.y)/dy])if(t>0&&t<distance){distance=t;target=undefined;}
  return {x:cue.x+dx*distance,y:cue.y+dy*distance,target:target?.id??null};
}
