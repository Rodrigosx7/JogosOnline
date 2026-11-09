import { test, expect } from '@playwright/test';
import { FileRoomStore } from '../src/lib/server/storage';
import type { Room } from '../src/lib/game';

test('result stays clear of player names and replay labels match the outcome', async ({ browser }) => {
  const origin = process.env.TRUCO_TEST_URL || 'http://localhost:3000';
  test.skip(!origin.includes('localhost:3002'), 'Isolated result fixture.');
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const response = await contexts[0].request.post(`${origin}/api/rooms`, { data: { mode: '1x1', name: 'Vencedor' } });
    const { code } = await response.json(), endpoint = `${origin}/api/rooms/${code}`;
    async function command(i: number, command: any) {
      const state = command.type === 'join' ? { revision: 0 } : await (await contexts[i].request.get(endpoint)).json();
      const result = await contexts[i].request.post(endpoint, { data: { command, revision: state.revision, requestId: crypto.randomUUID() } });
      expect(result.ok(), await result.text()).toBeTruthy();
    }
    await command(1, { type: 'join', name: 'Adversario' });
    await command(0, { type: 'ready' }); await command(1, { type: 'ready' });
    const store = new FileRoomStore(), stored = (await store.get<Room>(code))!;
    Object.assign(stored.document.state, { status: 'finished', winner: 0, scores: [11, 11], trucoPenalty: { playerId: stored.document.state.players[1].id, name: 'Adversario', team: 1 }, trick: [{ seat: 0, card: { id: '3-clubs', rank: '3', suit: 'clubs' }, covered: false }], deadline: null, transition: null });
    stored.document.state.revision++;
    expect(await store.compareAndSwap(code, stored.version, stored.document)).toBeTruthy();
    const pages = await Promise.all(contexts.map(c => c.newPage()));
    for (const [i, page] of pages.entries()) {
      await page.goto(`${origin}/room/${code}`);
      await expect(page.locator('.finish-panel .current-trick-arena')).toHaveCount(0);
      await expect(page.getByRole('button', { name: i === 0 ? 'Jogar novamente' : 'Pedir revanche', exact: true })).toBeVisible();
      for (const width of [960, 390, 1366]) {
        await page.setViewportSize({ width, height: 900 });
        const panel = (await page.getByRole('region', { name: 'Resultado da partida' }).boundingBox())!;
        const labels = await page.locator('.seat-label').evaluateAll(items => items.map(e => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; }));
        for (const label of labels) expect(panel.x >= label.x + label.width || panel.x + panel.width <= label.x || panel.y >= label.y + label.height || panel.y + panel.height <= label.y).toBeTruthy();
        await page.screenshot({ path: `test-results/result-${i}-${width}.png` });
      }
    }
    await pages[1].getByRole('button', { name: 'Pedir revanche', exact: true }).click();
    await expect(pages[1].getByRole('button', { name: 'Revanche pedida ✓', exact: true })).toBeDisabled();
    await expect(pages[0].getByText('1 de 2 aceitaram jogar de novo', { exact: true })).toBeVisible();
    await pages[0].getByRole('button', { name: 'Jogar novamente', exact: true }).click();
    await expect(pages[0].getByTestId('dealing-animation')).toBeVisible();
    await expect(pages[1].getByTestId('dealing-animation')).toBeVisible();
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
