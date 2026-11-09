import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, applyCommand, reconcile, playerView, makeDeck, cardStrength, type Room, type Card } from './game';
import {defaultCustomConfig} from './custom-mode';

const card = (rank: string, suit = 'diamonds'): Card => ({ id: `${rank}-${suit}`, rank, suit });
function start(mode: '1x1' | '2x2' = '1x1'): Room {
  let r = createRoom('ABC123', mode);
  for (let i = 0; i < (mode === '1x1' ? 2 : 4); i++) r = applyCommand(r, `p${i}`, { type: 'join', name: `Pessoa ${i}` }, 0);
  for (const p of r.players) r = applyCommand(r, p.id, { type: 'ready' }, 0);
  return r;
}
function action(r: Room, command: any, now = 0, seat = r.currentSeat) {
  return applyCommand(r, r.players.find(p => p.seat === seat)!.id, command, now);
}
function setHands(r: Room, cards: Card[][]) {
  r.currentSeat = 0;
  cards.forEach((hand, seat) => r.hands[r.players.find(p => p.seat === seat)!.id] = hand);
}
function trick(r: Room, cards: Card[], covered = false): Room {
  const now = (r.deadline ?? 30_000) - 30_000;
  for (const c of cards) r = action(r, { type: 'play', cardId: c.id, covered }, now);
  return reconcile(r, r.transition!.until);
}

function winHand(r: Room): Room {
  r = structuredClone(r);
  setHands(r, [[card('3')], [card('4')]]);
  r.trickNumber = 2; r.trickResults = [0]; r.trick = [];
  return trick(r, [card('3'), card('4')]);
}
function eleven(mode: '1x1' | '2x2' = '1x1', opponent = 0) {
  const r = start(mode); r.scores = [9, opponent]; r.currentSeat = 1;
  let result = action(r, { type: 'run' });
  if (result.runRequest) result = action(result, { type: 'run-response', answer: 'run' }, 0, 3);
  return result;
}

test('doubles truco waits for both run votes; one accept or counter is enough to continue', () => {
  for (const answer of ['accept', 'raise', 'run']) {
    let r = start('2x2'); r.currentSeat = 0;
    r = action(r, { type: 'raise' }); const deadline = r.deadline;
    r = action(r, { type: 'respond', answer: 'run' }, 1000, 1);
    assert.deepEqual(r.scores, [0, 0]); assert.equal(r.pending!.proposed, 5);
    assert.equal(r.deadline, deadline); assert.equal(playerView(r, 'p1', 1000).legal.respond, false);
    assert.equal(playerView(r, 'p3', 1000).legal.respond, true);
    assert.throws(() => action(r, { type: 'respond', answer: 'run' }, 1200, 1));
    r = action(r, { type: 'respond', answer }, 2000, 3);
    if (answer === 'run') { assert.deepEqual(r.scores, [3, 0]); assert.equal(r.handNumber, 2); }
    else { assert.deepEqual(r.scores, [0, 0]); assert.equal(r.stake, 5); assert.equal(r.pending?.proposed ?? null, answer === 'raise' ? 7 : null); }
  }
});

test('doubles eleven only runs with both partners; one play vote starts at five', () => {
  for (const answer of ['play', 'run']) {
    let r = eleven('2x2');
    r = action(r, { type: 'eleven', answer: 'run' }, 1000, 0);
    assert.deepEqual(r.scores, [11, 0]); assert.equal(r.handNumber, 2);
    assert.equal(playerView(r, 'p0', 1000).legal.eleven, false);
    assert.equal(playerView(r, 'p2', 1000).legal.eleven, true);
    assert.throws(() => action(r, { type: 'eleven', answer: 'play' }, 1001, 0));
    r = action(r, { type: 'eleven', answer }, 2000, 2);
    if (answer === 'play') { assert.equal(r.stake, 5); assert.equal(r.handNumber, 2); assert.equal(playerView(r, 'p0', 2000).eleven.deciding, false); }
    else { assert.deepEqual(r.scores, [11, 3]); assert.equal(r.handNumber, 3); }
  }
});

test('room chat is bounded, validates text, preserves turn revision and never trusts a supplied author', () => {
  let r = start('2x2'); const revision = r.revision, deadline = r.deadline;
  r = action(r, { type: 'chat', text: ' Oi\nmesa ', playerId: 'p1', name: 'Outro' }, 1000, 0);
  assert.equal(r.chat![0].text, 'Oi mesa'); assert.equal(r.chat![0].name, 'Pessoa 0');
  assert.equal(r.chat![0].playerId, 'p0'); assert.equal(r.revision, revision); assert.equal(r.deadline, deadline);
  assert.equal(playerView(r, 'p3', 1000).chat[0].text, 'Oi mesa');
  assert.deepEqual(playerView(r, 'outsider', 1000).chat, []);
  assert.throws(() => action(r, { type: 'chat', text: 'spam' }, 1500, 0));
  assert.throws(() => action(r, { type: 'chat', text: 'x'.repeat(241) }, 3000, 0));
  assert.throws(() => action(r, { type: 'chat', text: '  ' }, 3000, 0));
  for (let i = 1; i <= 55; i++) r = action(r, { type: 'chat', text: `Mensagem ${i}` }, 1000 + i * 1001, 0);
  assert.equal(r.chat!.length, 50); assert.equal(r.chat!.at(-1)!.text, 'Mensagem 55');
  assert.equal(r.socialRevision, 56); assert.equal(r.revision, revision);
});

