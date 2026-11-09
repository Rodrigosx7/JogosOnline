import { randomInt, randomUUID } from 'node:crypto';
import { ELEVEN_NOTICE_MS } from './presentation';
import { SIGNAL_DURATION_MS, SIGNAL_OPTIONS, type ChatMessage, type PartnerSignal } from './social';

export type Mode = '1x1' | '2x2';
export type Player = { id: string; name: string; seat: number; ready: boolean; lastSeen: number; isBot?: boolean };
export type Card = { id: string; rank: string; suit: string };
export type Play = { seat: number; card: Card | null; covered: boolean };
export type Room = {
  code: string; mode: Mode; players: Player[]; revision: number;
  listed?: boolean;
  hostId?: string;
  tableTheme?: 'classic' | 'skol';
  spectators?: { id: string; name: string; lastSeen: number }[];
  removedIds?: string[];
  runRequest?: { id: string; team: number; by: string; resumeSeat: number } | null;
  previousHandResults?: { number: number; results: (number | null)[] } | null;
  handNotice?: { kind?: 'eleven' | 'truco'; proposed?: number; id: string; team: number; decision: 'run' | 'play'; name: string; at: number } | null;
  trucoPenalty?: { playerId: string; name: string; team: number } | null;
  status: 'waiting' | 'playing' | 'finished' | 'cancelled';
  currentSeat: number; dealer: number; stake: number;
  pending: { team: number; proposed: number; resumeSeat: number; by?: string; runVotes?: string[]; id?: string } | null;
  deadline: number | null; scores: number[]; handNumber: number; trickNumber: number;
  trick: Play[]; trickResults: (number | null)[]; history: string[];
  winner: number | null; hands: Record<string, Card[]>; rematchVotes: string[];
  lastRaiser: number | null;
  transition?: { until: number; winner: number | null; nextSeat: number } | null;
  handStartedAt?: number;
  completedTricks?: { number: number; plays: Play[]; winner: number | null }[];
  botAction?: { key: string; at: number } | null;
  eleven?: { teams: number[]; accepted: number[]; forced?: boolean; runVotes?: string[]; id?: string } | null;
  resolvedDecisions?: string[];
  teamDecisions?: { id: string; playerId: string; team: number; kind: 'truco' | 'eleven' | 'run'; answer: string; at: number }[];
  chat?: ChatMessage[];
  signals?: PartnerSignal[];
  socialRevision?: number;
  botSignalHands?: Record<string, number>;
  botAcknowledgedSignals?: Record<string, string>;
  botPendingSignalAcks?: Record<string, { id: string; at: number }>;
};
const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
const SUITS = ['clubs', 'hearts', 'spades', 'diamonds'];
const SUIT_NAMES: Record<string, string> = { clubs: 'paus', hearts: 'copas', spades: 'espadas', diamonds: 'ouros' };
const BIDS = [3, 5, 7, 9, 11];
const TURN = 30_000;
const COLLECTION = 2_500;
const ABSENCE = 90_000;
const clone = <T>(value: T): T => structuredClone(value);
function fail(message: string): never { throw new Error(message); }
const size = (r: Room) => r.mode === '1x1' ? 2 : 4;
const team = (seat: number) => seat % 2;
const next = (r: Room, seat: number) => (seat + 1) % size(r);
const atSeat = (r: Room, seat: number) => r.players.find(p => p.seat === seat)!;
const decidingEleven = (r: Room) => !!r.eleven && r.eleven.teams.some(t => !r.eleven!.accepted.includes(t));
function resolveDecision(r: Room, id?: string) { if (id) r.resolvedDecisions = [...(r.resolvedDecisions ?? []).filter(v => v !== id).slice(-7), id]; }

