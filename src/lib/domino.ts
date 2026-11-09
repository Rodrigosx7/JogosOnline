import { randomInt, randomUUID } from 'node:crypto';
import type { Player } from './game';
import type { ChatMessage } from './social';

export type Stone = { id: string; a: number; b: number };
export type End = 'left' | 'right';
export type DominoCommand =
  | { type: 'join'; name: string }
  | { type: 'seat'; seat: number }
  | { type: 'ready' | 'fill-bots' | 'pass' | 'rematch' }
  | { type: 'play'; stoneId: string; end: End }
  | { type: 'chat'; text: string };
export type Domino = {
  game: 'domino'; rules: 'duplas-100-v1'; mode: '2x2'; code: string; listed: boolean;
  status: 'waiting' | 'playing' | 'between' | 'finished' | 'cancelled'; revision: number;
  players: Player[]; hands: Record<string, Stone[]>; scores: number[]; winner: number | null;
  board: { id: string; left: number; right: number; seat: number }[];
  handNumber: number; starter: number; currentSeat: number; passes: number; deadline: number | null;
  result: { number: number; reason: 'batida' | 'tranca' | 'empate'; winner: number | null; points: number; totals: number[]; name?: string } | null;
  lastMove: string; chat: ChatMessage[]; socialRevision: number; rematchVotes: string[];
  botAction?: { key: string; at: number } | null;
};
const TURN = 30000, ABSENCE = 90000, BREAK = 4000;
function fail(text: string): never { throw new Error(text); }
const next = (seat: number) => (seat + 1) % 4;
const weight = (stone: Stone) => stone.a + stone.b;
export const dominoSet = (): Stone[] => Array.from({ length: 7 }, (_, a) =>
  Array.from({ length: 7 - a }, (_, i) => ({ id: `${a}-${a + i}`, a, b: a + i }))).flat();