test('signals are visible to the whole table, expire, reject spam and exclude outsiders', () => {
  let r = start('2x2'); const revision = r.revision;
  r = action(r, { type: 'signal', kind: 'zap', team: 1 }, 1000, 0);
  const signal = r.signals![0];
  assert.equal(signal.team, 0); assert.equal(signal.playerId, 'p0'); assert.equal(r.revision, revision);
  assert.deepEqual(playerView(r, 'p2', 1001).signals, [signal]);
  assert.deepEqual(playerView(r, 'p1', 1001).signals, [signal]); assert.deepEqual(playerView(r, 'p3', 1001).signals, [signal]);
  assert.deepEqual(playerView(r, 'outsider', 1001).signals, []);
  assert.equal(JSON.stringify(playerView(r, 'p1', 1001)).includes(signal.id), true);
  assert.deepEqual(playerView(r, 'p2', 1999).signals, [signal]);
  assert.deepEqual(playerView(r, 'p2', 2000).signals, []);
  assert.throws(() => action(r, { type: 'signal', kind: 'weak' }, 2000, 0));
  assert.throws(() => action(r, { type: 'signal', kind: 'unknown' }, 4000, 0));
  assert.throws(() => action(start(), { type: 'signal', kind: 'zap' }, 1000, 0));
});

test('house score steps for ordinary and truco wins, including victory after eleven', () => {
  for (const [previous, ordinary, raised] of [[0, 3, 5], [3, 5, 7], [5, 7, 11], [7, 9, 11], [9, 11, 12], [11, 12, 12]]) {
    for (const [amount, expected] of [[3, ordinary], [5, raised]]) {
      let r = start(); r.scores = [previous, 0]; r.currentSeat = 1; r.stake = amount;
      r = winHand(r);
      assert.equal(r.scores[0], Math.min(11, expected));
      assert.equal(r.status, expected > 11 ? 'finished' : 'playing');
    }
  }
});

test('higher raises advance score steps instead of adding displayed tentos', () => {
  for (const [amount, results] of [[7, [7, 9, 11, 12, 12, 12]], [9, [9, 11, 12, 12, 12, 12]], [11, [11, 12, 12, 12, 12, 12]]] as const) {
    [0, 3, 5, 7, 9, 11].forEach((previous, i) => {
      let r = start(); r.scores = [previous, 0]; r.currentSeat = 1; r.stake = amount;
      r = winHand(r); assert.equal(r.scores[0], Math.min(11, results[i]));
      assert.equal(r.status, results[i] > 11 ? 'finished' : 'playing');
    });
  }
});

test('eleven freezes play, accepts either partner once, starts at five and hides partners after decision', () => {
  let r = eleven('2x2');
  const before = playerView(r, 'p0', 0);
  assert.equal(before.legal.play, false); assert.equal(before.legal.eleven, true);
  assert.equal(before.partnerHands[0].playerId, 'p2');
  assert.deepEqual(before.partnerHands[0].cards, r.hands.p2);
  assert.equal(before.partnerHands.some((v: any) => v.playerId === 'p1' || v.playerId === 'p3'), false);
  assert.equal(playerView(r, 'outsider', 0).partnerHands.length, 0);
  assert.throws(() => action(r, { type: 'play', cardId: r.hands[`p${r.currentSeat}`][0].id }));
  assert.throws(() => action(r, { type: 'eleven', answer: 'play' }, 0, 1));
  r = action(r, { type: 'eleven', answer: 'play' }, 5000, 2);
  assert.equal(r.stake, 5); assert.equal(r.deadline, 35000);
  assert.equal(playerView(r, 'p0', 5000).eleven.deciding, false);
  assert.deepEqual(playerView(r, 'p0', 5000).partnerHands, []);
  assert.throws(() => action(r, { type: 'eleven', answer: 'run' }, 5000, 0));
});

test('refusing or timing out single eleven pays three; 11–11 forces both sides to play', () => {
  const refused = action(eleven(), { type: 'eleven', answer: 'run' }, 0, 0);
  assert.deepEqual(refused.scores, [11, 3]); assert.equal(refused.handNumber, 3);
  const timed = reconcile(eleven(), 30000);
  assert.deepEqual(timed.scores, [11, 3]); assert.equal(timed.handNumber, 3);
  const r = eleven('2x2', 11);
  assert.equal(r.eleven!.forced, true); assert.equal(r.stake, 5);
  for (const seat of [0, 1, 2, 3]) {
    const view = playerView(r, `p${seat}`, 0);
    assert.equal(view.legal.eleven, false); assert.equal(view.legal.run, false);
    assert.equal(view.partnerHands.length, 1);
    assert.throws(() => action(r, { type: 'eleven', answer: 'run' }, 0, seat));
  }
  assert.throws(() => action(r, { type: 'run' }));
  const timeout = reconcile(r, 30000);
  assert.deepEqual(timeout.scores, [11, 11]); assert.equal(timeout.trick.length, 1);
  assert.ok(!timeout.history.at(-1)!.includes('correu'));
});

test('ongoing old 11–11 decisions are upgraded without awarding points or resetting the deadline', () => {
  const old = eleven('1x1', 11); old.eleven = { teams: [0, 1], accepted: [] }; old.stake = 3;
  const upgraded = reconcile(old, 1000);
  assert.equal(upgraded.eleven!.forced, true); assert.equal(upgraded.stake, 5);
  assert.equal(upgraded.deadline, old.deadline); assert.deepEqual(upgraded.scores, [11, 11]);
  assert.equal(playerView(upgraded, 'p0', 1000).eleven.deciding, false);
  assert.throws(() => action(upgraded, { type: 'run' }));
});

