import { test, expect } from '@playwright/test';

test('treino com bot: criar, jogar, recarregar e terminar partida', async ({ page, context }) => {
  const origin = process.env.TRUCO_TEST_URL || 'http://localhost:3000';
  await page.goto(origin);
  await page.getByLabel('Como te chamam?').fill('Treinador');
  await page.getByRole('button', { name: /Treinar contra bot/ }).click();
  await expect(page).toHaveURL(/\/room\/[A-Za-z0-9_-]+$/);
  await expect(page.getByText('Bot da casa', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Estou pronto', exact: true }).click();
  await expect(page.getByTestId('dealing-animation')).toBeVisible();
  await expect(page.getByTestId('dealing-animation')).toBeHidden({ timeout: 10000 });
  const endpoint = `${origin}/api/rooms/${page.url().split('/').pop()}`;
  let state: any;
  let sawBotPlay = false;
  for (let i = 0; i < 250; i++) {
    const response = await context.request.get(endpoint);
    expect(response.ok(), await response.text()).toBeTruthy();
    state = await response.json();
    expect(state).not.toHaveProperty('hands');
    const bot = state.players.find((p: any) => p.isBot);
    sawBotPlay ||= state.history.some((line: string) => line.includes('Bot da casa jogou'));
    expect(bot).toBeTruthy();
    if (state.status === 'finished') break;
    if (state.legal.play || state.legal.respond || state.legal.eleven) {
      const command = state.legal.eleven ? { type: 'eleven', answer: 'play' } : state.legal.respond ? { type: 'respond', answer: 'accept' } : { type: 'play', cardId: state.hand[0].id };
      const played = await context.request.post(endpoint, { headers: { Origin: origin }, data: { command, revision: state.revision, requestId: crypto.randomUUID() } });
      expect([200, 409]).toContain(played.status());
    }
    if (i === 3) await page.reload();
    await page.waitForTimeout(750);
  }
  expect(sawBotPlay).toBeTruthy();
  expect(state.status).toBe('finished');
  await page.reload();
  const againLabel = state.winner === state.players.find((p: any) => p.id === state.playerId).seat % 2 ? 'Jogar novamente' : 'Pedir revanche';
  await expect(page.getByRole('button', { name: againLabel, exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/bot-finished.png', fullPage: true });
  await page.getByRole('button', { name: againLabel, exact: true }).click();
  await expect(page.getByTestId('dealing-animation')).toBeVisible();
  await page.screenshot({ path: 'test-results/bot-rematch.png', fullPage: true });
});