export function cardStrength(card: Card): number {
  const special = ['7-diamonds', 'A-spades', '7-hearts', '4-clubs'].indexOf(`${card.rank}-${card.suit}`);
  return special >= 0 ? 20 + special : RANKS.indexOf(card.rank) + 1;
}
export function makeDeck(): Card[] {
  return SUITS.flatMap(suit => RANKS.map(rank => ({ id: `${rank}-${suit}`, rank, suit })));
}
export function createRoom(code: string, mode: Mode): Room {
  if (mode !== '1x1' && mode !== '2x2') fail('Modalidade inválida.');
  return { code, mode, players: [], revision: 0, status: 'waiting', currentSeat: 0, dealer: 0,
    stake: 3, pending: null, deadline: null, scores: [0, 0], handNumber: 0, trickNumber: 1,
    trick: [], trickResults: [], history: [], winner: null, hands: {}, rematchVotes: [], lastRaiser: null,
    transition: null, handStartedAt: 0, completedTricks: [] };
}
function log(r: Room, message: string) {
  r.history.push(message);
  if (r.history.length > 100) r.history.splice(0, r.history.length - 100);
}
function startHand(r: Room, now: number, advanceDealer = false) {
  r.previousHandResults = r.handNumber > 0 ? { number: r.handNumber, results: [...r.trickResults] } : null;
  const deck = makeDeck();
  for (let i = deck.length - 1; i > 0; i--) { const j = randomInt(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  r.dealer = r.handNumber === 0 && !advanceDealer ? randomInt(size(r)) : next(r, r.dealer);
  r.handNumber++; r.hands = {};
  r.trucoPenalty = null;
  r.handStartedAt = now; r.transition = null; r.completedTricks = [];
  r.signals = [];
  r.botSignalHands = {}; r.botPendingSignalAcks = {}; r.botAcknowledgedSignals = {};
  for (const p of r.players) r.hands[p.id] = deck.splice(0, 3);
  r.stake = 3; r.pending = null; r.lastRaiser = null; r.runRequest = null;
  r.trickNumber = 1; r.trick = []; r.trickResults = [];
  r.currentSeat = next(r, r.dealer); r.deadline = now + TURN;
  r.eleven = r.scores.includes(11) ? { id: randomUUID(), teams: [team(r.currentSeat), 1 - team(r.currentSeat)].filter(t => r.scores[t] === 11), accepted: [] } : null;
  if (r.eleven && r.scores.every(score => score === 11)) { r.eleven.forced = true; r.eleven.accepted = [...r.eleven.teams]; r.stake = 5; }
  log(r, r.eleven?.forced ? `Mão ${r.handNumber}: 11 a 11. Os dois lados são obrigados a jogar por 5 tentos, sem correr.` : r.eleven ? `Mão ${r.handNumber}: mão de 11. Confira as cartas e decida jogar ou correr.` : `Mão ${r.handNumber}: vale 3 tentos.`);
}
function award(r: Room, winner: number | null, amount: number, now: number, reason: string) {
  resolveDecision(r, r.pending?.id); resolveDecision(r, r.eleven?.id);
  log(r, reason);
  let matchWon = false;
  if (winner !== null) {
    const previous = r.scores[winner];
    const steps = [0, 3, 5, 7, 9, 11];
    const current = steps.findLastIndex(score => score <= previous);
    const advance = BIDS.indexOf(amount) + 1;
    // The house has a specific jump for a truco won from five.
    matchWon = current + advance >= steps.length;
    r.scores[winner] = amount === 5 && previous === 5 ? 11 : steps[current + advance] ?? 11;
  }
  if (winner !== null && matchWon) {
    r.status = 'finished'; r.winner = winner; r.deadline = null; r.pending = null;
    log(r, `Equipe ${winner + 1} venceu a partida.`);
  } else startHand(r, now + (r.handNotice?.decision === 'run' && r.handNotice.at === now ? ELEVEN_NOTICE_MS : 0));
}
function handWinner(results: (number | null)[]): number | null | undefined {
  const [a, b, c] = results;
  if (results.length >= 2) {
    if (a === null && b !== null) return b;
    if (a !== null && (b === null || b === a)) return a;
  }
  if (results.length === 3) {
    if (c !== null) return c;
    return a ?? b ?? null;
  }
  return undefined;
}
function play(r: Room, p: Player, id: string, covered: boolean, now: number) {
  if (r.transition) fail('Aguarde o recolhimento das cartas.');
  if (r.pending) fail('Responda ao pedido antes de jogar.');
  if (r.currentSeat !== p.seat) fail('Aguarde a sua vez.');
  if (covered && r.trickNumber === 1) fail('Não é permitido cobrir na primeira vaza.');
  const hand = r.hands[p.id]; const index = hand.findIndex(c => c.id === id);
  if (index < 0) fail('Carta inválida.');
  const [card] = hand.splice(index, 1);
  r.trick.push({ seat: p.seat, card: covered ? null : card, covered });
  log(r, `${p.name} jogou ${covered ? 'carta coberta' : `${card.rank} de ${SUIT_NAMES[card.suit]}`}.`);
  if (r.trick.length < size(r)) { r.currentSeat = next(r, p.seat); r.deadline = now + TURN; return; }
  const best = Math.max(...r.trick.map(t => t.covered ? 0 : cardStrength(t.card!)));
  const leaders = r.trick.filter(t => (t.covered ? 0 : cardStrength(t.card!)) === best);
  const winner = new Set(leaders.map(t => team(t.seat))).size === 1 ? team(leaders[0].seat) : null;
  const leader = winner === null ? r.trick[0].seat : leaders[0].seat;
  r.transition = { until: now + COLLECTION, winner, nextSeat: leader };
  r.deadline = r.transition.until;
}
function collectTrick(r: Room, now: number) {
  const { winner, nextSeat } = r.transition!;
  r.transition = null;
  (r.completedTricks ??= []).push({ number: r.trickNumber, plays: clone(r.trick), winner });
  r.trickResults.push(winner);
  log(r, `Vaza ${r.trickNumber}: ${winner === null ? 'empate' : `equipe ${winner + 1} venceu`}.`);
  const result = handWinner(r.trickResults);
  if (result !== undefined) {
    award(r, result, r.stake, now, result === null ? 'Mão empatada, sem tentos.' : `Equipe ${result + 1} venceu a mão de ${r.stake}.`);
    return;
  }
  r.trickNumber++; r.trick = []; r.currentSeat = nextSeat; r.deadline = now + TURN;
}
function recordTeamDecision(r: Room, p: Player, kind: 'truco' | 'eleven' | 'run', answer: string, now: number) {
  r.teamDecisions = [...(r.teamDecisions ?? []).filter(v => now - v.at < 8000).slice(-7), { id: randomUUID(), playerId: p.id, team: team(p.seat), kind, answer, at: now }];
}
function raise(r: Room, p: Player, now: number) {
  r.handNotice = null;
  if (r.scores[team(p.seat)] === 11) {
    r.trucoPenalty = { playerId: p.id, name: p.name, team: team(p.seat) };
    r.status = 'finished'; r.winner = 1 - team(p.seat); r.deadline = null; r.pending = null; r.botAction = null;
    log(r, `${p.name} pediu truco na mão de 11 e perdeu a partida. Equipe ${r.winner + 1} venceu.`);
    return;
  }
  if (r.eleven) fail('A mão de 11 vale 5, sem aumentos.');
  if (r.stake >= 11 || r.lastRaiser === team(p.seat)) fail('Sua equipe não pode aumentar agora.');
  const proposal = BIDS[BIDS.indexOf(r.stake) + 1];
  r.pending = { id: randomUUID(), team: team(p.seat), proposed: proposal, resumeSeat: r.currentSeat, by: p.id };
  r.deadline = now + TURN;
  log(r, `${p.name} pediu ${proposal}.`);
}
export function applyCommand(room: Room, playerId: string, command: any, now: number): Room {
  const r = clone(room);
  if (!command || typeof command.type !== 'string') fail('Comando inválido.');
  let p = r.players.find(v => v.id === playerId);
  const spectator = r.spectators?.find(v => v.id === playerId);
  r.hostId ??= r.players.find(v => !v.isBot)?.id;
  if (r.removedIds?.includes(playerId)) fail('Você foi removido desta sala pelo anfitrião.');
  if (command.type === 'watch') {
    if (p && r.status !== 'waiting') fail('Só é possível trocar de lugar antes da partida.');
    if (!spectator) {
      if ((r.spectators?.length ?? 0) >= 32) fail('Limite de espectadores atingido.');
      const name = p?.name ?? (typeof command.name === 'string' ? command.name.trim().slice(0, 24) : '');
      if (!name) fail('Informe seu nome.');
      (r.spectators ??= []).push({ id: playerId, name, lastSeen: now });
    }
    r.players = r.players.filter(v => v.id !== playerId);
    r.revision++; return r;
  }
  if (command.type === 'leave' || command.type === 'kick') {
    if (!p && !spectator) fail('Entre na sala primeiro.');
    if (command.type === 'kick' && (r.hostId !== playerId || r.status !== 'waiting')) fail('Só o anfitrião pode remover pessoas no lobby.');
    if (command.type === 'leave' && p && r.status === 'playing') fail('Aguarde a partida terminar para sair da sala.');
    const target = command.type === 'kick' ? command.targetId : playerId;
    if (command.type === 'kick' && (target === playerId || ![...r.players, ...(r.spectators ?? [])].some(v => v.id === target))) fail('Participante inválido.');
    r.players = r.players.filter(v => v.id !== target);
    r.spectators = (r.spectators ?? []).filter(v => v.id !== target);
    delete r.hands[target];
    if (command.type === 'kick') r.removedIds = [...(r.removedIds ?? []), target].slice(-128);
    if (r.hostId === target) r.hostId = r.players.find(v => !v.isBot)?.id ?? r.spectators[0]?.id;
    r.revision++; return r;
  }
  if (spectator && command.type !== 'join' && command.type !== 'seat' && command.type !== 'chat') fail('Espectadores só podem assistir e conversar.');
  if (spectator && command.type === 'seat') command = { ...command, type: 'join', name: spectator.name };
  if (command.type === 'join') {
    if (p) return r;
    if (r.status !== 'waiting' || r.players.length >= size(r)) fail('Sala cheia ou partida iniciada.');
    const name = typeof command.name === 'string' ? command.name.trim().slice(0, 24) : '';
    if (!name) fail('Informe seu nome.');
    const seat = command.seat ?? Array.from({ length: size(r) }, (_, i) => i).find(s => !r.players.some(v => v.seat === s))!;
    if (!Number.isInteger(seat) || seat < 0 || seat >= size(r) || r.players.some(v => v.seat === seat)) fail('Lugar ocupado ou inválido.');
    r.players.push({ id: playerId, name, seat, ready: false, lastSeen: now });
    r.spectators = (r.spectators ?? []).filter(v => v.id !== playerId);
    r.hostId ??= playerId;
  } else {
    if (!p && spectator && command.type === 'chat') p = { ...spectator, seat: -1, ready: false };
    if (!p) fail('Entre na sala primeiro.');
    if (command.type === 'chat' || command.type === 'signal') {
      if (command.type === 'chat') {
        if (typeof command.text !== 'string' || command.text.length > 240) fail('Escreva uma mensagem de até 240 caracteres.');
        const text = command.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
        if (!text) fail('Escreva uma mensagem.');
        const previous = r.chat?.findLast(m => m.playerId === p!.id);
        if (previous && now - previous.at < 1000) fail('Aguarde um segundo para enviar outra mensagem.');
        r.chat = [...(r.chat ?? []).slice(-49), { id: randomUUID(), playerId: p.id, name: p.name, text, at: now }];
      } else {
        if (r.mode !== '2x2' || r.status !== 'playing' || !r.players.some(v => v.id !== p!.id && team(v.seat) === team(p!.seat))) fail('Sinais estão disponíveis para o parceiro durante partidas em duplas.');
        const option = SIGNAL_OPTIONS.find(v => v.kind === command.kind);
        if (!option) fail('Sinal inválido.');
        const previous = r.signals?.findLast(v => v.playerId === p!.id);
        if (previous && now - previous.at < 2000) fail('Aguarde dois segundos para enviar outro sinal.');
        r.signals = [...(r.signals ?? []).filter(v => now - v.at < SIGNAL_DURATION_MS).slice(-15), { id: randomUUID(), playerId: p.id, team: team(p.seat), kind: option.kind, at: now }];
      }
      // Social activity must not invalidate a simultaneous card play or response.
      r.socialRevision = (r.socialRevision ?? 0) + 1;
      return r;
    }
    if (command.type === 'fill-bots') {
      if (r.status !== 'waiting' || r.hostId !== playerId) fail('Só o anfitrião pode completar a sala antes de começar.');
      if (r.players.length === size(r)) fail('A mesa já está completa.');
      for (let seat = 0; seat < size(r); seat++) if (!r.players.some(v => v.seat === seat)) {
        r.players.push({ id: randomUUID(), name: `Bot da casa ${seat + 1}`, seat, ready: true, lastSeen: now, isBot: true });
      }
      r.listed = false;
      if (r.players.every(v => v.ready)) { r.status = 'playing'; r.players.forEach(v => v.lastSeen = now); startHand(r, now); }
    } else if (command.type === 'seat' || command.type === 'ready') {
      if (r.status !== 'waiting') fail('A partida já começou.');
      if (command.type === 'seat') {
        if (!Number.isInteger(command.seat) || command.seat < 0 || command.seat >= size(r)) fail('Lugar inválido.');
        if (r.players.some(v => v.id !== playerId && v.seat === command.seat)) fail('Esse lugar está ocupado.');
        p.seat = command.seat; p.ready = false;
      } else {
        p.ready = typeof command.ready === 'boolean' ? command.ready : !p.ready;
        if (r.players.length === size(r) && r.players.every(v => v.ready)) {
          r.status = 'playing'; r.players.forEach(v => v.lastSeen = now); startHand(r, now);
        }
      }
    } else if (command.type === 'rematch') {
      if (r.status !== 'finished' && r.status !== 'cancelled') fail('A partida ainda não terminou.');
      if (!r.rematchVotes.includes(playerId)) r.rematchVotes.push(playerId);
      if (r.rematchVotes.length === size(r)) {
        r.status = 'playing'; r.scores = [0, 0]; r.winner = null; r.handNumber = 0; r.history = [];
        r.rematchVotes = []; r.players.forEach(v => v.lastSeen = now); startHand(r, now, true);
      }
    } else {
      if (r.status !== 'playing') fail('A partida não está em andamento.');
      if (r.transition) fail('Aguarde o recolhimento das cartas.');
      if (command.type === 'run-response') {
        const request = r.runRequest;
        if (!request || request.team !== team(p.seat) || request.by === p.id) fail('Não há corrida para você decidir.');
        if (command.answer !== 'run' && command.answer !== 'play') fail('Resposta inválida.');
        resolveDecision(r, request.id); r.runRequest = null;
        recordTeamDecision(r, p, 'run', command.answer, now);
        if (command.answer === 'run') award(r, 1 - request.team, r.stake, now, 'Os dois parceiros correram da mão.');
        else { r.currentSeat = request.resumeSeat; r.deadline = now + TURN; }
        r.revision++; return r;
      }
      if (r.runRequest) fail('Aguarde a decisão do parceiro sobre correr.');
      if (command.type === 'cap') {
        const ownTeam = team(p.seat);
        if (!decidingEleven(r) || r.scores[ownTeam] !== 3 || r.scores[1 - ownTeam] !== 11) fail('Só é possível capar durante a decisão em 11 a 3.');
        resolveDecision(r, r.eleven!.id); r.eleven!.accepted = [...r.eleven!.teams]; r.eleven!.forced = true;
        r.stake = 5; r.deadline = now + TURN;
        log(r, `${p.name} capou em 11 a 3. Jogo obrigatório por 5 tentos.`);
        r.revision++; return r;
      }
      if (command.type === 'eleven') {
        const ownTeam = team(p.seat);
        if (!decidingEleven(r) || !r.eleven!.teams.includes(ownTeam) || r.eleven!.accepted.includes(ownTeam) || r.eleven!.runVotes?.includes(p.id)) fail('Sua equipe não tem uma decisão pendente na mão de 11.');
        if (command.answer !== 'play' && command.answer !== 'run') fail('Resposta inválida para a mão de 11.');
        recordTeamDecision(r, p, 'eleven', command.answer, now);
        if (command.answer === 'run') {
          (r.eleven!.runVotes ??= []).push(p.id);
          if (r.players.filter(v => team(v.seat) === ownTeam).every(v => r.eleven!.runVotes!.includes(v.id))) {
            r.handNotice = { id: randomUUID(), team: ownTeam, decision: 'run', name: p.name, at: now };
            award(r, 1 - ownTeam, 3, now, `Equipe ${ownTeam + 1} correu da mão de 11: a equipe adversária avança uma etapa.`);
          }
          else log(r, `${p.name} votou em correr da mão de 11. Aguardando o parceiro.`);
        }
        else {
          r.eleven!.accepted.push(ownTeam);
          r.handNotice = { id: randomUUID(), team: ownTeam, decision: 'play', name: p.name, at: now };
          log(r, `${p.name} aceitou jogar a mão de 11.`);
          if (!decidingEleven(r)) { resolveDecision(r, r.eleven!.id); r.stake = 5; r.deadline = now + TURN; log(r, 'Mão de 11 iniciada: vale 5 tentos.'); }
        }
        r.revision++; return r;
      }
      if (decidingEleven(r)) fail('Aguarde a decisão da mão de 11.');
      if (command.type === 'play') play(r, p, command.cardId, command.covered === true, now);
      else if (command.type === 'respond') {
        const pending = r.pending;
        if (!pending || pending.team === team(p.seat)) fail('Não há pedido para sua equipe responder.');
        if (pending.runVotes?.includes(p.id)) fail('Você já respondeu. Aguarde seu parceiro.');
        if (!['accept', 'run', 'raise'].includes(command.answer)) fail('Resposta inválida.');
        recordTeamDecision(r, p, 'truco', command.answer, now);
        if (command.answer === 'run') {
          (pending.runVotes ??= []).push(p.id);
          if (r.players.filter(v => team(v.seat) === team(p!.seat)).every(v => pending.runVotes!.includes(v.id))) {
            r.handNotice = { id: randomUUID(), kind: 'truco', proposed: pending.proposed, team: team(p.seat), decision: 'run', name: p.name, at: now };
            award(r, pending.team, r.stake, now, `Equipe ${team(p.seat) + 1} correu do pedido.`);
          }
          else log(r, `${p.name} votou em correr do pedido. Aguardando o parceiro.`);
        }
        else {
          if (command.answer === 'raise' && pending.proposed === 11) fail('O limite é 11.');
          if (command.answer === 'accept') r.handNotice = { id: randomUUID(), kind: 'truco', proposed: pending.proposed, team: team(p.seat), decision: 'play', name: p.name, at: now };
          r.stake = pending.proposed; r.lastRaiser = pending.team; r.currentSeat = pending.resumeSeat;
          resolveDecision(r, pending.id);
          r.pending = null; r.deadline = now + TURN;
          log(r, `${p.name} aceitou ${r.stake}.`);
          if (command.answer === 'raise') raise(r, p, now);
        }
      } else if (command.type === 'raise' || command.type === 'run') {
        if (r.pending || r.currentSeat !== p.seat) fail('Aguarde a sua vez.');
        if (command.type === 'run' && r.eleven?.forced) fail('No 11 a 11, os dois lados são obrigados a jogar.');
        if (command.type === 'raise') raise(r, p, now);
        else if (r.mode === '2x2') {
          r.runRequest = { id: randomUUID(), team: team(p.seat), by: p.id, resumeSeat: r.currentSeat };
          recordTeamDecision(r, p, 'run', 'run', now); r.deadline = now + TURN;
        } else award(r, 1 - team(p.seat), r.stake, now, `${p.name} correu da mão.`);
      } else fail('Comando desconhecido.');
    }
  }
  r.revision++; return r;
}
export function reconcile(room: Room, now: number): Room {
  const r = clone(room);
  const steps = [0, 3, 5, 7, 9, 11];
  const scores = r.scores.map(value => steps.findLast(score => score <= value) ?? 0);
  if (scores.some((score, i) => score !== r.scores[i])) { r.scores = scores; r.revision++; }
  // Upgrade ongoing rooms created before mandatory 11–11 play was introduced.
  if (r.status === 'playing' && r.scores.every(score => score === 11) && !r.eleven?.forced) {
    r.eleven = { teams: [0, 1], accepted: [0, 1], forced: true }; r.stake = 5; r.pending = null;
    log(r, '11 a 11: os dois lados são obrigados a jogar por 5 tentos, sem correr.'); r.revision++;
  }
  while (r.status === 'playing') {
    const absentAt = Math.min(...r.players.filter(p => !p.isBot).map(p => p.lastSeen + ABSENCE));
    const eventAt = Math.min(absentAt, r.transition?.until ?? r.deadline ?? Infinity);
    if (eventAt > now) break;
    if (absentAt === eventAt) {
      const lost = new Set(r.players.filter(p => !p.isBot && p.lastSeen + ABSENCE === absentAt).map(p => team(p.seat)));
      r.deadline = null; r.pending = null; r.transition = null;
      if (lost.size > 1) { r.status = 'cancelled'; r.winner = null; log(r, 'Partida cancelada: as duas equipes ficaram ausentes.'); }
      else { r.status = 'finished'; r.winner = 1 - [...lost][0]; log(r, `Equipe ${r.winner + 1} venceu por abandono.`); }
    } else if (r.transition) {
      collectTrick(r, eventAt);
    } else if (r.runRequest) {
      // Silence is not a second run vote: keep playing if the partner does not agree.
      resolveDecision(r, r.runRequest.id); r.currentSeat = r.runRequest.resumeSeat; r.runRequest = null; r.deadline = eventAt + TURN;
    } else if (decidingEleven(r)) {
      const lost = r.eleven!.teams.find(t => !r.eleven!.accepted.includes(t))!;
      r.handNotice = { id: randomUUID(), team: lost, decision: 'run', name: r.players.find(p => team(p.seat) === lost)!.name, at: eventAt };
      award(r, 1 - lost, 3, eventAt, `Prazo da mão de 11 esgotado: equipe ${lost + 1} correu e entregou 3 tentos.`);
    } else if (r.pending) {
      const lost = 1 - r.pending.team;
      r.handNotice = { id: randomUUID(), kind: 'truco', proposed: r.pending.proposed, team: lost, decision: 'run', name: r.players.find(p => team(p.seat) === lost)!.name, at: eventAt };
      award(r, r.pending.team, r.stake, eventAt, 'Prazo do pedido esgotado: a equipe adversária correu.');
    } else {
      const p = atSeat(r, r.currentSeat);
      const lowest = [...r.hands[p.id]].sort((a, b) => cardStrength(a) - cardStrength(b) || a.id.localeCompare(b.id))[0];
      play(r, p, lowest.id, false, eventAt);
    }
    r.revision++;
  }
  return r;
}
export function playerView(room: Room, playerId: string, now: number): any {
  const r = room; const p = r.players.find(v => v.id === playerId);
  const active = !!p && r.status === 'playing' && !r.transition && now >= (r.handStartedAt ?? 0);
  const deciding = r.status === 'playing' && decidingEleven(r);
  const ownTurn = active && !deciding && !r.pending && !r.runRequest && r.currentSeat === p!.seat;
  const watching = !!r.spectators?.some(v => v.id === playerId);
  return clone({ playerId, code: r.code, mode: r.mode, revision: r.revision, status: r.status,
    hostId: r.hostId ?? r.players[0]?.id, tableTheme: r.tableTheme ?? 'classic', isSpectator: watching,
    spectators: (r.spectators ?? []).map(({ id, name }) => ({ id, name })),
    runRequest: r.runRequest ?? null,
    players: r.players.map(({ id, name, seat, ready, isBot }) => ({ id, name, seat, ready, isBot: !!isBot, cardCount: r.hands[id]?.length ?? 0 })),
    currentSeat: r.currentSeat, dealer: r.dealer, stake: r.stake, pending: r.pending ? { team: r.pending.team, proposed: r.pending.proposed, by: r.pending.by ?? null, runVotes: r.pending.runVotes ?? [], id: r.pending.id ?? null } : null,
    deadline: r.deadline, scores: r.scores, handNumber: r.handNumber, trickNumber: r.trickNumber,
    collecting: !!r.transition, tableUntil: r.transition?.until ?? null, handStartedAt: r.handStartedAt ?? 0,
    collectingWinner: r.transition?.winner ?? null,
    tableTricks: [
      ...(r.completedTricks ?? []),
      ...(r.trick.length && !(r.completedTricks ?? []).some(t => t.number === r.trickNumber)
        ? [{ number: r.trickNumber, plays: r.trick, winner: r.transition?.winner ?? null }] : []),
    ],
    previousHandResults: r.previousHandResults ?? null,
    trick: r.trick, trickResults: r.trickResults, history: r.history, winner: r.winner, trucoPenalty: r.trucoPenalty ?? null,
    teamDecisions: p && r.mode === '2x2' ? (r.teamDecisions ?? []).filter(v => v.team === team(p.seat) && now - v.at < 8000) : [],
    handNotice: (p || watching) && r.handNotice && now - r.handNotice.at < ELEVEN_NOTICE_MS ? r.handNotice : null,
    chat: p || watching ? r.chat ?? [] : [], socialRevision: r.socialRevision ?? 0,
    signals: (p || watching) && r.mode === '2x2' && r.status === 'playing' ? (r.signals ?? []).filter(v => now - v.at < SIGNAL_DURATION_MS) : [],
    eleven: r.eleven ? { teams: r.eleven.teams, accepted: r.eleven.accepted, deciding, forced: !!r.eleven.forced, runVotes: r.eleven.runVotes ?? [], id: r.eleven.id ?? null } : null,
    partnerHands: active && p && r.scores[team(p.seat)] === 11 && (deciding || (r.eleven?.forced && r.eleven.teams.length === 2 && r.trickNumber === 1)) ? r.players.filter(v => v.id !== p.id && team(v.seat) === team(p.seat)).map(v => ({ playerId: v.id, name: v.name, cards: r.hands[v.id] ?? [] })) : [],
    hand: p ? r.hands[p.id] ?? [] : [], legal: { play: ownTurn, cover: ownTurn && r.trickNumber > 1,
      runResponse: active && !!r.runRequest && r.runRequest.team === team(p!.seat) && r.runRequest.by !== p!.id,
      cap: active && deciding && r.scores[team(p!.seat)] === 3 && r.scores[1 - team(p!.seat)] === 11,
      eleven: active && deciding && !!r.eleven?.teams.includes(team(p!.seat)) && !r.eleven?.accepted.includes(team(p!.seat)) && !r.eleven?.runVotes?.includes(p!.id),
      raise: ownTurn && (r.scores[team(p!.seat)] === 11 || (!r.eleven && r.stake < 11 && r.lastRaiser !== team(p!.seat))),
      respond: active && !!r.pending && r.pending.team !== team(p!.seat) && !r.pending.runVotes?.includes(p!.id), run: ownTurn && !r.eleven?.forced },
    rematchVotes: r.rematchVotes, serverTime: now });
}