test('eleven stays at five: the side below eleven cannot raise; eleven side loses if it does', () => {
  for (const mode of ['1x1', '2x2'] as const) for (const opponent of [0, 3, 5, 7, 9]) {
    let r = action(eleven(mode, opponent), { type: 'eleven', answer: 'play' }, 0, 0);
    r.currentSeat = 1;
    assert.equal(playerView(r, 'p1', 0).legal.raise, false);
    assert.throws(() => action(r, { type: 'raise' }, 0, 1), /sem aumentos/);
    assert.equal(r.stake, 5);
    r.currentSeat = 0;
    r = action(r, { type: 'raise' });
    assert.equal(r.status, 'finished'); assert.equal(r.winner, 1);
  }
});
test('partner decisions remain visible after accept or run, expire, and stay within the team', () => {
  let r = start('2x2'); r.currentSeat = 0;
  r = action(r, { type: 'raise' }, 0, 0);
  r = action(r, { type: 'respond', answer: 'run' }, 100, 1);
  assert.equal(playerView(r, 'p3', 100).teamDecisions.at(-1).answer, 'run');
  assert.deepEqual(playerView(r, 'p0', 100).teamDecisions, []);
  assert.deepEqual(playerView(r, 'outsider', 100).teamDecisions, []);
  r = action(r, { type: 'respond', answer: 'accept' }, 200, 3);
  assert.equal(r.pending, null);
  assert.equal(playerView(r, 'p1', 200).teamDecisions.at(-1).answer, 'accept');
  assert.deepEqual(playerView(r, 'p1', 8200).teamDecisions, []);
  r = eleven('2x2');
  r = action(r, { type: 'eleven', answer: 'play' }, 100, 2);
  assert.equal(playerView(r, 'p0', 100).teamDecisions.at(-1).answer, 'play');
});
test('40 unique cards, fixed manilhas and ordinary rank ordering', () => {
  assert.equal(makeDeck().length, 40); assert.equal(new Set(makeDeck().map(c => c.id)).size, 40);
  const order = [card('3'), card('7'), card('A', 'spades'), card('7', 'hearts'), card('4', 'clubs')];
  for (let i = 1; i < order.length; i++) assert.ok(cardStrength(order[i]) > cardStrength(order[i - 1]));
});
test('lobby validates occupancy, readiness and names; starts only full', () => {
  let r = createRoom('X', '2x2');
  r = applyCommand(r, 'a', { type: 'join', name: ' Ana ' }, 0);
  assert.equal(r.players[0].name, 'Ana');
  assert.throws(() => applyCommand(r, 'b', { type: 'join', name: ' ' }, 0));
  r = applyCommand(r, 'b', { type: 'join', name: 'B' }, 0);
  assert.throws(() => applyCommand(r, 'a', { type: 'seat', seat: 1 }, 0));
  r = applyCommand(r, 'a', { type: 'ready' }, 0);
  assert.equal(r.status, 'waiting');
  const game = start('2x2'); assert.equal(game.status, 'playing');
  assert.deepEqual(Object.values(game.hands).map(h => h.length), [3, 3, 3, 3]);
  assert.equal(new Set(Object.values(game.hands).flat().map(c => c.id)).size, 12);
});
test('raises alternate, pause play, counter accepts previous, refusal pays the previously accepted value', () => {
  let r = start(); const originalSeat = r.currentSeat; const firstTeam = originalSeat % 2;
  r = action(r, { type: 'raise' }); assert.equal(r.pending!.proposed, 5);
  assert.throws(() => action(r, { type: 'play', cardId: r.hands[`p${originalSeat}`][0].id }));
  r = action(r, { type: 'respond', answer: 'raise' }, 100, 1 - originalSeat);
  assert.equal(r.stake, 5); assert.equal(r.pending!.proposed, 7);
  r = action(r, { type: 'respond', answer: 'run' }, 200, originalSeat);
  assert.equal(r.scores[1 - firstTeam], 5); assert.equal(r.stake, 3);
  r = action(r, { type: 'raise' }); const raisingSeat = r.currentSeat;
  r = action(r, { type: 'respond', answer: 'accept' }, 1000, 1 - raisingSeat);
  assert.equal(r.currentSeat, raisingSeat); assert.equal(r.deadline, 31000);
  assert.throws(() => action(r, { type: 'raise' }));
});
test('ordinary run pays three and rotates dealer', () => {
  let r = start(); const d = r.dealer; const losing = r.currentSeat % 2;
  r = action(r, { type: 'run' }); assert.equal(r.scores[1 - losing], 3);
  assert.equal(r.dealer, (d + 1) % 2); assert.equal(r.handNumber, 2);
});
test('first draw then decisive result wins hand', () => {
  let r = start(); setHands(r, [[card('4'), card('3'), card('6')], [card('4', 'hearts'), card('5'), card('6', 'hearts')]]);
  r = trick(r, [card('4'), card('4', 'hearts')]); assert.deepEqual(r.trickResults, [null]); assert.equal(r.currentSeat, 0);
  r = trick(r, [card('3'), card('5')]); assert.equal(r.scores[0], 3); assert.equal(r.handNumber, 2);
});
test('first win then draw wins hand, split then draw favors first winner', () => {
  let r = start(); setHands(r, [[card('3'), card('5'), card('6')], [card('4'), card('5', 'hearts'), card('6', 'hearts')]]);
  r = trick(r, [card('3'), card('4')]); r = trick(r, [card('5'), card('5', 'hearts')]); assert.equal(r.scores[0], 3);
  r = start(); setHands(r, [[card('3'), card('4'), card('6')], [card('4', 'hearts'), card('3', 'hearts'), card('6', 'hearts')]]);
  r = trick(r, [card('3'), card('4', 'hearts')]); r = trick(r, [card('4'), card('3', 'hearts')]);
  r = trick(r, [card('6', 'hearts'), card('6')]); assert.equal(r.scores[0], 3);
});
test('all draws score zero; enemy maximum tie draws; allied maximum earliest leads', () => {
  let r = start(); setHands(r, [[card('4'), card('5'), card('6')], [card('4', 'hearts'), card('5', 'hearts'), card('6', 'hearts')]]);
  for (const rank of ['4', '5', '6']) r = trick(r, [card(rank), card(rank, 'hearts')]);
  assert.deepEqual(r.scores, [0, 0]); assert.equal(r.handNumber, 2);
  r = start('2x2'); setHands(r, [[card('3')], [card('4')], [card('3', 'hearts')], [card('5')]]);
  r = trick(r, [card('3'), card('4'), card('3', 'hearts'), card('5')]); assert.equal(r.currentSeat, 0); assert.deepEqual(r.trickResults, [0]);
  r = start('2x2'); setHands(r, [[card('3')], [card('3', 'hearts')], [card('4')], [card('5')]]);
  r = trick(r, [card('3'), card('3', 'hearts'), card('4'), card('5')]); assert.deepEqual(r.trickResults, [null]);
});
test('covered cards hidden permanently and forbidden in first trick; view contains no opponent hand', () => {
  let r = start(); const p = r.players.find(p => p.seat === r.currentSeat)!;
  assert.throws(() => action(r, { type: 'play', cardId: r.hands[p.id][0].id, covered: true }));
  r.trickNumber = 2; const hidden = r.hands[p.id][0]; r = action(r, { type: 'play', cardId: hidden.id, covered: true });
  const view = playerView(r, r.players.find(v => v.id !== p.id)!.id, 0);
  assert.equal(view.trick[0].card, null); assert.equal('hands' in view, false);
  assert.equal(JSON.stringify(view).includes(hidden.id), false);
  assert.equal(view.history.some((s: string) => s.includes(hidden.id)), false);
});
test('timeouts auto lowest open card and pending expiry pays only the ordinary hand', () => {
  let r = start(); const seat = r.currentSeat;
  r.hands[`p${seat}`] = [card('3'), card('4'), card('2')]; r.players.forEach(p => p.lastSeen = 100_000);
  r = reconcile(r, 30_000); assert.equal(r.trick[0].card!.id, card('4').id); assert.equal(r.deadline, 60_000);
  r = start(); r = action(r, { type: 'raise' }); const bidder = r.pending!.team;
  r = reconcile(r, 30_000); assert.equal(r.scores[bidder], 3);
});
test('reconciliation orders events, handles simultaneous absence, preserves terminal state', () => {
  let r = start(); r.players[0].lastSeen = -80_000; r.players[1].lastSeen = 0;
  r = reconcile(r, 100_000); assert.equal(r.status, 'finished'); assert.equal(r.winner, 1); assert.equal(r.trick.length, 0);
  assert.deepEqual(reconcile(r, 999999), r);
  r = reconcile(start(), 90_000); assert.equal(r.status, 'cancelled');
  const waiting = createRoom('X', '1x1'); assert.deepEqual(reconcile(waiting, 999999), waiting);
});
test('passing eleven ends match, unanimous rematch resets scores, commands preserve input', () => {
  const original = start(); original.scores = [9, 9]; original.stake = 5; const serialized = JSON.stringify(original);
  let r = winHand(original); assert.equal(JSON.stringify(original), serialized); assert.equal(r.status, 'finished');
  const previousDealer = r.dealer;
  r = applyCommand(r, 'p0', { type: 'rematch' }, 1); assert.equal(r.status, 'finished');
  r = applyCommand(r, 'p1', { type: 'rematch' }, 2); assert.equal(r.status, 'playing'); assert.deepEqual(r.scores, [0, 0]);
  assert.equal(r.dealer, (previousDealer + 1) % 2);
});
test('full raise ladder caps at eleven and either opposing teammate can respond', () => {
  let r = start('2x2'); r.currentSeat = 0;
  r = action(r, { type: 'raise' });
  assert.throws(() => action(r, { type: 'respond', answer: 'accept' }, 0, 2));
  r = action(r, { type: 'respond', answer: 'raise' }, 0, 3); assert.equal(r.pending!.proposed, 7);
  r = action(r, { type: 'respond', answer: 'raise' }, 0, 2); assert.equal(r.pending!.proposed, 9);
  r = action(r, { type: 'respond', answer: 'raise' }, 0, 1); assert.equal(r.pending!.proposed, 11);
  assert.throws(() => action(r, { type: 'respond', answer: 'raise' }, 0, 0));
  r = action(r, { type: 'respond', answer: 'accept' }, 0, 0); assert.equal(r.stake, 11);
  assert.equal(r.currentSeat, 0); assert.equal(playerView(r, 'p0', 0).legal.raise, false);
  r = action(r, { type: 'run' }); assert.equal(r.scores[1], 0);
  r = action(r, { type: 'run-response', answer: 'run' }, 0, 2); assert.equal(r.status, 'playing'); assert.equal(r.scores[1], 11);
});
test('covered manilha loses to an open ordinary card and does not leak in history', () => {
  let r = start(); r.trickNumber = 2; r.trickResults = [1];
  setHands(r, [[card('4', 'clubs')], [card('4')]]);
  r = action(r, { type: 'play', cardId: '4-clubs', covered: true });
  r = action(r, { type: 'play', cardId: '4-diamonds' });
  r = reconcile(r, 2500);
  assert.equal(r.scores[1], 3);
  assert.equal(r.history.some(s => s.includes('4 de clubs')), false);
});
test('absence grace resets when final player readies and reconnect preserves identity', () => {
  let r = createRoom('X', '1x1');
  r = applyCommand(r, 'a', { type: 'join', name: 'A' }, 0);
  r = applyCommand(r, 'b', { type: 'join', name: 'B' }, 0);
  r = applyCommand(r, 'a', { type: 'ready' }, 0);
  r = applyCommand(r, 'b', { type: 'ready' }, 200_000);
  assert.ok(r.players.every(p => p.lastSeen === 200_000));
  const joined = applyCommand(r, 'a', { type: 'join', name: 'Changed' }, 210_000);
  assert.equal(joined.players.length, 2); assert.equal(joined.players[0].name, 'A');
  assert.equal(reconcile(r, 200_001).status, 'playing');
});
test('1x1 retains both played cards for 2500ms and blocks commands until collection', () => {
  let r = start(); setHands(r, [[card('3'), card('5')], [card('4'), card('6')]]);
  r = action(r, { type: 'play', cardId: '3-diamonds' }, 100);
  assert.equal(r.trick.length, 1); assert.equal(playerView(r, 'p0', 100).collecting, false);
  r = action(r, { type: 'play', cardId: '4-diamonds' }, 200);
  assert.equal(r.trick.length, 2); assert.equal(r.deadline, 2700);
  const view = playerView(r, 'p0', 200);
  assert.equal(view.collecting, true); assert.equal(view.tableUntil, 2700);
  assert.deepEqual(view.legal, { play: false, cover: false, runResponse: false, cap: false, eleven: false, raise: false, respond: false, run: false });
  for (const command of [{ type: 'play', cardId: '5-diamonds' }, { type: 'raise' }, { type: 'run' }, { type: 'respond', answer: 'accept' }]) {
    assert.throws(() => action(r, command, 201));
  }
  assert.equal(reconcile(r, 2699).trick.length, 2);
  assert.deepEqual(r.trickResults, []);
  r = reconcile(r, 2700);
  assert.equal(r.trick.length, 0); assert.deepEqual(r.trickResults, [0]);
  assert.equal(r.currentSeat, 0); assert.equal(r.deadline, 32700);
  assert.equal(playerView(r, 'p0', 2700).collecting, false);
});
test('2x2 exposes plays one through four and delays hand points and deal until collection', () => {
  let r = start('2x2'); setHands(r, [[card('3')], [card('4')], [card('5')], [card('6')]]);
  r.trickResults = [0]; r.trickNumber = 2;
  const ids = ['3-diamonds', '4-diamonds', '5-diamonds', '6-diamonds'];
  for (let i = 0; i < 4; i++) {
    r = action(r, { type: 'play', cardId: ids[i] }, 1000);
    assert.equal(playerView(r, 'p3', 1000).trick.length, i + 1);
  }
  assert.deepEqual(r.scores, [0, 0]); assert.equal(r.handNumber, 1);
  assert.equal(reconcile(r, 3499).trick.length, 4);
  r = reconcile(r, 3500);
  assert.deepEqual(r.scores, [3, 0]); assert.equal(r.handNumber, 2);
  assert.equal(r.handStartedAt, 3500); assert.equal(r.deadline, 33500);
  assert.equal(r.trick.length, 0);
});
test('automatic play, collection and following timeout are processed in chronological order', () => {
  let r = start(); setHands(r, [[card('3'), card('5')], [card('4'), card('6')]]);
  r.players.forEach(p => p.lastSeen = 100_000);
  r = reconcile(r, 60000);
  assert.equal(r.trick.length, 2); assert.equal(r.transition!.until, 62500);
  r = reconcile(r, 62499); assert.equal(r.trick.length, 2);
  r = reconcile(r, 92500);
  assert.deepEqual(r.trickResults, [0]); assert.equal(r.trickNumber, 2);
  assert.equal(r.trick.length, 1); assert.equal(r.trick[0].seat, 0);
  assert.equal(r.deadline, 122500);
});
test('absence before collection cancels without awarding trick; old persisted rooms still work', () => {
  let r = start(); setHands(r, [[card('3')], [card('4')]]);
  r.trickResults = [0]; r.trickNumber = 2;
  r.players[0].lastSeen = -89_000;
  r = action(r, { type: 'play', cardId: '3-diamonds' });
  r = action(r, { type: 'play', cardId: '4-diamonds' });
  r = reconcile(r, 2500);
  assert.equal(r.status, 'finished'); assert.equal(r.winner, 1);
  assert.deepEqual(r.scores, [0, 0]);
  const old = start(); delete old.transition; delete old.handStartedAt;
  const view = playerView(old, 'p0', 0);
  assert.equal(view.collecting, false); assert.equal(view.tableUntil, null); assert.equal(view.handStartedAt, 0);
  assert.equal(reconcile(old, 30000).trick.length, 1);
});
test('match winner remains unset until completed final trick has been visible for 2500ms', () => {
  let r = start(); setHands(r, [[card('3')], [card('4')]]);
  r.scores = [11, 11]; r.trickResults = [0]; r.trickNumber = 2;
  r = action(r, { type: 'play', cardId: '3-diamonds' }, 100);
  r = action(r, { type: 'play', cardId: '4-diamonds' }, 200);
  r = reconcile(r, 2699);
  assert.equal(r.status, 'playing'); assert.equal(r.winner, null); assert.deepEqual(r.scores, [11, 11]);
  r = reconcile(r, 2700);
  assert.equal(r.status, 'finished'); assert.equal(r.winner, 0); assert.deepEqual(r.scores, [11, 11]);
  assert.equal(r.trick.length, 2); assert.equal(r.transition, null); assert.equal(r.deadline, null);
});
test('1x1 keeps previous and current tricks on table until new hand is dealt', () => {
  let r = start(); setHands(r, [[card('3'), card('5'), card('6')], [card('4'), card('3', 'hearts'), card('6', 'hearts')]]);
  r = trick(r, [card('3'), card('4')]);
  assert.equal(playerView(r, 'p0', 2500).tableTricks.flatMap((t: any) => t.plays).length, 2);
  r = action(r, { type: 'play', cardId: '5-diamonds' }, 2500);
  assert.equal(playerView(r, 'p1', 2500).tableTricks.flatMap((t: any) => t.plays).length, 3);
  r = action(r, { type: 'play', cardId: '3-hearts' }, 2500);
  assert.equal(playerView(r, 'p0', 2500).collectingWinner, 1);
  r = reconcile(r, 5000);
  assert.equal(playerView(r, 'p0', 5000).tableTricks.flatMap((t: any) => t.plays).length, 4);
  r = action(r, { type: 'play', cardId: '6-hearts', covered: true }, 5000);
  assert.equal(playerView(r, 'p0', 5000).tableTricks[2].plays[0].card, null);
  r = action(r, { type: 'play', cardId: '6-diamonds' }, 5000);
  assert.equal(playerView(r, 'p0', 5000).tableTricks.flatMap((t: any) => t.plays).length, 6);
  r = reconcile(r, 7500);
  assert.equal(r.handNumber, 2); assert.deepEqual(playerView(r, 'p0', 7500).tableTricks, []);
});
test('2x2 preserves all twelve played cards through final collection and game finish without duplication', () => {
  let r = start('2x2'); r.scores = [11, 11];
  setHands(r, [
    [card('3'), card('4'), card('5')], [card('4', 'hearts'), card('3', 'hearts'), card('5', 'hearts')],
    [card('5', 'spades'), card('6', 'spades'), card('6')], [card('6', 'hearts'), card('7', 'spades'), card('6', 'diamonds')],
  ]);
  // Give the fourth player a unique equal-rank card for the third-vaza draw.
  r.hands.p3[2] = card('6', 'clubs');
  r = trick(r, [card('3'), card('4', 'hearts'), card('5', 'spades'), card('6', 'hearts')]);
  assert.equal(playerView(r, 'p0', 2500).tableTricks.flatMap((t: any) => t.plays).length, 4);
  r = trick(r, [card('4'), card('3', 'hearts'), card('6', 'spades'), card('7', 'spades')]);
  assert.equal(playerView(r, 'p0', 5000).tableTricks.flatMap((t: any) => t.plays).length, 8);
  for (const c of [card('5', 'hearts'), card('6'), card('6', 'clubs'), card('5')]) {
    r = action(r, { type: 'play', cardId: c.id }, 5000);
  }
  assert.equal(playerView(r, 'p0', 5000).tableTricks.flatMap((t: any) => t.plays).length, 12);
  r = reconcile(r, 7500);
  assert.equal(r.status, 'finished');
  const table = playerView(r, 'p0', 7500).tableTricks;
  assert.equal(table.length, 3); assert.equal(table.flatMap((t: any) => t.plays).length, 12);
});


