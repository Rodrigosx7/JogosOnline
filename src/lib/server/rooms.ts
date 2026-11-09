import { randomBytes, randomUUID } from 'node:crypto';
import { advanceBot } from './bot';
import { applyCommand, createRoom, playerView, reconcile } from '../game';
import { HttpError, name } from './http';
import { roomStore, cloudConfigured, type RoomStore } from './storage';
import {loadCustomConfig} from './custom-store';

type Room = ReturnType<typeof createRoom>;
type Command = Parameters<typeof applyCommand>[2];

function validateCommand(value: unknown): Command {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Comando inválido.');
  const input = value as Record<string, unknown>;
  let command: Record<string, unknown>;
  switch (input.type) {
    case 'chat':
      if (typeof input.text !== 'string' || input.text.length > 240) throw new HttpError(400, 'Escreva uma mensagem de até 240 caracteres.');
      command = { type: 'chat', text: input.text }; break;
    case 'signal':
      if (typeof input.kind !== 'string' || input.kind.length > 24) throw new HttpError(400, 'Sinal inválido.');
      command = { type: 'signal', kind: input.kind }; break;
    case 'join': command = { type: 'join', name: name(input.name) }; break;
    case 'pull':
      if(!Number.isInteger(input.amount)||!Number(input.amount)||Math.abs(Number(input.amount))>11)throw new HttpError(400,'Quantidade de tentos inválida.');
      command={type:'pull',amount:input.amount};break;
    case 'finish-vote':
      if(input.vote!==undefined&&typeof input.vote!=='boolean')throw new HttpError(400,'Voto inválido.');
      command={type:'finish-vote',vote:input.vote};break;
    case 'watch': command = { type: 'watch', name: input.name === undefined ? undefined : name(input.name) }; break;
    case 'kick':
      if (typeof input.targetId !== 'string' || input.targetId.length > 100) throw new HttpError(400, 'Participante inválido.');
      command = { type: 'kick', targetId: input.targetId }; break;
    case 'run-response':
      if (input.answer !== 'run' && input.answer !== 'play') throw new HttpError(400, 'Resposta inválida.');
      command = { type: 'run-response', answer: input.answer }; break;
    case 'cap': case 'leave': command = { type: input.type }; break;
    case 'seat':
      if (!Number.isInteger(input.seat) || Number(input.seat) < 0 || Number(input.seat) > 3) throw new HttpError(400, 'Lugar inválido.');
      command = { type: 'seat', seat: input.seat }; break;
    case 'fill-bots': command = { type: 'fill-bots' }; break;
    case 'ready': command = { type: 'ready' }; break;
    case 'play':
      if (typeof input.cardId !== 'string' || input.cardId.length > 64 || (input.covered !== undefined && typeof input.covered !== 'boolean')) throw new HttpError(400, 'Carta inválida.');
      command = { type: 'play', cardId: input.cardId, covered: input.covered === true }; break;
    case 'respond':
      if (!['accept', 'run', 'raise'].includes(String(input.answer))) throw new HttpError(400, 'Resposta inválida.');
      command = { type: 'respond', answer: input.answer }; break;
    case 'eleven':
      if (input.answer !== 'play' && input.answer !== 'run') throw new HttpError(400, 'Resposta inválida para a mão de 11.');
      command = { type: 'eleven', answer: input.answer }; break;
    case 'raise': case 'run': case 'rematch': command = { type: input.type }; break;
    default: throw new HttpError(400, 'Comando desconhecido.');
  }
  if(input.type==='pull'||input.type==='finish-vote') {
    if(input.matchId!==undefined&&(typeof input.matchId!=='string'||!/^[a-f0-9-]{36}$/.test(input.matchId)))throw new HttpError(400,'Partida inválida.');
    if(input.matchId)command.matchId=input.matchId;
  }
  if (['respond', 'eleven', 'cap', 'run-response'].includes(String(input.type))) {
    if (input.decisionId !== undefined && (typeof input.decisionId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(input.decisionId))) throw new HttpError(400, 'Identificador de decisão inválido.');
    if (input.decisionId) command.decisionId = input.decisionId;
  }
  return command as Command;
}

function member(room: Room, playerId: string) { return room.players.some(player => player.id === playerId) || !!room.spectators?.some(player => player.id === playerId); }
function publicView(room: Room, playerId: string, now: number) {
  return { ...playerView(room, playerId, now), playerId, sync: cloudConfigured() && !room.spectators?.some(p => p.id === playerId) ? 'realtime' : 'polling' };
}
function heartbeat(room: Room, playerId: string, now: number) {
  const player = room.players.find(player => player.id === playerId) ?? room.spectators?.find(player => player.id === playerId);
  if (player) player.lastSeen = now;
}

