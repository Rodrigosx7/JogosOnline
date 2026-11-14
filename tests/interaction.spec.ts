import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const origin = process.env.TRUCO_TEST_URL || 'http://127.0.0.1:3000';

for (const mode of ['1x1', '2x2'] as const) {
  test(`cliques reais ${mode}: distribuição, truco e mesa compartilhada`, async ({ browser }) => {
    const count = mode === '1x1' ? 2 : 4;
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    try {
      for (let i = 0; i < count; i++) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        contexts.push(context); pages.push(await context.newPage());
      }
      const owner = pages[0];
      await owner.goto(origin);
      await owner.getByLabel('Como te chamam?').fill('Amigo 1');
      if (mode === '2x2') await owner.getByRole('button', { name: /2 × 2/ }).click();
      await owner.getByRole('button', { name: /Criar minha mesa/ }).click();
      await expect(owner).toHaveURL(/\/room\/[A-Za-z0-9_-]{18,64}$/);
      const url = owner.url(), code = url.split('/').pop()!;
      for (let i = 1; i < count; i++) {
        await pages[i].goto(url);
        await pages[i].getByLabel('Como te chamam?').fill(`Amigo ${i + 1}`);
        await pages[i].getByRole('button', { name: 'Entrar na mesa', exact: true }).click();
        await expect(pages[i].getByRole('button', { name: 'Estou pronto', exact: true })).toBeVisible();
      }
      async function view(i: number): Promise<any> {
        const response = await contexts[i].request.get(`${origin}/api/rooms/${code}`);
        expect(response.ok(), await response.text()).toBeTruthy();
        return response.json();
      }
      // Readying happens through the real buttons. Reload ensures each revision is current.
      for (let i = 0; i < count; i++) {
        await pages[i].reload();
        await pages[i].getByRole('button', { name: 'Estou pronto', exact: true }).click();
        if (i < count - 1) await expect(pages[i].getByRole('button', { name: /Você está pronto/ })).toBeVisible();
      }
      await Promise.all(pages.map(page => expect(page.getByTestId('dealing-animation')).toBeVisible({timeout:6000})));
      await expect(owner.locator('.dealt-card')).toHaveCount(count * 3);
      for(let seat=0;seat<count;seat++) await expect(owner.locator(`[data-deal-seat="${seat}"]`)).toHaveCount(3);
      expect(await owner.locator('.felt-table').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(500);
      await owner.waitForTimeout(1400);
      await owner.screenshot({path:`test-results/distribution-${mode}.png`,fullPage:true});
      await expect(pages[count - 1].getByTestId('dealing-animation')).toBeHidden({ timeout: 8000 });
      const identities = await Promise.all(contexts.map((_, i) => view(i)));
      const indexAt = (state: any) => identities.findIndex(v => v.playerId === state.players.find((p: any) => p.seat === state.currentSeat).id);
      let state = await view(0);
      expect(state.handStartedAt).toBeGreaterThan(0);

      // Request and accept truco using the interface; every client sees its central overlay.
      const raiser = indexAt(state);
      await expect(pages[raiser].getByRole('button', { name: /Pedir truco/ })).toBeEnabled();
      await pages[raiser].getByRole('button', { name: /Pedir truco/ }).click();
      await Promise.all(pages.map(page => expect(page.getByTestId('truco-overlay')).toBeVisible()));
      state = await view(raiser);
      const responder = identities.findIndex(v => v.players.find((p: any) => p.id === v.playerId).seat % 2 !== state.pending.team);
      await pages[responder].getByRole('button', { name: 'Aceitar 5', exact: true }).first().click();
      await Promise.all(pages.map(page => expect(page.getByTestId('truco-overlay')).toBeHidden()));

      async function clickCurrent(covered = false) {
        state = await view(0);
        const index = indexAt(state), page = pages[index];
        const mine = await view(index), card = mine.hand[0];
        const button = page.locator(`[data-testid="hand-card"][data-card-id="${card.id}"]`);
        await expect(button).toBeEnabled({ timeout: 8000 });
        if (covered) await page.getByLabel('Jogar encoberta', { exact: true }).check();
        await expect(page.getByRole('button', { name: 'Jogar carta', exact: true })).toHaveCount(0);
        const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/api/rooms/${code}`));
        await button.click();
        const response = await responsePromise;
        expect(response.ok(), await response.text()).toBeTruthy();
        const command = response.request().postDataJSON().command;
        expect(command).toEqual({ type: 'play', cardId: card.id, covered });
        state = await response.json();
        return { index, card, state };
      }

      for (let played = 1; played <= count; played++) {
        await clickCurrent();
        await Promise.all(pages.map(page => expect(page.getByTestId('table-card')).toHaveCount(played)));
        if (played < count) {
          expect(state.collecting).toBe(false);
          const lastSeat = state.trick.at(-1).seat;
          expect(state.currentSeat).toBe((lastSeat + 1) % count);
          if (count === 4) {
            const viewer = pages[identities.findIndex(view => view.players.some((p: any) => p.id === view.playerId && p.seat === lastSeat))];
            const nextX = (await viewer.locator('.table-seat.seat-3').boundingBox())!.x;
            const ownX = (await viewer.locator('.table-seat.seat-0').boundingBox())!.x;
            expect(nextX).toBeGreaterThan(ownX);
            await expect(viewer.locator('.table-seat.seat-3')).toHaveClass(/active-seat/);
          }
        }
        for(let i=0;i<count;i++){ const self=identities[i].players.find((p:any)=>p.id===identities[i].playerId); for(const play of state.trick){ await expect(pages[i].locator(`[data-testid="played-card"][data-seat="${play.seat}"]`)).toHaveAttribute('data-relative-seat',String((self.seat-play.seat+count)%count)); }}
      }
      expect(state.collecting).toBe(true);
      expect(state.trick).toHaveLength(count);
      expect(state.tableUntil - state.serverTime).toBe(2500);
      expect(state.legal.play).toBe(false);
      // Exact end-of-window visibility is checked locally; a remote response can
      // arrive after that boundary. Public runs already checked every client above.
      if (new URL(origin).hostname === 'localhost' || new URL(origin).hostname === '127.0.0.1') {
        await owner.waitForTimeout(Math.max(0, state.tableUntil - Date.now() - 400));
        await Promise.all(pages.map(async page => {
          await expect(page.getByTestId('table-card')).toHaveCount(count);
          for (const card of await page.getByTestId('table-card').all()) await expect(card).toBeVisible();
        }));
      }
      await expect.poll(async () => { state = await view(0); return state.collecting; }, { timeout: 8000, intervals: [100, 200, 400] }).toBe(false);
      expect(state.collecting).toBe(false);
      expect(state.trickNumber).toBe(2);
      await Promise.all(pages.map(page => expect(page.getByTestId('table-card')).toHaveCount(0)));
      await Promise.all(pages.map(page => expect(page.locator('.table-tricks,.table-trick')).toHaveCount(0)));
      expect(state.tableTricks.flatMap((t: any) => t.plays)).toHaveLength(count);

      const coveredPlay = await clickCurrent(true);
      await Promise.all(pages.map(page => expect(page.getByTestId('table-card')).toHaveCount(1)));
      await Promise.all(pages.map(page => expect(page.locator('[data-testid="played-card"][data-covered="true"]')).toHaveCount(1)));
      for (let i = 0; i < count; i++) {
        const current = await view(i);
        expect(current.trick).toHaveLength(1);
        expect(current.trick[0].covered).toBe(true);
        expect(current.trick[0].card).toBeNull();
        const suitName: Record<string, string> = { clubs: 'paus', hearts: 'copas', spades: 'espadas', diamonds: 'ouros' };
        expect(current.history.join(' ')).not.toContain(`${coveredPlay.card.rank} de ${suitName[coveredPlay.card.suit]}`);
        const hidden = pages[i].locator('[data-testid="played-card"][data-covered="true"]');
        await expect(hidden.getByLabel('Carta fechada', { exact: true })).toBeVisible();
        expect(await hidden.textContent()).not.toContain(coveredPlay.card.id);
      }
      await owner.screenshot({path: `test-results/hand-table-${mode}.png`,fullPage:true});
      await owner.setViewportSize({width:390,height:880});
      expect(await owner.locator('.felt-table').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(400);
      expect(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
      await owner.screenshot({path:`test-results/table-mobile-${mode}.png`,fullPage:true});
    } finally {
      await Promise.all(contexts.map(context => context.close()));
    }
  });
}