test('legacy score values are normalized to house steps without changing a recorded winner', () => {
  const r = start(); r.scores = [14, 8]; r.status = 'finished'; r.winner = 0;
  const fixed = reconcile(r, 100);
  assert.deepEqual(fixed.scores, [11, 7]); assert.equal(fixed.winner, 0);
});

test('running or timing out a counterraise pays the previously accepted value; played accepted truco pays five', () => {
  for (const mode of ['1x1', '2x2'] as const) {
    let r = start(mode); r.currentSeat = 0;
    r = action(r, { type: 'raise' });
    r = action(r, { type: 'respond', answer: 'raise' }, 0, 1);
    const pending = r;
    r = action(r, { type: 'respond', answer: 'run' }, 0, 0);
    if (mode === '2x2') r = action(r, { type: 'respond', answer: 'run' }, 0, 2);
    assert.deepEqual(r.scores, [0, 5]);
    assert.deepEqual(reconcile(pending, 30000).scores, [0, 5]);
  }
  for (const winner of [0, 1]) {
    let r = start(); r.currentSeat = 0;
    r = action(r, { type: 'raise' }); r = action(r, { type: 'respond', answer: 'accept' }, 0, 1);
    setHands(r, winner === 0 ? [[card('3')], [card('4')]] : [[card('4')], [card('3')]]);
    r.trickNumber = 2; r.trickResults = [winner];
    r = trick(r, winner === 0 ? [card('3'), card('4')] : [card('4'), card('3')]);
    assert.equal(r.scores[winner], 5);
  }
});

