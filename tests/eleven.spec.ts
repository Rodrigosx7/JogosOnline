import { test, expect, type BrowserContext } from '@playwright/test';
import { FileRoomStore } from '../src/lib/server/storage';
import { applyCommand, type Room } from '../src/lib/game';

const origin = process.env.TRUCO_TEST_URL || 'http://localhost:3000';
for (const mode of ['1x1', '2x2'] as const) test(`mão de 11 ${mode}: sigilo, decisões e derrota por truco`, async ({ browser }) => {
  test.skip(!/localhost:3002/.test(origin), 'Fixture isolada apenas no servidor local de testes.');
  const contexts: BrowserContext[] = [];
  try {
    for (let i = 0; i < (mode === '1x1' ? 2 : 4); i++) contexts.push(await browser.newContext());
    const created = await contexts[0].request.post(`${origin}/api/rooms`, { data: { mode, name: 'Pessoa 0' } });
    expect(created.ok(), await created.text()).toBeTruthy();
    const { code } = await created.json();
    const endpoint = `${origin}/api/rooms/${code}`;
    async function view(i: number) { return (await contexts[i].request.get(endpoint)).json(); }
    async function command(i: number, cmd: any, revision?: number) {
      const state = await view(i);
      return contexts[i].request.post(endpoint, { data: { command: cmd, revision: revision ?? state.revision, requestId: crypto.randomUUID() } });
    }
    for (let i = 1; i < contexts.length; i++) expect((await command(i, { type: 'join', name: `Pessoa ${i}` }, 0)).ok()).toBeTruthy();
    for (let i = 0; i < contexts.length; i++) expect((await command(i, { type: 'ready' })).ok()).toBeTruthy();
    const store = new FileRoomStore();
    const stored = (await store.get<Room>(code))!;
    let state = stored.document.state;
    state.scores = [9, 0]; state.currentSeat = 1;
    state = applyCommand(state, state.players.find(p => p.seat === 1)!.id, { type: 'run' }, Date.now());
    if (state.runRequest) state = applyCommand(state, state.players.find(p => p.seat === 3)!.id, { type: 'run-response', answer: 'run' }, Date.now());
    expect(await store.compareAndSwap(code, stored.version, { state, requests: stored.document.requests })).toBeTruthy();
    const pages = await Promise.all(contexts.map(c => c.newPage()));
    await Promise.all(pages.map(p => p.goto(`${origin}/room/${code}`)));
    await Promise.all(pages.map(p => expect(p.getByTestId('eleven-decision')).toBeVisible({ timeout: 15000 })));
    await Promise.all(pages.map(p => expect(p.getByTestId('dealing-animation')).toBeHidden({ timeout: 10000 })));
    const views = await Promise.all(contexts.map((_, i) => view(i)));
    for (let i = 0; i < contexts.length; i++) {
      expect(views[i].scores).toEqual([11, 0]);
      expect(views[i].legal.play).toBe(false);
      const partner = views[i].partnerHands;
      const allowed = mode === '2x2' && views[i].players.find((p: any) => p.id === views[i].playerId).seat % 2 === 0;
      expect(partner).toHaveLength(allowed ? 1 : 0);
      if (!allowed) await expect(pages[i].getByRole('region', { name: 'Cartas do parceiro' })).toHaveCount(0);
      if (allowed) {
        expect(partner[0].cards).toEqual(views[(i + 2) % 4].hand);
        expect(partner[0].playerId).not.toBe(views[(i + 1) % 4].playerId);
        await expect(pages[i].getByRole('region', { name: 'Cartas do parceiro' }).locator('.playing-card')).toHaveCount(3);
        await expect(pages[i].locator('.table-seat.seat-2').getByRole('region', { name: 'Cartas do parceiro' })).toHaveCount(1);
        await expect(pages[i].locator('.room-main > .partner-hands')).toHaveCount(0);
      }
    }
    if (mode === '2x2') {
      await pages[0].setViewportSize({ width: 390, height: 844 });
      expect(await pages[0].evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    }
    await pages[0].screenshot({ path: `test-results/eleven-decision-${mode}.png`, fullPage: true });
    // A run vote waits for the partner; a play vote starts the hand.
    if (mode === '2x2') {
      await pages[0].getByRole('button', { name: 'Correr e entregar 3 tentos' }).click();
      await expect(pages[0].getByTestId('eleven-decision')).toContainText('Aguarde seu parceiro');
      expect((await view(0)).scores).toEqual([11, 0]);
      await expect(pages[2].getByText('Seu parceiro votou em correr. Você ainda pode jogar.', { exact: true })).toBeVisible();
      await pages[2].getByRole('button', { name: 'Jogar por 5 tentos' }).click();
    } else await pages[0].getByRole('button', { name: 'Jogar por 5 tentos' }).click();
    await expect.poll(async () => (await view(0)).stake).toBe(5);
    await expect(pages[0].getByText('Na mão de 11, pedir truco perde a partida.', { exact: true })).toHaveCount(0);
    const playing = await view(0);
    const actor = views.findIndex(v => v.playerId === playing.players.find((p: any) => p.seat === playing.currentSeat).id);
    expect((await view(actor)).partnerHands).toEqual([]);
    if (playing.currentSeat % 2 === 1) {
      await expect(pages[actor].locator('.hand-truco')).toHaveCount(0);
      await pages[actor].getByTestId('hand-card').first().click();
      const next = (await view(0)).currentSeat;
      await pages[next].getByRole('button', { name: 'Pedir truco', exact: true }).click();
    } else await pages[actor].getByRole('button', { name: 'Pedir truco', exact: true }).click();
    await Promise.all(pages.map(p => expect(p.getByRole('heading', { name: 'Boa partida. Mais uma?' })).toBeVisible()));
    const final = await view(0);
    expect(final.winner).toBe(1);
    await expect(pages[0].getByRole('region', { name: 'Resultado da partida' })).toContainText('Entregou a paçoca');
    await expect(pages[1].getByRole('region', { name: 'Resultado da partida' })).toContainText('Vitória de presente');
    expect(final.history.at(-1)).toContain('pediu truco na mão de 11 e perdeu');
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