export function createDomino(code: string, listed = false): Domino {
  return { game: 'domino', rules: 'duplas-100-v1', mode: '2x2', code, listed,
    status: 'waiting', revision: 0, players: [], hands: {}, scores: [0, 0], winner: null,
    board: [], handNumber: 0, starter: 0, currentSeat: 0, passes: 0, deadline: null,
    result: null, lastMove: '', chat: [], socialRevision: 0, rematchVotes: [] };
}
function start(r: Domino, now: number) {
  const deck = dominoSet();
  for (let i = deck.length - 1; i > 0; i--) { const j = randomInt(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  for (const p of r.players) r.hands[p.id] = deck.splice(0, 7);
  r.starter = r.handNumber === 0 ? r.players.find(p => r.hands[p.id].some(s => s.id === '6-6'))!.seat : next(r.starter);
  r.handNumber++; r.currentSeat = r.starter; r.board = []; r.passes = 0;
  r.deadline = now + TURN; r.status = 'playing'; r.result = null; r.botAction = null;
  r.lastMove = r.handNumber === 1 ? 'A primeira saída é com o 6–6.' : 'Nova mão. Quem saiu avança um lugar.';
}
export function dominoMoves(r: Domino, id: string) {
  return (r.hands[id] ?? []).flatMap(stone => {
    const ends: End[] = [];
    if (!r.board.length) { if (r.handNumber !== 1 || stone.id === '6-6') ends.push('right'); }
    else {
      const left = r.board[0].left, right = r.board.at(-1)!.right;
      if (stone.a === left || stone.b === left) ends.push('left');
      if (stone.a === right || stone.b === right) ends.push('right');
    }
    return ends.length ? [{ id: stone.id, ends }] : [];
  });
}
function settle(r: Domino, now: number, finisher?: Player) {
  const totals = [0, 0];
  for (const p of r.players) totals[p.seat % 2] += r.hands[p.id].reduce((sum, stone) => sum + weight(stone), 0);
  const winner = finisher ? finisher.seat % 2 : totals[0] === totals[1] ? null : totals[0] < totals[1] ? 0 : 1;
  const points = winner === null ? 0 : totals[1 - winner];
  r.result = { number: r.handNumber, reason: finisher ? 'batida' : winner === null ? 'empate' : 'tranca', winner, points, totals, ...(finisher ? { name: finisher.name } : {}) };
  if (winner !== null) r.scores[winner] += points;
  r.winner = winner !== null && r.scores[winner] >= 100 ? winner : null;
  r.status = r.winner === null ? 'between' : 'finished';
  r.deadline = r.status === 'between' ? now + BREAK : null;
  r.lastMove = finisher ? `${finisher.name} bateu!` : winner === null ? 'Tranca empatada: ninguém pontua.' : 'Jogo trancado. Vence a dupla com menor soma.';
}
export function applyDomino(input: Domino, id: string, command: DominoCommand, now: number): Domino {
  const r = structuredClone(input);
  const p = r.players.find(p => p.id === id);
  if (command.type === 'join') {
    if (p) return r;
    if (r.status !== 'waiting' || r.players.length === 4) fail('Sala cheia ou partida iniciada.');
    const name = command.name.trim();
    if (name.length < 2 || name.length > 24 || /[\x00-\x1f\x7f]/.test(name)) fail('Use um apelido de 2 a 24 caracteres.');
    const seat = [0, 1, 2, 3].find(seat => !r.players.some(p => p.seat === seat))!;
    r.players.push({ id, name, seat, ready: false, lastSeen: now });
  } else {
    if (!p) fail('Entre na mesa primeiro.');
    if (command.type === 'chat') {
      const text = command.text.replace(/[\x00-\x1f\x7f]/g, ' ').trim();
      if (!text || text.length > 240) fail('Escreva até 240 caracteres.');
      const last = r.chat.findLast(m => m.playerId === id);
      if (last && now - last.at < 1000) fail('Aguarde um segundo para enviar outra mensagem.');
      r.chat = [...r.chat.slice(-49), { id: randomUUID(), playerId: id, name: p.name, text, at: now }];
      r.socialRevision++; return r;
    }
    if (command.type === 'rematch') {
      if (r.status !== 'finished' && r.status !== 'cancelled') fail('A partida ainda não terminou.');
      if (!r.rematchVotes.includes(id)) r.rematchVotes.push(id);
      if (r.rematchVotes.length === 4) { r.scores = [0, 0]; r.winner = null; r.handNumber = 0; r.rematchVotes = []; r.players.forEach(p => p.lastSeen = now); start(r, now); }
    } else if (['ready', 'seat', 'fill-bots'].includes(command.type)) {
      if (r.status !== 'waiting') fail('A partida já começou.');
      if (command.type === 'fill-bots') {
        if (r.players[0].id !== id) fail('Somente o anfitrião pode completar com bots.');
        if (r.players.length === 4) fail('A mesa já está completa.');
        for (const seat of [0, 1, 2, 3]) if (!r.players.some(p => p.seat === seat))
          r.players.push({ id: randomUUID(), name: `Bot ${seat + 1}`, seat, ready: true, lastSeen: now, isBot: true });
        r.listed = false;
      } else if (command.type === 'seat') {
        if (![0, 1, 2, 3].includes(command.seat) || r.players.some(v => v.id !== id && v.seat === command.seat)) fail('Lugar indisponível.');
        p.seat = command.seat; p.ready = false;
      } else p.ready = true;
      if (r.players.length === 4 && r.players.every(p => p.ready)) { r.players.forEach(p => p.lastSeen = now); start(r, now); }
    } else {
      if (r.status !== 'playing' || p.seat !== r.currentSeat) fail('Aguarde sua vez.');
      const moves = dominoMoves(r, id);
      if (command.type === 'pass') {
        if (moves.length) fail('Você tem uma pedra que pode ser jogada.');
        r.passes++; r.lastMove = `${p.name} passou.`;
        if (r.passes === 4) settle(r, now);
        else { r.currentSeat = next(p.seat); r.deadline = now + TURN; }
      } else if (command.type === 'play') {
        if (!moves.some(move => move.id === command.stoneId && move.ends.includes(command.end))) fail('Essa pedra não encaixa nessa ponta.');
        const index = r.hands[id].findIndex(stone => stone.id === command.stoneId);
        const [stone] = r.hands[id].splice(index, 1);
        const edge = command.end === 'left' ? r.board[0]?.left : r.board.at(-1)?.right;
        const flip = edge !== undefined && (command.end === 'left' ? stone.b !== edge : stone.a !== edge);
        const placed = { id: stone.id, left: flip ? stone.b : stone.a, right: flip ? stone.a : stone.b, seat: p.seat };
        if (command.end === 'left') r.board.unshift(placed); else r.board.push(placed);
        r.passes = 0; r.lastMove = `${p.name} jogou ${stone.a}–${stone.b}.`;
        if (!r.hands[id].length) settle(r, now, p);
        else { r.currentSeat = next(p.seat); r.deadline = now + TURN; }
      } else fail('Comando inválido.');
    }
  }
  r.revision++; return r;
}
export function reconcileDomino(input: Domino, now: number): Domino {
  let r = structuredClone(input);
  while (r.status === 'playing' || r.status === 'between') {
    const absentAt = Math.min(...r.players.filter(p => !p.isBot).map(p => p.lastSeen + ABSENCE));
    const due = Math.min(absentAt, r.deadline ?? Infinity);
    if (due > now) break;
    if (due === absentAt) {
      const teams = new Set(r.players.filter(p => !p.isBot && p.lastSeen + ABSENCE === due).map(p => p.seat % 2));
      r.winner = teams.size === 1 ? 1 - [...teams][0] : null;
      r.status = teams.size === 1 ? 'finished' : 'cancelled'; r.deadline = null;
      r.lastMove = teams.size === 1 ? 'Partida encerrada por abandono.' : 'Partida cancelada: os dois lados ficaram ausentes.';
      r.revision++;
    } else if (r.status === 'between') { start(r, due); r.revision++; }
    else {
      const p = r.players.find(p => p.seat === r.currentSeat)!;
      const move = dominoMoves(r, p.id)[0];
      r = applyDomino(r, p.id, move ? { type: 'play', stoneId: move.id, end: move.ends[0] } : { type: 'pass' }, due);
    }
  }
  return r;
}
export function advanceDominoBots(input: Domino, now: number): Domino {
  let r = input;
  if ((r.status === 'finished' || r.status === 'cancelled') && r.rematchVotes.length) {
    for (const bot of r.players.filter(p => p.isBot)) if (!r.rematchVotes.includes(bot.id)) r = applyDomino(r, bot.id, { type: 'rematch' }, now);
  }
  if (r.status !== 'playing') return r;
  const bot = r.players.find(p => p.seat === r.currentSeat && p.isBot);
  if (!bot) { r.botAction = null; return r; }
  const key = `${r.revision}:${bot.id}`;
  if (r.botAction?.key !== key) { r.botAction = { key, at: now + 850 }; return r; }
  if (now < r.botAction.at) return r;
  const moves = dominoMoves(r, bot.id).sort((a, b) => weight(r.hands[bot.id].find(s => s.id === b.id)!) - weight(r.hands[bot.id].find(s => s.id === a.id)!));
  const move = moves[0];
  return applyDomino(r, bot.id, move ? { type: 'play', stoneId: move.id, end: move.ends[0] } : { type: 'pass' }, now);
}
export function dominoView(r: Domino, id: string, now: number) {
  const p = r.players.find(p => p.id === id);
  const ownTurn = !!p && r.status === 'playing' && p.seat === r.currentSeat;
  const moves = ownTurn ? dominoMoves(r, id) : [];
  return { game: r.game, rules: r.rules, code: r.code, revision: r.revision, socialRevision: r.socialRevision, status: r.status,
    playerId: id, players: r.players.map(({ id, name, seat, ready, isBot }) => ({ id, name, seat, ready, isBot: !!isBot, count: r.hands[id]?.length ?? 0 })),
    hand: p ? r.hands[id] ?? [] : [], board: r.board, scores: r.scores, winner: r.winner, handNumber: r.handNumber,
    currentSeat: r.currentSeat, deadline: r.deadline, result: r.result, lastMove: r.lastMove, chat: p ? r.chat : [],
    rematchVotes: r.rematchVotes, serverTime: now,
    legal: { moves, pass: ownTurn && moves.length === 0, ready: !!p && r.status === 'waiting' && !p.ready,
      fillBots: !!p && r.status === 'waiting' && r.players.length < 4 && r.players[0].id === id } };
}
export type DominoView = ReturnType<typeof dominoView>;