test('resolved eleven and truco decisions announce to both sides before the next deal', () => {
  for (const special of [true, false]) {
    let r = special ? eleven() : start(); r.currentSeat = 0;
    if (!special) r = action(r, { type: 'raise' });
    const responder = special ? 0 : 1;
    const refused = action(r, { type: special ? 'eleven' : 'respond', answer: 'run' }, 100, responder);
    for (const id of ['p0', 'p1']) {
      assert.equal(playerView(refused, id, 100).handNotice.decision, 'run');
      assert.equal(playerView(refused, id, 100).legal.play, false);
      assert.equal(playerView(refused, id, 1900).handNotice, null);
    }
    assert.equal(refused.handStartedAt, 1900);
    assert.equal(refused.deadline, 31900);
    const accepted = action(r, { type: special ? 'eleven' : 'respond', answer: special ? 'play' : 'accept' }, 100, responder);
    assert.equal(playerView(accepted, 'p0', 100).handNotice.decision, 'play');
    assert.equal(playerView(accepted, 'p1', 100).handNotice.decision, 'play');
    assert.equal(accepted.handNumber, r.handNumber);
  }
});

test('host fills only empty seats with bots while human readiness remains required', () => {
  let r = createRoom('FILL', '2x2');
  for (let i = 0; i < 3; i++) r = applyCommand(r, `h${i}`, { type: 'join', name: `Humano ${i}` }, 0);
  assert.throws(() => applyCommand(r, 'h1', { type: 'fill-bots' }, 0));
  r = applyCommand(r, 'h0', { type: 'fill-bots' }, 0);
  assert.equal(r.players.length, 4); assert.equal(r.players.filter(p => p.isBot).length, 1);
  assert.equal(r.players[3].seat, 3); assert.equal(r.players[3].ready, true); assert.equal(r.status, 'waiting');
  for (let i = 0; i < 3; i++) r = applyCommand(r, `h${i}`, { type: 'ready' }, 0);
  assert.equal(r.status, 'playing'); assert.equal(playerView(r, 'h0', 0).hand.length, 3);
  assert.throws(() => applyCommand(r, 'h0', { type: 'fill-bots' }, 0));
});

