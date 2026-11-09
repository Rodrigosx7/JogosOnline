import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileRoomStore } from './storage';
import { accessRoom, newRoom, openRooms } from './rooms';
import { applyCommand, createRoom } from '../game';

async function fixture(action: (store: FileRoomStore) => Promise<void>) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mesa-api-'));
  try { await action(new FileRoomStore(directory)); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test('open rooms expose only opted-in waiting rooms with vacancies and an active host', () => fixture(async store => {
  const listed = await newRoom('alice', { mode: '2x2', name: 'Alice', listed: true }, store);
  await newRoom('private', { mode: '2x2', name: 'Privada' }, store);
  await newRoom('bot', { mode: '2x2', name: 'Treino', practice: true, listed: true }, store);
  let rooms = await openRooms(store);
  assert.deepEqual(rooms, [{ code: listed.code, mode: '2x2', host: 'Alice', players: 1, capacity: 4 }]);
  assert.equal(JSON.stringify(rooms).includes('lastSeen'), false);
  assert.equal(JSON.stringify(rooms).includes('hands'), false);
  assert.deepEqual(await openRooms(store, Date.now() + 91_000), []);
  const stored = (await store.get<any>(listed.code))!;
  stored.document.state.status = 'playing';
  await store.compareAndSwap(listed.code, stored.version, stored.document);
  assert.deepEqual(await openRooms(store), []);
}));

test('practice creates a ready bot without granting another human its seat', () => fixture(async store => {
  const { code } = await newRoom('alice', { mode: '1x1', name: 'Alice', practice: true }, store);
  const result = await accessRoom(code, 'alice', undefined, store);
  assert.equal(result.view.players.length, 2);
  assert.equal(result.view.players.filter((p: { isBot: boolean; ready: boolean }) => p.isBot && p.ready).length, 1);
  await assert.rejects(accessRoom(code, 'bob', { command: { type: 'join', name: 'Bob' }, revision: 0, requestId: 'bot-join-denied' }, store), { status: 400 });
  const duo = await newRoom('alice', { mode: '2x2', name: 'Alice', practice: true }, store);
  const teams = (await accessRoom(duo.code, 'alice', undefined, store)).view;
  assert.equal(teams.players.filter((p: any) => p.isBot && p.ready).length, 3);
  assert.equal(teams.players.find((p: any) => p.name === 'Bot parceiro').seat, 2);
}));

test('concurrent chat and card play both commit, and duplicate messages are not repeated', () => fixture(async store => {
  const { code } = await newRoom('alice', { mode: '1x1', name: 'Alice' }, store);
  let sequence = 0;
  async function send(id: string, command: any, revision?: number, requestId = `social-request-${++sequence}`) {
    const current = await accessRoom(code, id, undefined, store).catch(() => ({ view: { revision: 0 } }));
    return accessRoom(code, id, { command, revision: revision ?? current.view.revision, requestId }, store);
  }
  await send('bob', { type: 'join', name: 'Bob' }, 0);
  await send('alice', { type: 'ready' }); await send('bob', { type: 'ready' });
  const state = (await accessRoom(code, 'alice', undefined, store)).view;
  const actor = state.players.find((p: any) => p.seat === state.currentSeat).id;
  const own = (await accessRoom(code, actor, undefined, store)).view;
  const results = await Promise.all([
    send('alice', { type: 'chat', text: 'Boa partida!' }, state.revision, 'chat-idempotent-1'),
    send(actor, { type: 'play', cardId: own.hand[0].id }, state.revision),
  ]);
  assert.deepEqual(results.map(r => r.status), [200, 200]);
  const duplicate = await send('alice', { type: 'chat', text: 'Boa partida!' }, 0, 'chat-idempotent-1');
  assert.equal(duplicate.view.chat.length, 1);
  assert.equal(duplicate.view.revision, state.revision + 1);
  await assert.rejects(accessRoom(code, 'outsider', { command: { type: 'chat', text: 'Invadindo' }, revision: 0, requestId: 'outsider-social-1' }, store), { status: 403 });
}));
test('private access, idempotency and concurrent revisions use the authoritative identity', () => fixture(async store => {
  const { code } = await newRoom('alice', { mode: '1x1', name: 'Alice' }, store);
  await assert.rejects(accessRoom(code, 'outsider', undefined, store), { status: 403 });
  const joined = await accessRoom(code, 'bob', { command: { type: 'join', name: 'Bob' }, revision: 0, requestId: 'bob-join-0001' }, store);
  const revision = joined.view.revision;
  const concurrent = await Promise.all([
    accessRoom(code, 'alice', { command: { type: 'ready' }, revision, requestId: 'alice-ready-001' }, store),
    accessRoom(code, 'bob', { command: { type: 'ready' }, revision, requestId: 'bob-ready-0001' }, store),
  ]);
  assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 409]);
  const winnerIndex = concurrent.findIndex(result => result.status === 200);
  const winner = winnerIndex === 0 ? 'alice' : 'bob';
  const requestId = winnerIndex === 0 ? 'alice-ready-001' : 'bob-ready-0001';
  const duplicate = await accessRoom(code, winner, { command: { type: 'ready' }, revision, requestId }, store);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.view.players.find((player: { id: string }) => player.id === winner).ready, true);
  assert.equal(duplicate.view.revision, concurrent[winnerIndex].view.revision);
  assert.equal('hands' in duplicate.view, false);
}));

