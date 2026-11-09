import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FileRoomStore } from './storage';
import { signSession, verifySession } from './session';

test('signed identity rejects visible player IDs, tampering and a different server secret', () => {
  const id = 'c6bb3cd4-f4c1-49fe-a064-fae876ce99d1';
  const key = Buffer.alloc(32, 1), token = signSession(id, key);
  assert.equal(verifySession(token, key), id);
  assert.equal(verifySession(id, key), null);
  assert.equal(verifySession(token.replace('c6bb', 'd6bb'), key), null);
  assert.equal(verifySession(token, Buffer.alloc(32, 2)), null);
  assert.equal(verifySession(`${token}.extra`, key), null);
});

test('persistent CAS permits exactly one concurrent writer and survives adapter recreation', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mesa-store-'));
  try {
    const store = new FileRoomStore(directory), code = 'abcdefghijklmnopqrstuvwx';
    assert.equal(await store.create(code, { state: { value: 0 }, requests: {} }), true);
    const writes = await Promise.all(Array.from({ length: 16 }, (_, value) =>
      store.compareAndSwap(code, 0, { state: { value }, requests: {} })));
    assert.equal(writes.filter(Boolean).length, 1);
    const persisted = await new FileRoomStore(directory).get<{ value: number }>(code);
    assert.equal(persisted?.version, 1);
    assert.equal(await store.create(code, { state: {}, requests: {} }), false);
    await assert.rejects(store.get('../../sensitive'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
