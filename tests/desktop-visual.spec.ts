import { test, expect } from '@playwright/test';

for (const size of [{ width: 1366, height: 768, reducedMotion: 'no-preference' as const }, { width: 1920, height: 1080, reducedMotion: 'no-preference' as const }, { width: 1366, height: 768, reducedMotion: 'reduce' as const }]) {
  test(`desktop ${size.width} ${size.reducedMotion}: distribution, hand and signals in view`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: size.reducedMotion });
    await page.goto(process.env.TRUCO_TEST_URL || 'http://localhost:3000');
    await page.getByLabel('Como te chamam?').fill('Teste desktop');
    await page.getByRole('button', { name: /2 × 2/ }).click();
    await page.getByRole('button', { name: 'Treinar com bots' }).click();
    await page.getByRole('button', { name: 'Estou pronto', exact: true }).click();
    const dealing = page.getByTestId('dealing-animation');
    await expect(dealing).toBeVisible();
    expect(await page.locator('.dealt-card').first().evaluate(e => getComputedStyle(e).animationName)).toBe('deal-card');
    await page.waitForTimeout(770);
    const before = (await page.locator('.dealt-card').first().boundingBox())!;
    await page.waitForTimeout(160);
    const after = (await page.locator('.dealt-card').first().boundingBox())!;
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(2);
    await expect(dealing).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(400);
    const signals = (await page.getByRole('group', { name: 'Sinais da mesa' }).boundingBox())!;
    expect(signals.y + signals.height).toBeLessThan(size.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/desktop-${size.width}.png`, fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.locator('.active-seat .seat-avatar').evaluate(e => getComputedStyle(e).animationName)).toBe('none');
    await page.getByText('Regras da casa', { exact: false }).first().click();
    await page.getByLabel('Animar distribuição de cartas').uncheck();
    await page.reload();
    await page.getByText('Regras da casa', { exact: false }).first().click();
    await expect(page.getByLabel('Animar distribuição de cartas')).not.toBeChecked();
  });
}
