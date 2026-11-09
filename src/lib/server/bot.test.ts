import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, createRoom, makeDeck, playerView, reconcile, type Room } from '../game';
import { advanceBot, chooseBotCommand } from './bot';

function fixture() {
  let r = createRoom('bot-test-room-123456789', '1x1');
  r = applyCommand(r, 'human', { type: 'join', name: 'Pessoa' }, 0);
  r = applyCommand(r, 'bot', { type: 'join', name: 'Bot da casa' }, 0);
  r.players[1].isBot = true;
  r = applyCommand(r, 'bot', { type: 'ready' }, 0);
  return applyCommand(r, 'human', { type: 'ready' }, 0);
}

function duoFixture() {
  let r = createRoom('bot-duo-test-123456789', '2x2');
  for (const id of ['human', 'enemy1', 'partner', 'enemy2']) {
    r = applyCommand(r, id, { type: 'join', name: id }, 0);
    if (id !== 'human') r.players.find(p => p.id === id)!.isBot = true;
  }
  for (const p of r.players) r = applyCommand(r, p.id, { type: 'ready' }, 0);
  return r;
}

test('three bots complete a doubles match, all vote for rematch, and the human answers for their team', () => {
  let r = duoFixture(), now = 4000;
  for (let i = 0; i < 3000 && r.status === 'playing'; i++) {
    r.players[0].lastSeen = now; r = reconcile(r, now);
    if (r.status !== 'playing') break;
    const view = playerView(r, 'human', now);
    if (view.legal.eleven) r = applyCommand(r, 'human', { type: 'eleven', answer: 'play' }, now);
    else if (view.legal.respond) r = applyCommand(r, 'human', { type: 'respond', answer: 'accept' }, now);
    else if (view.legal.play) r = applyCommand(r, 'human', { type: 'play', cardId: view.hand[0].id }, now);
    r = advanceBot(r, now); now += 1000;
  }
  assert.equal(r.status, 'finished'); assert.equal(r.scores[r.winner!], 11); assert.ok(r.scores.every(score => [0, 3, 5, 7, 9, 11].includes(score)));
  r = advanceBot(applyCommand(r, 'human', { type: 'rematch' }, now), now);
  assert.equal(r.status, 'playing'); assert.deepEqual(r.scores, [0, 0]);
  r.pending = { team: 1, proposed: 5, resumeSeat: 0 }; r.currentSeat = 0; r.botAction = null;
  assert.equal(advanceBot(r, now + 4000).pending?.proposed, 5);
});

test('partner bot sends a public signal and acknowledges human signals exactly once', () => {
  let r = advanceBot(duoFixture(), 4000);
  assert.ok(playerView(r, 'human', 4000).signals.some((s: any) => s.playerId === 'partner'));
  assert.equal(playerView(r, 'human', 4000).signals.some((s: any) => s.playerId.startsWith('enemy')), true);
  r = applyCommand(r, 'human', { type: 'signal', kind: 'zap' }, 4100);
  const humanSignal = r.signals!.findLast(s => s.playerId === 'human')!;
  r = advanceBot(r, 4100);
  r = advanceBot(r, 6100);
  assert.equal(r.botAcknowledgedSignals!.partner, humanSignal.id);
  assert.ok(playerView(r, 'human', 6100).signals.some((s: any) => s.playerId === 'partner' && s.kind === 'ack'));
  assert.equal(r.botAcknowledgedSignals!.enemy1, undefined);
  r = advanceBot(r, 8200);
  assert.equal(r.signals!.filter(s => s.playerId === 'partner' && s.kind === 'ack').length, 1);
});

