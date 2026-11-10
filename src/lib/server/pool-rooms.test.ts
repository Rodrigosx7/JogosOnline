import test from 'node:test';import assert from 'node:assert/strict';import{mkdtemp,rm}from'node:fs/promises';import os from'node:os';import path from'node:path';
import{FileRoomStore}from'./storage';import{newPoolRoom,accessPoolRoom,openPoolRooms}from'./pool-rooms';import{newRoom,accessRoom,openRooms}from'./rooms';import{accessDominoRoom}from'./domino-rooms';
test('pool APIs isolate games, authorize seats and shooting, and deduplicate a simultaneous stroke',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'pool-api-'));try{const store=new FileRoomStore(directory),{code}=await newPoolRoom('a',{name:'Ana',mode:'1x1',listed:true},store);
    await assert.rejects(accessRoom(code,'a',undefined,store),{status:404});await assert.rejects(accessDominoRoom(code,'a',undefined,store),{status:404});assert.deepEqual(await openRooms(store),[]);assert.equal((await openPoolRooms(store)).length,1);
    const truco=await newRoom('other',{name:'Truco',mode:'1x1',listed:true},store);await assert.rejects(accessPoolRoom(truco.code,'other',undefined,store),{status:404});
    await assert.rejects(accessPoolRoom(code,'outsider',undefined,store),{status:403});let n=0;
    async function send(id:string,command:any){const current=await accessPoolRoom(code,id,undefined,store).catch(()=>({view:{revision:0}}));return accessPoolRoom(code,id,{command,revision:current.view.revision,requestId:`pool-command-${++n}`},store);}
    await send('b',{type:'join',name:'Bia'});await send('a',{type:'ready'});await send('b',{type:'ready'});
    const state=(await accessPoolRoom(code,'a',undefined,store)).view,actor=state.players.find(p=>p.seat===state.currentSeat)!.id;
    await assert.rejects(send(actor==='a'?'b':'a',{type:'shoot',angle:0,power:.5}),{status:400});
    const input={command:{type:'shoot',angle:0,power:.8,balls:[{id:8,pocketed:true}],winner:0},revision:state.revision,requestId:'pool-shot-duplicate'};
    const results=await Promise.all([accessPoolRoom(code,actor,input,store),accessPoolRoom(code,actor,input,store)]);assert.deepEqual(results.map(r=>r.status),[200,200]);assert.equal(results[1].view.shotNumber,1);assert.equal(results[1].view.winner,null);assert.equal(results[1].view.moving,true);
    await send('watch',{type:'watch',name:'Visitante'});await assert.rejects(send('watch',{type:'shoot',angle:0,power:.5}),{status:400});
  }finally{await rm(directory,{recursive:true,force:true});}
});