test('only the team at eleven can inspect partner cards; both can at eleven-eleven', () => {
  for (const scores of [[11, 0], [3, 11], [11, 11]]) {
    const r = start('2x2'); r.scores = scores;
    r.eleven = { teams: [0, 1].filter(t => scores[t] === 11), accepted: [], forced: scores.every(s => s === 11) };
    if (r.eleven.forced) r.eleven.accepted = [0, 1];
    for (const p of r.players) {
      const partners = playerView(r, p.id, 0).partnerHands;
      assert.equal(partners.length, scores[p.seat % 2] === 11 ? 1 : 0);
      if (partners.length) assert.equal(partners[0].playerId, r.players.find(v => v.seat === (p.seat + 2) % 4)!.id);
    }
    assert.deepEqual(playerView(r, 'outsider', 0).partnerHands, []);
  }
});


test('normal doubles run pauses for partner, play vetoes, consent pays accepted stake, silence continues', () => {
  let r = start('2x2'); r.currentSeat = 0; r.stake = 7;
  const requested = action(r, { type: 'run' }, 100);
  assert.equal(requested.runRequest!.by, 'p0'); assert.deepEqual(requested.scores, [0,0]);
  assert.equal(playerView(requested, 'p2', 100).legal.runResponse, true);
  assert.equal(playerView(requested, 'p0', 100).legal.play, false);
  assert.throws(() => action(requested, { type: 'run-response', answer: 'run' }, 100, 1));
  assert.throws(() => action(requested, { type: 'play', cardId: r.hands.p0[0].id }, 100));
  const kept = action(requested, { type: 'run-response', answer: 'play' }, 200, 2);
  assert.equal(kept.runRequest, null); assert.equal(kept.currentSeat, 0); assert.equal(kept.deadline,30200);
  const folded = action(requested, { type: 'run-response', answer: 'run' }, 200, 2);
  assert.deepEqual(folded.scores, [0,7]); assert.equal(folded.handNumber,2);
  const expired = reconcile(requested,30100); assert.equal(expired.runRequest,null); assert.deepEqual(expired.scores,[0,0]);
});