test('partner bot can accept after the human votes to run in truco and eleven', () => {
  for (const special of [false, true]) {
    let r = duoFixture(); r.currentSeat = 0;
    r.hands.partner = makeDeck().filter(c => ['4-clubs', '4-diamonds', '5-diamonds'].includes(c.id));
    if (special) { r.scores = [11, 0]; r.eleven = { teams: [0], accepted: [] }; }
    else r.pending = { team: 1, proposed: 5, resumeSeat: 0 };
    r = applyCommand(r, 'human', { type: special ? 'eleven' : 'respond', answer: 'run' }, 4000);
    r = advanceBot(r, 4000); r = advanceBot(r, 5000);
    assert.equal(r.stake, 5); assert.equal(r.pending, null);
    assert.equal(playerView(r, 'human', 5000).eleven?.deciding ?? false, false);
    assert.deepEqual(r.scores, special ? [11, 0] : [0, 0]);
  }
});

test('bot strategy only sees its own cards; enemy private hand cannot change its choice', () => {
  const r = fixture(); r.currentSeat = 1;
  const before = playerView(r, 'bot', 4000);
  const chosen = chooseBotCommand(before);
  r.hands.human = makeDeck().slice(0, 3);
  assert.deepEqual(chooseBotCommand(playerView(r, 'bot', 4000)), chosen);
  assert.equal('hands' in before, false);
  assert.ok(!JSON.stringify(before).includes('botAction'));
});

test('bot delay survives polling, executes once, and never times out as absent', () => {
  let r = fixture(); r.currentSeat = 1;
  r = advanceBot(r, 4000);
  const due = r.botAction!.at;
  assert.equal(advanceBot(structuredClone(r), 4500).botAction!.at, due);
  const once = advanceBot(r, due);
  assert.equal(once.revision, r.revision + 1);
  const again = advanceBot(once, due);
  assert.equal(again.revision, once.revision);
  const absent = fixture(); absent.players[0].lastSeen = 100_000;
  assert.equal(reconcile(absent, 90_000).status === 'cancelled', false);
});

test('bot decides eleven from its cards and never asks truco during an eleven hand', () => {
  let r = fixture();
  r.scores = [0, 11]; r.eleven = { teams: [1], accepted: [] }; r.currentSeat = 1;
  r.hands.bot = makeDeck().filter(c => ['4-clubs', '7-hearts', 'A-spades'].includes(c.id));
  assert.deepEqual(chooseBotCommand(playerView(r, 'bot', 4000)), { type: 'eleven', answer: 'play' });
  r = applyCommand(r, 'bot', { type: 'eleven', answer: 'play' }, 4000);
  assert.equal(chooseBotCommand(playerView(r, 'bot', 4000))!.type, 'play');
  r.eleven = { teams: [1], accepted: [] };
  r.hands.bot = makeDeck().filter(c => ['4-diamonds', '5-diamonds', '6-diamonds'].includes(c.id));
  assert.deepEqual(chooseBotCommand(playerView(r, 'bot', 4000)), { type: 'eleven', answer: 'run' });
  r.scores = [11, 11]; r.eleven = { teams: [0, 1], accepted: [0, 1], forced: true }; r.stake = 5;
  assert.equal(chooseBotCommand(playerView(r, 'bot', 4000))!.type, 'play');
});

test('bot plays complete matches legally, handles raises, and accepts rematches', () => {
  let r: Room = fixture(), now = 4000;
  for (let i = 0; i < 2000 && r.status === 'playing'; i++) {
    r.players[0].lastSeen = now;
    r = reconcile(r, now);
    if (r.status !== 'playing') break;
    const view = playerView(r, 'human', now);
    if (view.legal.eleven) r = applyCommand(r, 'human', { type: 'eleven', answer: 'play' }, now);
    else if (view.legal.respond) r = applyCommand(r, 'human', { type: 'respond', answer: 'accept' }, now);
    else if (view.legal.play) r = applyCommand(r, 'human', { type: 'play', cardId: view.hand[0].id }, now);
    r = advanceBot(r, now);
    now += 1000;
  }
  assert.equal(r.status, 'finished');
  assert.equal(r.scores[r.winner!], 11); assert.ok(r.scores.every(score => [0, 3, 5, 7, 9, 11].includes(score)));
  r = advanceBot(applyCommand(r, 'human', { type: 'rematch' }, now), now);
  assert.equal(r.status, 'playing');
  assert.deepEqual(r.scores, [0, 0]);
});
