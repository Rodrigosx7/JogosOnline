import test from 'node:test';import assert from 'node:assert/strict';
import{applyPool,createPool,poolView,reconcilePool,type Pool}from'./game';
import{ball,rackBalls,simulateStroke,type PhysicsResult}from'./physics';
import{judgeStroke}from'./rules';import{choosePoolShot}from'./bot';
function start(mode:'1x1'|'2x2'='1x1'){let r=createPool('pool-fixture-code-000000',mode);for(let i=0;i<(mode==='2x2'?4:2);i++)r=applyPool(r,`p${i}`,{type:'join',name:`Pessoa ${i}`},0);for(const p of r.players)r=applyPool(r,p.id,{type:'ready'},0);r.currentSeat=0;r.nextSeats=[0,1];return r;}
function result(values:Partial<PhysicsResult>={}):PhysicsResult{return{balls:[],frames:[],duration:1,firstContact:1,firstContactTime:.2,pocketed:[],rails:[{id:1,t:.4}],events:[],...values};}
test('8 ball rules cover break, open table, mixed pots, wrong first ball, scratch and missing rail',()=>{
  const b=rackBalls();assert.ok(judgeStroke(b,result({rails:[]}),[null,null],0,true).foul);
  assert.equal(judgeStroke(b,result({rails:[1,2,3,4].map(id=>({id,t:.4}))}),[null,null],0,true).foul,null);
  assert.equal(judgeStroke(b,result({pocketed:[{id:8,pocket:0,t:.5}]}),[null,null],0,true).spotEight,true);
  assert.equal(judgeStroke(b,result({pocketed:[{id:10,pocket:1,t:.5},{id:1,pocket:0,t:.8}]}),[null,null],0,false).assigned,'stripes');
  assert.ok(judgeStroke(b,result({firstContact:9}),['solids','stripes'],0,false).foul);
  assert.ok(judgeStroke(b,result({pocketed:[{id:0,pocket:0,t:.5}]}),[null,null],0,false).foul);
  assert.ok(judgeStroke(b,result({rails:[{id:0,t:.1}]}),[null,null],0,false).foul);
  assert.equal(judgeStroke(b,result(),[null,null],0,false).keep,false);
  assert.equal(judgeStroke(b,result({pocketed:[{id:1,pocket:0,t:.5},{id:10,pocket:1,t:.8}]}),['solids','stripes'],0,false).keep,true);
});
test('black wins only with group cleared before the shot, correct called pocket and no foul; break is an exception',()=>{
  const full=rackBalls(),cleared=full.map(b=>({...b,pocketed:b.id>=1&&b.id<=7}));
  const p=result({firstContact:8,pocketed:[{id:8,pocket:2,t:.5}]});
  assert.equal(judgeStroke(full,p,['solids','stripes'],0,false,2).winner,1);
  assert.equal(judgeStroke(cleared,p,['solids','stripes'],0,false,2).winner,0);
  assert.equal(judgeStroke(cleared,p,['solids','stripes'],0,false,1).winner,1);
  assert.equal(judgeStroke(cleared,{...p,pocketed:[...p.pocketed,{id:0,pocket:0,t:.6}]},['solids','stripes'],0,false,2).winner,1);
  assert.equal(judgeStroke(full,p,[null,null],0,true).winner,null);
});
test('server owns physics, blocks movement and opponent commands, and settles after replay',()=>{
  let r=start();const original=structuredClone(r);r=applyPool(r,'p0',{type:'shoot',angle:0,power:.95},100);assert.deepEqual(original.balls,r.balls);assert.ok(r.pending);assert.equal(r.winner,null);
  assert.throws(()=>applyPool(r,'p0',{type:'shoot',angle:0,power:.5},101));assert.throws(()=>applyPool(r,'p1',{type:'place',x:200,y:100},101));
  const before=reconcilePool(r,r.deadline!-1);assert.ok(before.pending);const settled=reconcilePool(r,r.deadline!);assert.equal(settled.pending,null);assert.equal(settled.isBreak,false);
  assert.equal(poolView(settled,'p0',200).replay?.id,r.replay?.id);assert.equal('pending' in poolView(r,'p0',200),false);
});
test('doubles rotate partners after each scoring shot and opponents on misses',()=>{
  let r=start('2x2');r.isBreak=false;r.groups=['solids','stripes'];r.balls=[ball(0,500,240),ball(1,500,120),ball(2,720,250),ball(8,800,250),ball(9,900,300)];
  r=applyPool(r,'p0',{type:'shoot',angle:-Math.PI/2,power:.5},100);r=reconcilePool(r,r.deadline!);assert.equal(r.currentSeat,2);assert.equal(r.balls.find(b=>b.id===1)!.pocketed,true);
  r=reconcilePool(r,r.deadline!);assert.equal(r.currentSeat,1);assert.equal(r.ballInHand,'any');assert.equal(r.nextSeats[0],0);
});
test('cue placement constraints, spectator permissions, kick/leave and rejoin protection',()=>{
  let r=createPool('pool-fixture-code-000000','1x1');r=applyPool(r,'a',{type:'join',name:'Ana'},0);r=applyPool(r,'b',{type:'watch',name:'Bia'},0);assert.throws(()=>applyPool(r,'b',{type:'ready'},0));
  r=applyPool(r,'b',{type:'seat',seat:1},0);r=applyPool(r,'a',{type:'ready'},0);r=applyPool(r,'b',{type:'ready'},0);r.currentSeat=0;
  assert.throws(()=>applyPool(r,'a',{type:'place',x:500,y:250},0));r=applyPool(r,'a',{type:'place',x:160,y:100},0);assert.equal(r.balls[0].x,160);
  assert.throws(()=>applyPool(r,'a',{type:'kick',targetId:'b'},0));assert.throws(()=>applyPool(r,'a',{type:'watch'},0));
  r=applyPool(r,'c',{type:'watch',name:'Caio'},0);assert.equal(poolView(r,'c',0).legal.shoot,false);assert.equal(poolView(r,'c',0).balls.length,16);
});
test('timeout, chronologic abandonment, unanimous rematch and bot legal candidate selection',()=>{
  let r=start();r.players.forEach(p=>p.lastSeen=0);r=reconcilePool(r,45000);assert.equal(r.currentSeat,1);assert.equal(r.ballInHand,'any');r=reconcilePool(r,120000);assert.equal(r.status,'cancelled');
  r=start();r.players[1].lastSeen=1000;r=reconcilePool(r,120000);assert.equal(r.status,'finished');assert.equal(r.winner,1);
  r=applyPool(r,'p0',{type:'rematch'},120001);assert.equal(r.status,'finished');r=applyPool(r,'p1',{type:'rematch'},120002);assert.equal(r.status,'playing');assert.equal(r.shotNumber,0);
  r.isBreak=false;r.groups=['solids','stripes'];r.currentSeat=0;r.balls=[ball(0,500,240),ball(1,500,120),ball(8,700,250),ball(9,900,300)];
  const choice=choosePoolShot(r),physics=simulateStroke(r.balls,choice.stroke);assert.ok(physics.pocketed.some(p=>p.id===1));assert.equal(judgeStroke(r.balls,physics,r.groups,0,false).foul,null);
});
test('four bots finish a full deterministic doubles rack using the real physics and rules',()=>{let r=start('2x2');r.players.forEach(p=>p.isBot=true);r.balls=rackBalls();let now=100,shots=0;for(;shots<160&&r.status==='playing';shots++){const actor=r.players.find(p=>p.seat===r.currentSeat)!,choice=choosePoolShot(r);if(choice.position)r=applyPool(r,actor.id,{type:'place',...choice.position},now);r=applyPool(r,actor.id,{type:'shoot',...choice.stroke},now);now=r.deadline!;r=reconcilePool(r,now);now+=100;}assert.equal(r.status,'finished');assert.ok(shots>2&&shots<160);assert.ok(r.winner===0||r.winner===1);});