test('refusing each raise pays exactly the accepted bid, and an accepted truco run pays five', () => {
  for (let level=0;level<4;level++) {
    let r=start();r.currentSeat=0;r=action(r,{type:'raise'});
    for(let i=0;i<level;i++) r=action(r,{type:'respond',answer:'raise'},100,1-r.pending!.team);
    const winner=r.pending!.team;const amount=[3,5,7,9][level];
    const folded=action(r,{type:'respond',answer:'run'},200,1-winner);
    assert.equal(folded.scores[winner],amount);
    assert.equal(reconcile(r,30100).scores[winner],amount);
  }
  let r=start();r.currentSeat=0;r=action(r,{type:'raise'});r=action(r,{type:'respond',answer:'accept'},100,1);
  r=action(r,{type:'run'},200,0);assert.deepEqual(r.scores,[0,5]);
});

test('cap only at eleven-three during decision forces five without revealing opposing hands', () => {
  let r=eleven('2x2',3);
  assert.equal(playerView(r,'p1',0).legal.cap,true);
  assert.equal(playerView(r,'p0',0).legal.cap,false);
  assert.throws(()=>action(r,{type:'cap'},0,0));
  const capped=action(r,{type:'cap'},100,3);
  assert.equal(capped.stake,5);assert.equal(capped.eleven!.forced,true);
  assert.equal(playerView(capped,'p0',100).eleven.deciding,false);
  assert.equal(playerView(capped,'p1',100).partnerHands.length,0);
  assert.equal(playerView(capped,'p0',100).partnerHands.length,0);
  capped.currentSeat=0;assert.throws(()=>action(capped,{type:'run'},100));
  assert.throws(()=>action(eleven('2x2',5),{type:'cap'},0,1));
});

