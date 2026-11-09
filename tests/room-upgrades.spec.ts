import { test, expect, type BrowserContext } from '@playwright/test';
import { FileRoomStore } from '../src/lib/server/storage';
import type { Room } from '../src/lib/game';

const origin = process.env.TRUCO_TEST_URL || 'http://localhost:3000';
test('lobby central, mesa de bar, espectadores, remoção e corrida por consenso', async ({ browser }) => {
  test.skip(!origin.includes('localhost:3002'), 'Isolated room fixture.');
  const contexts: BrowserContext[] = [];
  try {
    for (let i = 0; i < 6; i++) contexts.push(await browser.newContext());
    const response = await contexts[0].request.post(`${origin}/api/rooms`, { data: { name: 'Amigo 0', mode: '2x2', tableTheme: 'skol' } });
    expect(response.ok()).toBeTruthy();
    const { code } = await response.json(), endpoint = `${origin}/api/rooms/${code}`;
    const view = async (i: number) => { const result = await contexts[i].request.get(endpoint); expect(result.ok(), await result.text()).toBeTruthy(); return result.json(); };
    async function command(i: number, cmd: any, joining = false) {
      const state = joining ? { revision: 0 } : await view(i);
      const result = await contexts[i].request.post(endpoint, { data: { command: cmd, revision: state.revision, requestId: crypto.randomUUID() } });
      expect(result.ok(), await result.text()).toBeTruthy(); return result.json();
    }
    for (let i = 1; i < 4; i++) await command(i, { type: 'join', name: `Amigo ${i}` }, true);
    await command(4, { type: 'watch', name: 'Visitante' }, true);
    await command(5, { type: 'watch', name: 'Removido' }, true);
    await command(0, { type: 'kick', targetId: (await view(5)).playerId });
    expect((await contexts[5].request.get(endpoint)).status()).toBe(403);
    // Exchange a player and a spectator before starting; preserve each browser's identity.
    await command(1, { type: 'watch' });
    await command(4, { type: 'seat', seat: 1 });
    expect((await view(1)).isSpectator).toBe(true);
    const seated = await view(4); expect(seated.players.find((p: any) => p.id === seated.playerId).seat).toBe(1);
    const page = await contexts[0].newPage();
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${origin}/room/${code}`);
    await expect(page.locator('.theme-skol')).toBeVisible();
    const ready = page.getByRole('button', { name: 'Estou pronto', exact: true });
    await expect(ready).toBeVisible();
    expect(await ready.evaluate(e => !!e.closest('.felt-table'))).toBe(true);
    const felt = (await page.locator('.felt-table').boundingBox())!, button = (await ready.boundingBox())!;
    expect(Math.abs(felt.x + felt.width / 2 - button.x - button.width / 2)).toBeLessThan(5);
    await page.screenshot({ path: 'test-results/skol-lobby-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(ready).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/skol-lobby-mobile.png' });
    await ready.click();
    await expect(page.locator('.lobby-readiness .is-ready')).toContainText('Amigo 0');
    for (const i of [4, 2, 3]) await command(i, { type: 'ready' });
    await expect(page.locator('.room-is-playing')).toBeVisible();
    await expect(page.getByTestId('dealing-animation')).toBeHidden({ timeout: 10000 });
    const spectatorPage = await contexts[1].newPage();
    await spectatorPage.goto(`${origin}/room/${code}`);
    const watching = await view(1);
    expect(watching.hand).toEqual([]); expect(watching.partnerHands).toEqual([]);
    expect(Object.values(watching.legal).every(value => !value)).toBe(true);
    await expect(spectatorPage.locator('.your-hand')).toHaveCount(0);
    await expect(spectatorPage.getByRole('button', { name: 'Sair da sala', exact: true })).toBeVisible();
    const state = await view(0), actorId = state.players.find((p: any) => p.seat === state.currentSeat).id;
    const views = await Promise.all([0, 2, 3, 4].map(async i => ({ i, view: await view(i) })));
    const actor = views.find(v => v.view.playerId === actorId)!.i;
    const partnerId = state.players.find((p: any) => p.seat === (state.currentSeat + 2) % 4).id;
    const partner = views.find(v => v.view.playerId === partnerId)!.i;
    const actorPage = actor === 0 ? page : await contexts[actor].newPage();
    if (actor !== 0) await actorPage.goto(`${origin}/room/${code}`);
    await expect(actorPage.getByText('Sua vez! Escolha uma carta.', { exact: true })).toBeVisible();
    await command(actor, { type: 'run' });
    expect((await view(0)).scores).toEqual([0, 0]);
    const partnerPage = partner === 0 ? page : await contexts[partner].newPage();
    if (partner !== 0) await partnerPage.goto(`${origin}/room/${code}`);
    await expect(partnerPage.getByRole('alertdialog', { name: 'Decisão de correr' })).toContainText('Seu parceiro quer correr');
    await partnerPage.getByRole('button', { name: 'Jogar', exact: true }).click();
    await expect.poll(async () => (await view(0)).runRequest).toBeNull();
    expect((await view(0)).scores).toEqual([0,0]);
    await page.screenshot({ path: 'test-results/skol-playing-mobile.png' });
  } finally { await Promise.all(contexts.map(c => c.close())); }
});

test('capar onze-três e encerrar com resultado sem placar final fictício', async ({ browser }) => {
  test.skip(!origin.includes('localhost:3002'), 'Isolated room fixture.');
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const response = await contexts[0].request.post(`${origin}/api/rooms`, { data: { name: 'Amigo', mode: '1x1' } });
    const { code } = await response.json(), endpoint = `${origin}/api/rooms/${code}`;
    async function command(i: number, cmd: any) {
      const before = await contexts[i].request.get(endpoint);
      const state = before.ok() ? await before.json() : { revision: 0 };
      const result = await contexts[i].request.post(endpoint, { data: { command: cmd, revision: state.revision, requestId: crypto.randomUUID() } });
      expect(result.ok(), await result.text()).toBeTruthy();
    }
    await command(1, { type:'join',name:'Outro' }); await command(0,{type:'ready'});await command(1,{type:'ready'});
    const store = new FileRoomStore(), stored = (await store.get<Room>(code))!;
    Object.assign(stored.document.state, { scores:[11,3], eleven:{id:crypto.randomUUID(),teams:[0],accepted:[]}, handStartedAt:Date.now()-20000,currentSeat:0 });
    stored.document.state.revision++;
    expect(await store.compareAndSwap(code,stored.version,stored.document)).toBe(true);
    const page = await contexts[1].newPage(); await page.goto(`${origin}/room/${code}`);
    await page.getByRole('button',{name:'Capar · jogar por 5 tentos',exact:true}).click();
    await expect(page.getByTestId('eleven-decision')).toBeHidden();
    const current=(await store.get<Room>(code))!;
    expect(current.document.state.stake).toBe(5);expect(current.document.state.eleven!.forced).toBe(true);
    Object.assign(current.document.state,{status:'finished',winner:1,scores:[11,11],deadline:null});current.document.state.revision++;
    expect(await store.compareAndSwap(code,current.version,current.document)).toBe(true);
    await expect(page.getByRole('region',{name:'Resultado da partida'})).toContainText('Sua equipe venceu');
    await expect(page.getByText('Placar final:',{exact:false})).toHaveCount(0);
    await expect(page.locator('.score-panel')).toBeHidden();
  } finally {await Promise.all(contexts.map(c=>c.close()));}
});
