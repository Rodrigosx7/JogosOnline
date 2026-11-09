import { test, expect } from '@playwright/test';

test('treino 2x2 com três bots, sinais e confirmação do parceiro', async ({ page, context }) => {
  const origin = process.env.TRUCO_TEST_URL || 'http://localhost:3000';
  await page.goto(origin);
  await page.getByLabel('Como te chamam?').fill('Treinador');
  await page.getByRole('button', { name: /2 × 2/ }).click();
  await page.getByRole('button', { name: 'Treinar com bots' }).click();
  await expect(page).toHaveURL(/\/room\/[A-Za-z0-9_-]+$/);
  await expect(page.getByText('Bot parceiro', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Estou pronto', exact: true }).click();
  await expect(page.getByTestId('dealing-animation')).toBeVisible();
  await expect(page.getByTestId('dealing-animation')).toBeHidden({ timeout: 10000 });
  const endpoint = `${origin}/api/rooms/${page.url().split('/').pop()}`;
  const view = async () => (await context.request.get(endpoint)).json();
  const started = await view();
  expect(started.mode).toBe('2x2');
  expect(started.players.filter((p: any) => p.isBot)).toHaveLength(3);
  expect(started.players.find((p: any) => p.name === 'Bot parceiro').seat).toBe(2);
  await expect(page.getByRole('heading', { name: 'Conversa da mesa', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Chat da sala', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sinalizar Zap', exact: true }).click();
  await expect.poll(async () => (await view()).signals.some((s: any) => s.kind === 'ack' && s.playerId !== started.playerId)).toBe(true);
  await expect(page.getByLabel('Bot parceiro sinalizou 👍')).toContainText('👍');
  const state = await view();
  const partner = state.players.find((p: any) => p.name === 'Bot parceiro');
  expect(state.signals.some((s: any) => s.playerId === partner.id && s.kind === 'ack')).toBeTruthy();
  await page.screenshot({ path: 'test-results/duo-bot-signals.png', fullPage: true });
  // The three different bots act, while human bids and card plays remain available.
  for (let i = 0; i < 60; i++) {
    const state = await view();
    if (state.players.filter((p: any) => p.isBot).every((p: any) => state.history.some((line: string) => line.includes(`${p.name} jogou`)))) break;
    const command = state.legal.respond ? { type: 'respond', answer: 'accept' } : state.legal.eleven ? { type: 'eleven', answer: 'play' } : state.legal.play ? { type: 'play', cardId: state.hand[0].id } : null;
    if (command) {
      const response = await context.request.post(endpoint, { headers: { Origin: origin }, data: { command, revision: state.revision, requestId: crypto.randomUUID() } });
      expect([200, 409]).toContain(response.status());
    }
    await page.waitForTimeout(750);
  }
  const final = await view();
  for (const bot of final.players.filter((p: any) => p.isBot)) expect(final.history.some((line: string) => line.includes(`${bot.name} jogou`))).toBeTruthy();
});