test('reconnect reconciles historical absence before recording the new heartbeat', () => fixture(async store => {
  const code = 'abcdefghijklmnopqrstuvwxyz';
  const previous = Date.now() - 100_000;
  let state = createRoom(code, '1x1');
  state = applyCommand(state, 'alice', { type: 'join', name: 'Alice' }, previous);
  state = applyCommand(state, 'bob', { type: 'join', name: 'Bob' }, previous);
  state = applyCommand(state, 'alice', { type: 'ready' }, previous);
  state = applyCommand(state, 'bob', { type: 'ready' }, previous);
  await store.create(code, { state, requests: {} });
  const result = await accessRoom(code, 'alice', undefined, store);
  assert.equal(result.view.status, 'cancelled');
  assert.equal(result.view.winner, null);
  const again = await accessRoom(code, 'alice', undefined, store);
  assert.equal(again.view.revision, result.view.revision);
}));

test('simultaneous partner run and accept use the same decision and do not conflict', () => fixture(async store => {
  const code = 'decision-concurrency-1234'; let state = createRoom(code, '2x2'); const now = Date.now();
  for (const id of ['p0', 'p1', 'p2', 'p3']) state = applyCommand(state, id, { type: 'join', name: id }, now);
  for (const id of ['p0', 'p1', 'p2', 'p3']) state = applyCommand(state, id, { type: 'ready' }, now);
  state.currentSeat = 0; state = applyCommand(state, 'p0', { type: 'raise' }, now);
  await store.create(code, { state, requests: {} });
  const revision = state.revision, decisionId = state.pending!.id;
  const results = await Promise.all([
    accessRoom(code, 'p1', { command: { type: 'respond', answer: 'run', decisionId }, revision, requestId: 'vote-running-01' }, store),
    accessRoom(code, 'p3', { command: { type: 'respond', answer: 'accept', decisionId }, revision, requestId: 'vote-accepting-01' }, store),
  ]);
  assert.deepEqual(results.map(v => v.status), [200, 200]);
  const current = (await accessRoom(code, 'p0', undefined, store)).view;
  assert.equal(current.stake, 5); assert.equal(current.pending, null); assert.deepEqual(current.scores, [0, 0]);
}));

test('spectator access stays public, lobby seats and removals enforce authenticated host', () => fixture(async store => {
  const { code } = await newRoom('host', { mode: '1x1', name: 'Anfitrião', tableTheme: 'skol' }, store);
  let sequence = 0;
  async function send(id: string, command: any) {
    const state = await accessRoom(code, id, undefined, store).catch(() => ({ view: { revision: 0 } }));
    return accessRoom(code, id, { command, revision: state.view.revision, requestId: `spectator-api-${++sequence}` }, store);
  }
  await send('other', { type:'join', name:'Outro' });
  await send('watcher', { type:'watch', name:'Visitante' });
  const watched = (await accessRoom(code,'watcher',undefined,store)).view;
  assert.equal(watched.isSpectator,true);assert.deepEqual(watched.hand,[]);assert.deepEqual(watched.partnerHands,[]);
  assert.equal(watched.tableTheme,'skol');assert.equal(watched.sync,'polling');
  await assert.rejects(send('other',{type:'kick',targetId:'host'}),{status:400});
  await send('host',{type:'kick',targetId:'other'});
  await assert.rejects(send('other',{type:'watch',name:'Reentrada'}),{status:403});
  await send('watcher',{type:'seat',seat:1});
  assert.equal((await accessRoom(code,'watcher',undefined,store)).view.isSpectator,false);
  await send('host',{type:'ready'});await send('watcher',{type:'ready'});
  await send('observer',{type:'watch',name:'Observador'});
  await assert.rejects(send('observer',{type:'play',cardId:'4-clubs'}),{status:400});
  await assert.rejects(send('watcher',{type:'watch'}),{status:400});
  await assert.rejects(send('host',{type:'kick',targetId:'watcher'}),{status:400});
  const secret = (await store.get<any>(code))!.document.state.hands;
  const view = (await accessRoom(code,'observer',undefined,store)).view;
  assert.deepEqual(view.hand,[]);assert.deepEqual(view.partnerHands,[]);assert.equal('hands' in view,false);
  for(const cards of Object.values(secret) as any[]) for(const card of cards) assert.equal(JSON.stringify(view).includes(card.id),false);
  await send('observer',{type:'leave'});
  await assert.rejects(accessRoom(code,'observer',undefined,store),{status:403});
}));

