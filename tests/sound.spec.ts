import { test, expect } from '@playwright/test';

test('table sounds follow events, mute immediately and persist after reload', async ({ browser }) => {
  const origin = process.env.TRUCO_TEST_URL || 'http://localhost:3000';
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const page = await contexts[0].newPage();
    await page.addInitScript(() => {
      const counts = { noise: 0, tone: 0 };
      (window as any).soundCounts = counts;
      const buffer = AudioContext.prototype.createBufferSource;
      AudioContext.prototype.createBufferSource = function () { counts.noise++; return buffer.call(this); };
      const oscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function () { counts.tone++; return oscillator.call(this); };
    });
    const response = await contexts[0].request.post(`${origin}/api/rooms`, { data: { name: 'Som', mode: '1x1' } });
    const { code } = await response.json(), endpoint = `${origin}/api/rooms/${code}`;
    const view = async (i = 0) => (await contexts[i].request.get(endpoint)).json();
    async function command(i: number, command: any) {
      const state = command.type === 'join' ? { revision: 0 } : await view(i);
      const result = await contexts[i].request.post(endpoint, { data: { revision: state.revision, requestId: crypto.randomUUID(), command } });
      expect(result.ok(), await result.text()).toBeTruthy();
    }
    await command(1, { type: 'join', name: 'Amigo' });
    await command(1, { type: 'ready' });
    await page.goto(`${origin}/room/${code}`);
    await page.getByRole('button', { name: 'Estou pronto', exact: true }).click();
    const count = () => page.evaluate(() => (window as any).soundCounts);
    await expect.poll(async () => (await count()).noise).toBe(15);
    await page.getByTestId('dealing-animation').waitFor({ state: 'hidden' });
    const state = await view(), ids = [state.playerId, (await view(1)).playerId];
    const asker = ids.indexOf(state.players.find((p: any) => p.seat === state.currentSeat).id);
    await command(asker, { type: 'raise' });
    await expect.poll(async () => (await count()).tone).toBe(3);
    await page.waitForTimeout(1000);
    expect((await count()).tone).toBe(3);
    await command(1 - asker, { type: 'respond', answer: 'accept' });
    await command(asker, { type: 'play', cardId: (await view(asker)).hand[0].id });
    await expect.poll(async () => (await count()).noise).toBe(16);
    await page.getByRole('button', { name: 'Silenciar sons' }).click();
    await command(1 - asker, { type: 'play', cardId: (await view(1 - asker)).hand[0].id });
    await page.waitForTimeout(1000);
    expect((await count()).noise).toBe(16);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Ativar sons' })).toHaveAttribute('aria-pressed', 'true');
    expect((await count()).noise).toBe(0);
    await page.setViewportSize({ width: 360, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.getByRole('button', { name: 'Ativar sons' }).click();
    await expect(page.getByRole('button', { name: 'Silenciar sons' })).toHaveAttribute('aria-pressed', 'false');
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
