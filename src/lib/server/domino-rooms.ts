import { randomBytes } from 'node:crypto';
import { advanceDominoBots, applyDomino, createDomino, dominoView, reconcileDomino, type Domino, type DominoCommand } from '../domino';
import { HttpError, name } from './http';
import { roomStore, type RoomStore } from './storage';

function parse(value: unknown): DominoCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Comando inválido.');
  const input = value as Record<string, unknown>;
  switch (input.type) {
    case 'join': return { type: 'join', name: name(input.name) };
    case 'ready': case 'pass': case 'fill-bots': case 'rematch': return { type: input.type };
    case 'seat':
      if (!Number.isInteger(input.seat) || ![0, 1, 2, 3].includes(Number(input.seat))) break;
      return { type: 'seat', seat: Number(input.seat) };
    case 'chat':
      if (typeof input.text !== 'string' || input.text.length > 240) break;
      return { type: 'chat', text: input.text };
    case 'play':
      if (typeof input.stoneId !== 'string' || !/^[0-6]-[0-6]$/.test(input.stoneId) || !['left', 'right'].includes(String(input.end))) break;
      return { type: 'play', stoneId: input.stoneId, end: input.end as 'left' | 'right' };
  }
  throw new HttpError(400, 'Comando inválido.');
}
export async function newDominoRoom(id: string, input: Record<string, unknown>, store: RoomStore = roomStore()) {
  const displayName = name(input.name);
  if ([input.listed, input.practice].some(v => v !== undefined && typeof v !== 'boolean')) throw new HttpError(400, 'Configuração inválida.');
  for (let i = 0; i < 3; i++) {
    const code = randomBytes(18).toString('base64url'), now = Date.now();
    let state = applyDomino(createDomino(code, input.listed === true && !input.practice), id, { type: 'join', name: displayName }, now);
    if (input.practice) state = applyDomino(state, id, { type: 'fill-bots' }, now);
    if (await store.create(code, { state, requests: {} })) return { code };
  }
  throw new HttpError(503, 'Não foi possível criar a mesa. Tente novamente.');
}
export async function openDominoRooms(store: RoomStore = roomStore(), now = Date.now()) {
  const rooms = await store.listOpen() as unknown as Domino[];
  return rooms.filter(r => r.game === 'domino' && r.status === 'waiting' && r.listed && r.players.length < 4 && r.players[0]?.lastSeen > now - 90000)
    .slice(0, 20).map(r => ({ code: r.code, host: r.players[0].name, players: r.players.length }));
}
export async function accessDominoRoom(code: string, id: string, input?: Record<string, unknown>, store: RoomStore = roomStore()) {
  if (!/^[A-Za-z0-9_-]{18,64}$/.test(code)) throw new HttpError(404, 'Mesa não encontrada.');
  const command = input ? parse(input.command) : undefined;
  if (input && (!Number.isSafeInteger(input.revision) || Number(input.revision) < 0 || typeof input.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(input.requestId)))
    throw new HttpError(400, 'Solicitação inválida.');
  for (let attempt = 0; attempt < 10; attempt++) {
    const saved = await store.get<Domino>(code);
    if (!saved || saved.document.state.game !== 'domino') throw new HttpError(404, 'Mesa de dominó não encontrada.');
    const now = Date.now();
    let state = reconcileDomino(saved.document.state, now);
    if (!state.players.some(p => p.id === id) && command?.type !== 'join') throw new HttpError(403, 'Entre na mesa pelo convite.');
    const requests = saved.document.requests, duplicate = !!input && (requests[id] ?? []).includes(input.requestId as string);
    const conflict = !!command && !duplicate && !['join', 'chat'].includes(command.type) && input!.revision !== state.revision;
    if (command && !duplicate && !conflict) {
      try { state = applyDomino(state, id, command, now); }
      catch (error) { throw new HttpError(400, error instanceof Error ? error.message : 'Jogada inválida.'); }
      requests[id] = [...(requests[id] ?? []).slice(-127), input!.requestId as string];
    }
    const player = state.players.find(p => p.id === id);
    if (player) player.lastSeen = now;
    state = advanceDominoBots(state, now);
    if (await store.compareAndSwap(code, saved.version, { state, requests })) return { status: conflict ? 409 : 200, view: dominoView(state, id, now) };
  }
  throw new HttpError(409, 'A mesa recebeu outra jogada. Tente novamente.');
}
