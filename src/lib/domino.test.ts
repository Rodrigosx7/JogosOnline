import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDomino, advanceDominoBots, createDomino, dominoMoves, dominoSet, dominoView, reconcileDomino, type Domino, type Stone } from './domino';

function ready() {
  let r = createDomino('domino-test');
  for (let i = 0; i < 4; i++) r = applyDomino(r, `p${i}`, { type: 'join', name: `Pessoa ${i}` }, 0);
  for (let i = 0; i < 4; i++) r = applyDomino(r, `p${i}`, { type: 'ready' }, 0);
  return r;
}
const stone = (a: number, b: number): Stone => ({ id: `${Math.min(a, b)}-${Math.max(a, b)}`, a: Math.min(a, b), b: Math.max(a, b) });

test('domino has 28 unique stones, 168 pips, seven per player and forced 6–6 opening', () => {
  const deck = dominoSet(); assert.equal(deck.length, 28); assert.equal(new Set(deck.map(s => s.id)).size, 28);
  assert.equal(deck.reduce((sum, s) => sum + s.a + s.b, 0), 168);
  const r = ready(), actor = r.players.find(p => p.seat === r.currentSeat)!;
  assert.deepEqual(r.players.map(p => r.hands[p.id].length), [7, 7, 7, 7]);
  assert.equal(new Set(Object.values(r.hands).flat().map(s => s.id)).size, 28);
  assert.deepEqual(dominoMoves(r, actor.id), [{ id: '6-6', ends: ['right'] }]);
  assert.throws(() => applyDomino(r, actor.id, { type: 'pass' }, 0));
  assert.throws(() => applyDomino(r, r.players.find(p => p.id !== actor.id)!.id, { type: 'play', stoneId: '6-6', end: 'right' }, 0));
});
test('both ends orient correctly; invalid stones and false passes never modify input', () => {
  const original = ready(); original.handNumber = 2; original.currentSeat = 0;
  original.board = [{ id: '2-5', left: 2, right: 5, seat: 3 }]; original.hands.p0 = [stone(2, 6), stone(1, 3)];
  const before = JSON.stringify(original);
  let r = applyDomino(original, 'p0', { type: 'play', stoneId: '2-6', end: 'left' }, 0);
  assert.equal(JSON.stringify(original), before); assert.equal(r.board[0].left, 6); assert.equal(r.board[0].right, 2);
  assert.throws(() => applyDomino(original, 'p0', { type: 'play', stoneId: '2-6', end: 'right' }, 0));
  assert.throws(() => applyDomino(original, 'p0', { type: 'pass' }, 0));
  r.currentSeat = 1; r.hands.p1 = [stone(3, 5), stone(0, 1)];
  r = applyDomino(r, 'p1', { type: 'play', stoneId: '3-5', end: 'right' }, 0);
  assert.equal(r.board.at(-1)!.left, 5); assert.equal(r.board.at(-1)!.right, 3);
  assert.ok(r.board.every((s, i) => i === 0 || r.board[i - 1].right === s.left));
});
test('batida counts only adversaries, supports reaching/passing 100 and rotates next starter', () => {
  let r = ready(); r.handNumber = 2; r.currentSeat = 0; r.starter = 0; r.board = [];
  r.hands = { p0: [stone(1, 1)], p1: [stone(6, 5)], p2: [stone(6, 6)], p3: [stone(2, 4)] };
  const won = applyDomino(r, 'p0', { type: 'play', stoneId: '1-1', end: 'right' }, 0);
  assert.deepEqual(won.scores, [17, 0]); assert.deepEqual(won.result!.totals, [12, 17]); assert.equal(won.status, 'between');
  const next = reconcileDomino(won, 4000); assert.equal(next.starter, 1); assert.equal(next.handNumber, 3); assert.equal(next.board.length, 0);
  r.scores = [90, 0]; const final = applyDomino(r, 'p0', { type: 'play', stoneId: '1-1', end: 'right' }, 0);
  assert.equal(final.status, 'finished'); assert.equal(final.winner, 0); assert.equal(final.scores[0], 107);
});
test('four passes settle a tranca by combined team pips, and ties give no points', () => {
  for (const tie of [true, false]) {
    let r = ready(); r.handNumber = 2; r.currentSeat = 0;
    r.board = [{ id: '6-6', left: 6, right: 6, seat: 3 }];
    r.hands = { p0: [stone(0, 1)], p1: [stone(0, 2)], p2: [stone(0, 3)], p3: [stone(0, tie ? 2 : 5)] };
    for (let i = 0; i < 4; i++) r = applyDomino(r, `p${i}`, { type: 'pass' }, 0);
    assert.equal(r.status, 'between'); assert.equal(r.result!.reason, tie ? 'empate' : 'tranca');
    assert.deepEqual(r.scores, tie ? [0, 0] : [7, 0]);
  }
});
test('views expose only own stones, host-only bots preserve humans and rematch needs all', () => {
  let r = createDomino('fixture');
  for (let i = 0; i < 3; i++) r = applyDomino(r, `p${i}`, { type: 'join', name: `Pessoa ${i}` }, 0);
  assert.throws(() => applyDomino(r, 'p1', { type: 'fill-bots' }, 0));
  r = applyDomino(r, 'p0', { type: 'fill-bots' }, 0);
  assert.equal(r.players.filter(p => p.isBot).length, 1); assert.equal(r.status, 'waiting');
  for (let i = 0; i < 3; i++) r = applyDomino(r, `p${i}`, { type: 'ready' }, 0);
  for (const p of r.players) {
    const view = dominoView(r, p.id, 0); assert.deepEqual(view.hand, r.hands[p.id]); assert.equal('hands' in view, false);
    assert.equal('lastSeen' in view.players[0], false);
  }
  assert.deepEqual(dominoView(r, 'outsider', 0).hand, []);
  r.status = 'finished'; r.winner = 0; r.scores = [101, 20];
  r = applyDomino(r, 'p0', { type: 'rematch' }, 100);
  r = advanceDominoBots(r, 100); assert.equal(r.status, 'finished');
  for (const id of ['p1', 'p2']) r = applyDomino(r, id, { type: 'rematch' }, 100);
  assert.equal(r.status, 'playing'); assert.deepEqual(r.scores, [0, 0]);
});
test('timeouts are legal, reconnection cannot revive a prior abandonment and simultaneous absence cancels', () => {
  const r = ready(); const moved = reconcileDomino(r, 30000); assert.equal(moved.board[0].id, '6-6');
  const absent = ready(); absent.players[0].lastSeen = -89000;
  const lost = reconcileDomino(absent, 1000); assert.equal(lost.winner, 1); assert.equal(lost.status, 'finished');
  const cancelled = reconcileDomino(ready(), 90000); assert.equal(cancelled.status, 'cancelled');
});
test('four bots complete a full match using legal stones and consistent chain orientation', () => {
  let r: Domino = ready(); r.players.forEach(p => { p.isBot = true; });
  for (let now = 1000; now < 10000000 && r.status !== 'finished'; now += 1000) {
    r = advanceDominoBots(reconcileDomino(r, now), now);
    assert.ok(r.board.every((s, i) => i === 0 || r.board[i - 1].right === s.left));
  }
  assert.equal(r.status, 'finished'); assert.ok(r.scores[r.winner!] >= 100);
});