test('spectators have no private cards, seats and kicks require lobby, host transfers on leave', () => {
  let r=createRoom('watch-room','2x2');
  for(let i=0;i<4;i++) r=applyCommand(r,`p${i}`,{type:'join',name:`Pessoa ${i}`},0);
  r=applyCommand(r,'viewer',{type:'watch',name:'Visitante'},0);
  assert.equal(r.spectators!.length,1);assert.equal(playerView(r,'viewer',0).hand.length,0);
  assert.throws(()=>applyCommand(r,'p1',{type:'kick',targetId:'p2'},0));
  r=applyCommand(r,'p0',{type:'kick',targetId:'p2'},0);
  assert.throws(()=>applyCommand(r,'p2',{type:'join',name:'Retorno'},0));
  r=applyCommand(r,'viewer',{type:'seat',seat:2},0);
  assert.equal(r.players.find(p=>p.id==='viewer')!.seat,2);assert.equal(r.spectators!.length,0);
  r=applyCommand(r,'p1',{type:'watch'},0);assert.equal(r.players.length,3);
  r=applyCommand(r,'p1',{type:'join',name:'Pessoa 1'},0);
  for(const p of r.players) r=applyCommand(r,p.id,{type:'ready'},0);
  r=applyCommand(r,'viewer2',{type:'watch',name:'Visitante 2'},1);
  const view=playerView(r,'viewer2',1);
  assert.deepEqual(view.hand,[]);assert.deepEqual(view.partnerHands,[]);assert.deepEqual(view.teamDecisions,[]);
  assert.ok(Object.values(view.legal).every(v=>!v));assert.equal('hands' in view,false);
  for(const cmd of [{type:'ready'},{type:'raise'},{type:'rematch'},{type:'signal',kind:'zap'},{type:'seat',seat:0}]) assert.throws(()=>applyCommand(r,'viewer2',cmd,1));
  assert.throws(()=>applyCommand(r,'p0',{type:'watch'},1));
  assert.throws(()=>applyCommand(r,'p0',{type:'kick',targetId:'p1'},1));
  r=applyCommand(r,'viewer2',{type:'chat',text:'Boa partida!'},2);assert.equal(playerView(r,'p0',2).chat[0].name,'Visitante 2');
  r=applyCommand(r,'viewer2',{type:'leave'},2);assert.equal(r.spectators!.length,0);
  let lobby=createRoom('host-transfer','1x1');lobby=applyCommand(lobby,'a',{type:'join',name:'Ana'},0);lobby=applyCommand(lobby,'b',{type:'join',name:'Bia'},0);
  lobby=applyCommand(lobby,'a',{type:'leave'},0);assert.equal(lobby.hostId,'b');
});

test('manual custom scores can be pulled during any phase, preserve totals, never end on a hand win and require every player vote',()=>{
  let r=start();r.custom={config:defaultCustomConfig(),scoreMode:'manual'};
  r=applyCommand(r,'p0',{type:'pull',amount:11},100);r=applyCommand(r,'p0',{type:'pull',amount:5},1200);
  assert.deepEqual(r.scores,[16,0]);assert.equal(reconcile(r,1201).scores[0],16);assert.equal(r.status,'playing');
  assert.throws(()=>applyCommand(r,'p0',{type:'pull',amount:1},1300));
  r=applyCommand(r,'p0',{type:'pull',amount:-5},2300);assert.equal(r.scores[0],11);
  r=applyCommand(r,'p1',{type:'pull',amount:3},2400);assert.deepEqual(r.scores,[11,3]);
  r.currentSeat=0;r.stake=11;r=winHand(r);
  assert.deepEqual(r.scores,[11,3]);assert.equal(r.status,'playing');assert.equal(r.eleven!.teams[0],0);
  r=applyCommand(r,'p1',{type:'cap'},3000);assert.equal(r.stake,5);assert.equal(r.eleven!.forced,true);
  const before=r.revision;r=applyCommand(r,'p0',{type:'finish-vote'},3100);assert.equal(r.status,'playing');assert.deepEqual(r.finishVotes,['p0']);
  r=applyCommand(r,'p0',{type:'finish-vote'},3200);assert.deepEqual(r.finishVotes,[]);
  r=applyCommand(r,'p0',{type:'finish-vote'},3300);r=applyCommand(r,'p1',{type:'finish-vote'},3400);assert.equal(r.status,'finished');assert.equal(r.winner,0);assert.ok(r.revision>before);
});

test('manual scores only affect own team; normal rooms and spectators cannot pull or vote',()=>{
  const regular=start('2x2');assert.throws(()=>applyCommand(regular,'p0',{type:'pull',amount:3},100));assert.throws(()=>applyCommand(regular,'p0',{type:'finish-vote'},100));
  let r=structuredClone(regular);r.custom={config:defaultCustomConfig(),scoreMode:'manual'};
  r=applyCommand(r,'p2',{type:'pull',amount:7,team:1},100);assert.deepEqual(r.scores,[7,0]);
  for(const amount of [0,12,-8,1.5,'3'])assert.throws(()=>applyCommand(r,'p0',{type:'pull',amount},2000));
  r=applyCommand(r,'viewer',{type:'watch',name:'Visitante'},1000);assert.throws(()=>applyCommand(r,'viewer',{type:'pull',amount:3},2000));assert.throws(()=>applyCommand(r,'viewer',{type:'finish-vote'},2000));
  r.transition={until:6000,winner:0,nextSeat:0};r.pending={team:1,proposed:5,resumeSeat:0};
  r=applyCommand(r,'p0',{type:'pull',amount:1},2000);assert.equal(r.scores[0],8);assert.equal(r.transition!.until,6000);assert.ok(r.pending);
});

test('manual custom mode keeps eleven-eleven and illegal truco from ending before unanimous consent',()=>{
  let r=start();r.custom={config:defaultCustomConfig(),scoreMode:'manual'};r.scores=[11,11];r.currentSeat=0;
  r=applyCommand(r,'p0',{type:'raise'},100);assert.equal(r.status,'playing');assert.deepEqual(r.scores,[11,11]);assert.equal(r.eleven!.forced,true);
  r.currentSeat=0;r=winHand(r);assert.equal(r.status,'playing');assert.deepEqual(r.scores,[11,11]);
  r=applyCommand(r,'p0',{type:'finish-vote'},1000);r=applyCommand(r,'p1',{type:'finish-vote'},1000);assert.equal(r.status,'finished');assert.equal(r.winner,null);
});
