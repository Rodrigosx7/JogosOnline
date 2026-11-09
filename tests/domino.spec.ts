import { test, expect } from '@playwright/test';

const origin = process.env.TRUCO_TEST_URL || 'http://localhost:3000';
test('domino entry, practice bots and mobile layout', async ({ page }) => {
  await page.goto(origin);
  await page.getByRole('link', { name: 'Dominó', exact: true }).click();
  await expect(page).toHaveURL(/\/domino$/);
  await page.getByLabel('Como te chamam?').fill('Treinador');
  await page.getByRole('button', { name: 'Treinar com bots', exact: true }).click();
  await expect(page).toHaveURL(/\/domino\/room\//);
  await expect(page.getByText('Bot 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Estou pronto', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Suas pedras' }).locator('.domino-stone')).toHaveCount(7);
  for (const width of [1366, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/domino-${width}.png`, fullPage: true });
  }
});

test('four independent players complete a domino match with private hands and a unanimous replay', async ({ browser }) => {
  test.setTimeout(240000);
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  try {
    const response = await contexts[0].request.post(`${origin}/api/domino/rooms`, { data: { name: 'Pessoa 0', listed: true } });
    expect(response.ok(), await response.text()).toBeTruthy();
    const { code } = await response.json(), endpoint = `${origin}/api/domino/rooms/${code}`;
    const view = async (i: number) => { const r = await contexts[i].request.get(endpoint); expect(r.ok(), await r.text()).toBeTruthy(); return r.json(); };
    async function command(i: number, command: any, known?: any) {
      const state = known ?? (command.type === 'join' ? { revision: 0 } : await view(i));
      const r = await contexts[i].request.post(endpoint, { data: { command, revision: state.revision, requestId: crypto.randomUUID() } });
      expect(r.ok(), await r.text()).toBeTruthy(); return r.json();
    }
    for (let i = 1; i < 4; i++) await command(i, { type: 'join', name: `Pessoa ${i}` });
    for (let i = 0; i < 4; i++) await command(i, { type: 'ready' });
    const initial = await Promise.all(contexts.map((_, i) => view(i)));
    expect(new Set(initial.flatMap(v => v.hand.map((s: any) => s.id))).size).toBe(28);
    for (const state of initial) { expect(state.hand).toHaveLength(7); expect(state).not.toHaveProperty('hands'); expect(state).not.toHaveProperty('deck'); }
    const pages = await Promise.all(contexts.map(c => c.newPage()));
    await Promise.all(pages.map(p => p.goto(`${origin}/domino/room/${code}`)));
    await pages[initial[0].currentSeat].getByRole('button', { name: 'Jogar pedra 6 e 6', exact: true }).click();
    await expect(pages[0].locator('.domino-chain .domino-stone')).toHaveCount(1);
    let final: any, state = await view(0);
    for (let i = 0; i < 900; i++) {
      if (state.status === 'finished') { final = state; break; }
      if (state.status === 'between') { await pages[0].waitForTimeout(750); state = await view(0); continue; }
      const actor = state.currentSeat, own = await view(actor), move = own.legal.moves[0];
      state = await command(actor, move ? { type: 'play', stoneId: move.id, end: move.ends[0] } : { type: 'pass' }, own);
    }
    expect(final?.status).toBe('finished'); expect(final.scores[final.winner]).toBeGreaterThanOrEqual(100);
    const end = await Promise.all(contexts.map((_, i) => view(i)));
    expect(end.every(v => v.winner === final.winner && JSON.stringify(v.scores) === JSON.stringify(final.scores))).toBeTruthy();
    await Promise.all(pages.map(p => p.reload()));
    await Promise.all(pages.map(p => expect(p.getByRole('region', { name: 'Resultado do dominó' })).toBeVisible()));
    for (let i = 0; i < 4; i++) await command(i, { type: 'rematch' });
    await expect.poll(async () => (await view(0)).scores).toEqual([0, 0]);
    await expect.poll(async () => (await view(0)).status).toBe('playing');
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
