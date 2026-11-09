import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FileRoomStore } from './storage';
import { accessDominoRoom, newDominoRoom, openDominoRooms } from './domino-rooms';
import { accessRoom, newRoom, openRooms } from './rooms';
import type { Domino } from '../domino';

test('domino rooms isolate games, protect membership, reject forged commands and deduplicate retries', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'domino-room-'));
  try {
    const store = new FileRoomStore(directory);
    const domino = await newDominoRoom('host', { name: 'Anfitrião', listed: true }, store);
    const truco = await newRoom('truco-host', { name: 'Truco', mode: '1x1', listed: true }, store);
    assert.deepEqual((await openRooms(store)).map(r => r.code), [truco.code]);
    assert.deepEqual((await openDominoRooms(store)).map(r => r.code), [domino.code]);
    await assert.rejects(accessRoom(domino.code, 'host', undefined, store), /não encontrada/);
    await assert.rejects(accessDominoRoom(truco.code, 'host', undefined, store), /não encontrada/);
    await assert.rejects(accessDominoRoom(domino.code, 'outsider', undefined, store), /Entre na mesa/);
    const initial = await accessDominoRoom(domino.code, 'host', undefined, store);
    const request = { command: { type: 'fill-bots', playerId: 'forged' }, revision: initial.view.revision, requestId: 'fill-bots-request' };
    const first = await accessDominoRoom(domino.code, 'host', request, store);
    const repeat = await accessDominoRoom(domino.code, 'host', request, store);
    assert.equal(first.status, 200); assert.equal(repeat.status, 200); assert.equal(repeat.view.players.length, 4);
    const ready = await accessDominoRoom(domino.code, 'host', { command: { type: 'ready' }, revision: repeat.view.revision, requestId: 'ready-request' }, store);
    assert.equal(ready.view.status, 'playing'); assert.equal(ready.view.hand.length, 7); assert.equal('hands' in ready.view, false);
    await assert.rejects(accessDominoRoom(domino.code, 'host', { command: { type: 'play', stoneId: '99-99', end: 'right' }, revision: ready.view.revision, requestId: 'invalid-stone' }, store));
    const saved = (await store.get<Domino>(domino.code))!;
    assert.equal(Object.values(saved.document.state.hands).flat().length, 28);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