export async function newRoom(playerId: string, input: Record<string, unknown>, store: RoomStore = roomStore()) {
  if (input.mode !== '1x1' && input.mode !== '2x2') throw new HttpError(400, 'Escolha 1x1 ou 2x2.');
  const displayName = name(input.name);
  if (input.listed !== undefined && typeof input.listed !== 'boolean') throw new HttpError(400, 'Visibilidade da sala inválida.');
  if (input.practice !== undefined && typeof input.practice !== 'boolean') throw new HttpError(400, 'Modo de treino inválido.');
  if (input.tableTheme !== undefined && input.tableTheme !== 'classic' && input.tableTheme !== 'skol') throw new HttpError(400, 'Mesa inválida.');
  if(input.variant!==undefined && input.variant!=='normal' && input.variant!=='custom')throw new HttpError(400,'Modo inválido.');
  if(input.scoreMode!==undefined && input.scoreMode!=='normal'&&input.scoreMode!=='manual')throw new HttpError(400,'Pontuação inválida.');
  if(input.scoreMode==='manual'&&input.variant!=='custom')throw new HttpError(400,'Tentos manuais existem somente no personalizado.');
  const custom=input.variant==='custom'?await loadCustomConfig():null;
  if(custom&&!custom.enabled)throw new HttpError(400,'O modo personalizado está temporariamente fechado pelo administrador.');
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = randomBytes(18).toString('base64url');
    let state = createRoom(code, input.mode);
    state.tableTheme = input.tableTheme === 'skol' ? 'skol' : 'classic';
    if(custom)state.custom={config:custom,scoreMode:input.scoreMode==='manual'?'manual':'normal'};
    state.listed = input.listed === true && !input.practice;
    state = applyCommand(state, playerId, { type: 'join', name: displayName } as Command, Date.now());
    if (input.practice) {
      const names = input.mode === '2x2' ? ['Bot adversário 1', 'Bot parceiro', 'Bot adversário 2'] : ['Bot da casa'];
      for (const name of names) {
        const botId = randomUUID();
        state = applyCommand(state, botId, { type: 'join', name }, Date.now());
        state.players.find(p => p.id === botId)!.isBot = true;
        state = applyCommand(state, botId, { type: 'ready' }, Date.now());
      }
    }
    if (await store.create(code, { state, requests: {} })) return { code };
  }
  throw new Error('Room creation failed');
}

export async function openRooms(store: RoomStore = roomStore(), now = Date.now()) {
  const rooms = await store.listOpen();
  const host = (room: Room) => [...room.players, ...(room.spectators ?? [])].find(p => p.id === room.hostId) ?? room.players[0];
  return rooms.filter(room => !('game' in room && room.game === 'domino') && room.listed && room.status === 'waiting' && !room.players.some(p => p.isBot) && room.players.length < (room.mode === '2x2' ? 4 : 2) && host(room)?.lastSeen > now - 90_000)
    .sort((a, b) => host(b).lastSeen - host(a).lastSeen).slice(0, 20)
    .map(room => ({ code: room.code, mode: room.mode, host: host(room).name, players: room.players.length, capacity: room.mode === '2x2' ? 4 : 2,...(room.custom?{customName:room.custom.config.name,scoreMode:room.custom.scoreMode}:{}) }));
}

export async function accessRoom(code: string, playerId: string, input?: Record<string, unknown>, store: RoomStore = roomStore()) {
  if (!/^[A-Za-z0-9_-]{18,64}$/.test(code)) throw new HttpError(404, 'Mesa não encontrada.');
  const command = input ? validateCommand(input.command) : undefined;
  if (input && (!Number.isSafeInteger(input.revision) || Number(input.revision) < 0 || typeof input.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(input.requestId)))
    throw new HttpError(400, 'Revisão ou identificador da solicitação inválido.');
  for (let attempt = 0; attempt < 10; attempt++) {
    const stored = await store.get<Room>(code);
    if (!stored || ('game' in stored.document.state && stored.document.state.game === 'domino')) throw new HttpError(404, 'Mesa não encontrada.');
    const now = Date.now();
    // Resolve deadlines against persisted lastSeen BEFORE recording this request's presence.
    let state = reconcile(stored.document.state, now);
    const belongs = member(state, playerId);
    if (state.removedIds?.includes(playerId)) throw new HttpError(403, 'Você foi removido desta sala pelo anfitrião.');
    if (!belongs && command?.type !== 'join' && command?.type !== 'watch') throw new HttpError(403, 'Entre na mesa pelo convite para continuar.');
    const requests = stored.document.requests;
    const duplicate = input && (requests[playerId] ?? []).includes(input.requestId as string);
    let conflict = false;
    if (command && !duplicate) {
      // Joining is allowed to discover a private room using its unguessable invite.
      const decision = ['respond', 'eleven', 'cap', 'run-response'].includes(command.type) && typeof command.decisionId === 'string' ? command.decisionId as string : null;
      const settled = !!decision && (state.resolvedDecisions ?? []).includes(decision);
      const sameDecision = !!decision && (command.type === 'respond' ? state.pending?.id === decision : command.type === 'run-response' ? state.runRequest?.id === decision : state.eleven?.id === decision);
      const manualAction=['pull','finish-vote'].includes(command.type)&&typeof command.matchId==='string';
      const sameManualMatch=manualAction&&command.matchId===state.matchId&&Number(input!.revision)<=state.revision;
      conflict = !settled && ((manualAction&&!sameManualMatch) || (!!decision && !sameDecision) || (!['join', 'watch', 'chat', 'signal'].includes(command.type) && input!.revision !== state.revision && !sameManualMatch && !(sameDecision && Number(input!.revision) <= state.revision)));
      if (!conflict) {
        try { if (!settled) state = applyCommand(state, playerId, command, now); }
        catch (error) { throw new HttpError(400, error instanceof Error ? error.message : 'Jogada inválida.'); }
        requests[playerId] = [...(requests[playerId] ?? []).slice(-127), input!.requestId as string];
      }
    }
    heartbeat(state, playerId, now);
    state = advanceBot(state, now);
    if (await store.compareAndSwap(code, stored.version, { state, requests }))
      return { status: conflict ? 409 : 200, view: publicView(state, playerId, now) };
  }
  throw new HttpError(409, 'A mesa recebeu muitas jogadas. Atualize para continuar.');
}
