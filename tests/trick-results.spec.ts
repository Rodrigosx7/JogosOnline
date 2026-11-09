import { test, expect } from '@playwright/test';
import { FileRoomStore } from '../src/lib/server/storage';
import type { Room } from '../src/lib/game';

test('trick results invert colors for opposite teams and remain outside the felt', async ({ browser }) => {
  const origin = process.env.TRUCO_TEST_URL || 'http://localhost:3000';
  test.skip(!origin.includes('localhost:3002'), 'Isolated visual fixture.');
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  try {
    const { code } = await (await contexts[0].request.post(`${origin}/api/rooms`, { data: { mode: '2x2', name: 'Pessoa 0' } })).json();
    const url = `${origin}/api/rooms/${code}`;
    for (let i = 1; i < 4; i++) await contexts[i].request.post(url, { data: { command: { type: 'join', name: `Pessoa ${i}` }, revision: 0, requestId: crypto.randomUUID() } });
    for (let i = 0; i < 4; i++) {
      const state = await (await contexts[i].request.get(url)).json();
      await contexts[i].request.post(url, { data: { command: { type: 'ready' }, revision: state.revision, requestId: crypto.randomUUID() } });
    }
    const store = new FileRoomStore(), stored = (await store.get<Room>(code))!;
    Object.assign(stored.document.state, { status: 'finished', winner: 1, scores: [7, 11], trickResults: [0, 1, 1], transition: null, deadline: null });
    stored.document.state.revision++;
    expect(await store.compareAndSwap(code, stored.version, stored.document)).toBeTruthy();
    for (const [i, context] of contexts.entries()) {
      const page = await context.newPage(); await page.goto(`${origin}/room/${code}`);
      const items = page.getByTestId('trick-result'); await expect(items).toHaveCount(3);
      await expect(items.nth(0)).toHaveAttribute('data-outcome', i % 2 === 0 ? 'won' : 'lost');
      await expect(items.nth(1)).toHaveAttribute('data-outcome', i % 2 === 0 ? 'lost' : 'won');
      await expect(items.nth(2)).toHaveAttribute('data-outcome', i % 2 === 0 ? 'lost' : 'won');
      await expect(page.locator('.felt-table [data-testid="trick-result"]')).toHaveCount(0);
      await expect(page.locator('.table-hud [data-testid="trick-result"]')).toHaveCount(3);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => scrollTo(0, 0));
      const box = (await page.getByRole('region', { name: 'Resultados das vazas' }).boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThan(844);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      if (i === 0) await page.screenshot({ path: 'test-results/room-design-mobile.png', fullPage: true });
    }
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