test('normal run response tokens are idempotent; cap wins concurrent pending eleven refusal without awarding twice', () => fixture(async store => {
  const {code}=await newRoom('p0',{mode:'2x2',name:'Pessoa 0'},store);let request=0;
  async function send(id:string,command:any) {
    const state=await accessRoom(code,id,undefined,store).catch(()=>({view:{revision:0}}));
    return accessRoom(code,id,{command,revision:state.view.revision,requestId:`run-decision-${++request}`},store);
  }
  for(let i=1;i<4;i++) await send(`p${i}`,{type:'join',name:`Pessoa ${i}`});
  for(let i=0;i<4;i++) await send(`p${i}`,{type:'ready'});
  let saved=(await store.get<any>(code))!;saved.document.state.currentSeat=0;
  await store.compareAndSwap(code,saved.version,saved.document);
  const asked=(await send('p0',{type:'run'})).view;
  const input={command:{type:'run-response',answer:'play',decisionId:asked.runRequest.id},revision:asked.revision,requestId:'run-response-retry'};
  const first=await accessRoom(code,'p2',input,store),second=await accessRoom(code,'p2',input,store);
  assert.equal(first.status,200);assert.equal(second.view.revision,first.view.revision);assert.deepEqual(second.view.scores,[0,0]);
  saved=(await store.get<any>(code))!;
  const decisionId='cap-eleven-decision';
  Object.assign(saved.document.state,{scores:[11,3],eleven:{id:decisionId,teams:[0],accepted:[],runVotes:['p0']}});
  saved.document.state.revision++;
  await store.compareAndSwap(code,saved.version,saved.document);
  const revision=saved.document.state.revision;
  await accessRoom(code,'p1',{command:{type:'cap',decisionId},revision,requestId:'cap-first-001'},store);
  const late=await accessRoom(code,'p2',{command:{type:'eleven',answer:'run',decisionId},revision,requestId:'cap-late-run-001'},store);
  assert.equal(late.status,200);assert.equal(late.view.eleven.deciding,false);assert.equal(late.view.stake,5);assert.deepEqual(late.view.scores,[11,3]);
}));

test('manual pulls and end votes merge concurrent revisions and reject commands from a prior match',()=>fixture(async store=>{
  const {code}=await newRoom('a',{mode:'1x1',name:'Ana',variant:'custom',scoreMode:'manual'},store);let index=0;
  async function send(id:string,command:any){const current=await accessRoom(code,id,undefined,store).catch(()=>({view:{revision:0}}));return accessRoom(code,id,{command,revision:current.view.revision,requestId:`manual-sequence-${++index}`},store);}
  await send('b',{type:'join',name:'Bia'});await send('a',{type:'ready'});await send('b',{type:'ready'});
  let state=(await accessRoom(code,'a',undefined,store)).view;
  const matchId=state.matchId,revision=state.revision;
  const pulled=await Promise.all(['a','b'].map((id,i)=>accessRoom(code,id,{command:{type:'pull',amount:3,matchId},revision,requestId:`concurrent-pull-${i}`},store)));
  assert.deepEqual(pulled.map(x=>x.status),[200,200]);assert.deepEqual((await accessRoom(code,'a',undefined,store)).view.scores,[3,3]);
  state=(await accessRoom(code,'a',undefined,store)).view;
  const ended=await Promise.all(['a','b'].map((id,i)=>accessRoom(code,id,{command:{type:'finish-vote',vote:true,matchId},revision:state.revision,requestId:`concurrent-end-${i}`},store)));
  assert.deepEqual(ended.map(x=>x.status),[200,200]);assert.equal((await accessRoom(code,'a',undefined,store)).view.status,'finished');
  await send('a',{type:'rematch'});await send('b',{type:'rematch'});
  const next=(await accessRoom(code,'a',undefined,store)).view;assert.notEqual(next.matchId,matchId);
  const stale=await accessRoom(code,'a',{command:{type:'pull',amount:11,matchId},revision:next.revision,requestId:'prior-match-pull'},store);assert.equal(stale.status,409);assert.deepEqual(stale.view.scores,[0,0]);
}));
