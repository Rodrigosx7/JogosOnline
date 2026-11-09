import { test, expect } from '@playwright/test';
import { FileRoomStore } from '../src/lib/server/storage';
import type { Room } from '../src/lib/game';

for (const kind of ['truco', 'eleven'] as const) for (const answer of ['accept', 'run'] as const) {
  test(`${kind} ${answer}: both players see the decision before the next deal`, async ({ browser }) => {
    const origin = process.env.TRUCO_TEST_URL || 'http://localhost:3000';
    test.skip(!origin.includes('localhost:3002'), 'Isolated decision fixture.');
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    try {
      const created = await contexts[0].request.post(`${origin}/api/rooms`, { data: { mode: '1x1', name: 'Pessoa 0' } });
      const { code } = await created.json(), endpoint = `${origin}/api/rooms/${code}`;
      const view = async (i = 0) => (await contexts[i].request.get(endpoint)).json();
      async function command(i: number, command: any) {
        const state = command.type === 'join' ? { revision: 0 } : await view(i);
        const response = await contexts[i].request.post(endpoint, { data: { command, revision: state.revision, requestId: crypto.randomUUID() } });
        expect(response.ok(), await response.text()).toBeTruthy();
      }
      await command(1, { type: 'join', name: 'Pessoa 1' });
      await command(0, { type: 'ready' }); await command(1, { type: 'ready' });
      const store = new FileRoomStore(), stored = (await store.get<Room>(code))!;
      const state = stored.document.state;
      state.handStartedAt = Date.now() - 20000; state.currentSeat = 0;
      if (kind === 'eleven') { state.scores = [11, 0]; state.eleven = { id: crypto.randomUUID(), teams: [0], accepted: [] }; }
      state.revision++;
      expect(await store.compareAndSwap(code, stored.version, stored.document)).toBeTruthy();
      const pages = await Promise.all(contexts.map(c => c.newPage()));
      await Promise.all(pages.map(page => page.goto(`${origin}/room/${code}`)));
      const hand = state.handNumber;
      if (kind === 'truco') {
        await pages[0].getByRole('button', { name: 'Pedir truco', exact: true }).click();
        await pages[1].getByRole('alertdialog').getByRole('button', { name: answer === 'accept' ? 'Aceitar 5' : 'Correr', exact: true }).click();
      } else {
        await pages[0].getByRole('button', { name: answer === 'accept' ? 'Jogar por 5 tentos' : 'Correr e entregar 3 tentos', exact: true }).click();
      }
      const noticeId = kind === 'truco' ? 'truco-decision-notice' : 'eleven-notice';
      await Promise.all(pages.map(page => expect(page.getByTestId(noticeId)).toContainText(answer === 'accept' ? 'Aceitou' : 'Correu')));
      if (answer === 'run') {
        await expect(pages[0].getByTestId('dealing-animation')).toBeHidden();
        await expect(pages[0].getByTestId('dealing-animation')).toBeVisible({ timeout: 4000 });
        await expect(pages[0].getByTestId(noticeId)).toBeHidden();
        expect((await view()).handNumber).toBe(hand + 1);
      } else {
        await expect(pages[0].getByTestId('dealing-animation')).toBeHidden();
        expect((await view()).handNumber).toBe(hand);
      }
    } finally { await Promise.all(contexts.map(context => context.close())); }
  });
}
