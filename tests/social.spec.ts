import { test, expect } from '@playwright/test';

test('chat da sala e sinais visíveis para todos em sessões independentes', async ({ browser }) => {
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
    const before = await view(0);
    await pages[0].getByLabel('Mensagem para todos da sala').fill('Oi <b>mesa</b>!');
    await pages[0].getByLabel('Mensagem para todos da sala').press('Enter');
    await Promise.all(pages.map(p => expect(p.getByRole('log')).toContainText('Oi <b>mesa</b>!')));
    await expect(pages[0].getByRole('log').locator('b')).toHaveCount(0);
    expect((await view(0)).revision).toBe(before.revision);
    await pages[0].getByRole('button', { name: 'Sinalizar Zap', exact: true }).click();
    await Promise.all(pages.map(p => expect(p.getByTestId('private-signal')).toContainText('😉')));
    await Promise.all(pages.map(p => expect(p.getByTestId('private-signal')).toHaveCount(0, { timeout: 4000 })));
    await pages[2].setViewportSize({ width: 390, height: 844 });
    await pages[2].getByRole('group', { name: 'Sinais da mesa' }).scrollIntoViewIfNeeded();
    expect(await pages[2].evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await pages[2].screenshot({ path: 'test-results/chat-signals-mobile.png', fullPage: true });
    await expect(pages[0].getByLabel('Mensagem para todos da sala')).toHaveValue('');
    await pages[0].screenshot({ path: 'test-results/chat-signals-desktop.png', fullPage: true });
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
