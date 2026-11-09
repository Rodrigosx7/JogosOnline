import { test, expect } from '@playwright/test';

test('dupla só corre com dois votos; aceite do parceiro mantém o truco', async ({ browser }) => {
  const origin = process.env.TRUCO_TEST_URL || 'http://localhost:3000';
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  try {
    const created = await contexts[0].request.post(`${origin}/api/rooms`, { data: { mode: '2x2', name: 'Amigo 0' } });
    expect(created.ok(), await created.text()).toBeTruthy();
    const { code } = await created.json(), endpoint = `${origin}/api/rooms/${code}`;
    const view = async (i: number) => (await contexts[i].request.get(endpoint)).json();
    async function command(i: number, command: any) {
      const state = command.type === 'join' ? { revision: 0 } : await view(i);
      const response = await contexts[i].request.post(endpoint, { data: { command, revision: state.revision, requestId: crypto.randomUUID() } });
      expect(response.ok(), await response.text()).toBeTruthy();
    }
    for (let i = 1; i < 4; i++) await command(i, { type: 'join', name: `Amigo ${i}` });
    for (let i = 0; i < 4; i++) await command(i, { type: 'ready' });
    const pages = await Promise.all(contexts.map(c => c.newPage()));
    await Promise.all(pages.map(p => p.goto(`${origin}/room/${code}`)));
    await Promise.all(pages.map(p => expect(p.getByTestId('dealing-animation')).toBeHidden({ timeout: 10000 })));
    const initial = await view(0), asker = initial.currentSeat, opponents = [0, 1, 2, 3].filter(i => i % 2 !== asker % 2);
    await pages[asker].getByRole('button', { name: /Pedir truco/ }).click();
    await pages[opponents[0]].getByRole('alertdialog').getByRole('button', { name: 'Correr', exact: true }).click();
    await expect(pages[opponents[0]].getByRole('alertdialog')).toContainText('Aguarde seu parceiro');
    await expect(pages[opponents[1]].getByRole('status').filter({ hasText: `Amigo ${opponents[0]}: correu` })).toBeVisible();
    expect((await view(0)).scores).toEqual([0, 0]);
    // This independent browser may still have the old global revision; its decision token is valid.
    await pages[opponents[1]].getByRole('alertdialog').getByRole('button', { name: 'Aceitar 5', exact: true }).click();
    await expect(pages[opponents[0]].getByRole('alertdialog')).toBeHidden();
    await expect(pages[opponents[0]].getByRole('status').filter({ hasText: `Amigo ${opponents[1]}: foi!` })).toBeVisible();
    await expect.poll(async () => (await view(0)).stake).toBe(5);
    const own = await view(asker);
    await command(asker, { type: 'play', cardId: own.hand[0].id });
    const next = (await view(0)).currentSeat;
    await pages[next].getByRole('button', { name: /Pedir seeeis/ }).click();
    await pages[asker].getByRole('alertdialog').getByRole('button', { name: 'Correr', exact: true }).click();
    expect((await view(0)).scores).toEqual([0, 0]);
    const partner = (asker + 2) % 4;
    await pages[partner].getByRole('alertdialog').getByRole('button', { name: 'Correr', exact: true }).click();
    await expect.poll(async () => (await view(0)).scores[next % 2]).toBe(5);
    await expect(pages[asker].getByRole('alertdialog')).toBeHidden();
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
