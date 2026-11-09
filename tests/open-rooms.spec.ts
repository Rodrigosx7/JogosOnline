import { test, expect } from '@playwright/test';

test('find and join a listed room without entering its code; private rooms stay hidden', async ({ browser }) => {
  const origin = process.env.TRUCO_TEST_URL || 'http://localhost:3000';
  const host = await browser.newContext(), guest = await browser.newContext();
  try {
    const page = await host.newPage(); await page.goto(origin);
    await page.getByLabel('Como te chamam?').fill('Anfitrião visível');
    await expect(page.getByLabel('Mostrar na lista de salas abertas')).toBeChecked();
    await page.getByRole('button', { name: /Criar minha mesa/ }).click();
    await expect(page).toHaveURL(/\/room\/[A-Za-z0-9_-]+$/);
    const code = page.url().split('/').pop()!;
    await expect(page.locator('.room-kicker')).toHaveCount(0);
    await expect(page.locator('.one-click-hint')).toHaveCount(0);
    await expect(page.locator('.room-footer')).toHaveCount(0);
    const privateRoom = await host.request.post(`${origin}/api/rooms`, { data: { mode: '1x1', name: 'Sala privada' } });
    const hidden = await privateRoom.json();
    const visitor = await guest.newPage(); await visitor.goto(origin);
    const room = visitor.locator(`[data-room-code="${code}"]`);
    await expect(room).toBeVisible(); await expect(room).toContainText('Anfitrião visível');
    await expect(visitor.locator(`[data-room-code="${hidden.code}"]`)).toHaveCount(0);
    await visitor.setViewportSize({ width: 390, height: 844 });
    expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await visitor.screenshot({ path: 'test-results/open-rooms-mobile.png', fullPage: true });
    await room.getByRole('link', { name: 'Entrar', exact: true }).click();
    await visitor.getByLabel('Como te chamam?').fill('Amigo entrando');
    await visitor.getByRole('button', { name: 'Entrar na mesa', exact: true }).click();
    await expect(visitor.getByRole('button', { name: 'Estou pronto', exact: true })).toBeVisible();
    const listing = await (await guest.request.get(`${origin}/api/rooms`)).json();
    expect(listing.rooms.some((r: any) => r.code === code)).toBe(false);
  } finally { await host.close(); await guest.close(); }
});
