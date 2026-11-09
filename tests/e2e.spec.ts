import {test,expect} from '@playwright/test';
const origin=process.env.TRUCO_TEST_URL||'http://127.0.0.1:3000';
for(const mode of ['1x1','2x2']) test(`partida completa ${mode}, privacidade e revanche`,async({browser})=>{
 const count=mode==='1x1'?2:4; const contexts=await Promise.all(Array.from({length:count},()=>browser.newContext()));
 const api=contexts.map(c=>c.request);const base=origin;
 const created=await api[0].post(base+'/api/rooms',{data:{mode,name:'Jogador 1'}});expect(created.ok(),await created.text()).toBeTruthy();const {code}=await created.json();
 async function view(i:number){const r=await api[i].get(`${base}/api/rooms/${code}`);expect(r.ok(),await r.text()).toBeTruthy();return r.json();}
 async function cmd(i:number,command:any,known?:any){const v=known??await view(i);const r=await api[i].post(`${base}/api/rooms/${code}`,{data:{command,revision:v.revision,requestId:crypto.randomUUID()}});expect(r.ok(),await r.text()).toBeTruthy();return r.json();}
 for(let i=1;i<count;i++){const r=await api[i].post(`${base}/api/rooms/${code}`,{data:{command:{type:'join',name:`Jogador ${i+1}`},revision:0,requestId:crypto.randomUUID()}});expect(r.ok(),await r.text()).toBeTruthy();}
 const outsider=await browser.newContext();expect((await outsider.request.get(`${base}/api/rooms/${code}`)).status()).toBe(403);await outsider.close();
 for(let i=0;i<count;i++)await cmd(i,{type:'ready'});
 let state=await view(0);expect(state.status).toBe('playing');expect(state.stake).toBe(3);
 const all=await Promise.all(api.map((_,i)=>view(i)));const ids=all.flatMap(v=>v.hand.map((c:any)=>c.id));expect(new Set(ids).size).toBe(count*3);
 for(const v of all){expect(v.hand).toHaveLength(3);expect(v.deck).toBeUndefined();expect(v.hands).toBeUndefined();expect(v.players.every((p:any)=>!p.hand)).toBeTruthy();}
 const page=await contexts[0].newPage();await page.goto(`${base}/room/${code}`);await expect(page.locator('body')).toContainText('Truco');await page.screenshot({path:`test-results/mesa-${mode}.png`,fullPage:true});
 for(let step=0;step<200&&state.status==='playing';step++){
  if(state.collecting){await new Promise(resolve=>setTimeout(resolve,Math.max(0,state.tableUntil-Date.now())+75));state=await view(0);if(state.status!=='playing')break;}
  if(state.eleven?.deciding){const team=state.eleven.teams.find((t:number)=>!state.eleven.accepted.includes(t));const index=all.findIndex(v=>v.players.find((p:any)=>p.id===v.playerId).seat%2===team);state=await cmd(index,{type:'eleven',answer:'play'});continue;}
  const player=state.players.find((p:any)=>p.seat===state.currentSeat);const index=all.findIndex(v=>v.playerId===player.id);
  expect(index).toBeGreaterThanOrEqual(0);const mine=await view(index);expect(mine.hand.length).toBeGreaterThan(0);state=await cmd(index,{type:'play',cardId:mine.hand[0].id,covered:false},mine);
 }
 expect(state.status).toBe('finished');expect(state.scores[state.winner]).toBe(11); expect(state.scores.every((score: number) => [0, 3, 5, 7, 9, 11].includes(score))).toBeTruthy();
 await expect(page.getByRole('heading',{name:'Boa partida. Mais uma?',exact:true})).toBeVisible({timeout:10000});expect(await page.getByTestId('table-card').count()).toBeGreaterThan(0);
 for(let i=0;i<count;i++)expect((await view(i)).scores).toEqual(state.scores);
 for(let i=0;i<count;i++)await cmd(i,{type:'rematch'});state=await view(0);expect(state.status).toBe('playing');expect(state.scores).toEqual([0,0]);
 await Promise.all(contexts.map(c=>c.close()));
});
test('início responsivo',async({page})=>{await page.goto(origin);await expect(page.locator('h1')).toBeVisible();await page.screenshot({path:'test-results/home-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/home-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();});
test('API: idempotência, revisão e cookie adulterado',async({browser})=>{
 const c=await browser.newContext();const base=origin+'/api/rooms';const created=await c.request.post(base,{data:{mode:'1x1',name:'Teste segurança'}});expect(created.ok()).toBeTruthy();const {code}=await created.json();const url=base+'/'+code;const initial=await (await c.request.get(url)).json();const body={command:{type:'ready'},revision:initial.revision,requestId:crypto.randomUUID()};
 const a=await c.request.post(url,{data:body});expect(a.ok()).toBeTruthy();const first=await a.json();const b=await c.request.post(url,{data:body});expect(b.ok()).toBeTruthy();const second=await b.json();expect(second.revision).toBe(first.revision);expect(second.players[0].ready).toBe(true);
 const stale=await c.request.post(url,{data:{...body,requestId:crypto.randomUUID()}});expect(stale.status()).toBe(409);
 const evil=await browser.newContext();await evil.addCookies([{name:'mesa_session',value:initial.playerId,url:origin}]);expect((await evil.request.get(url)).status()).toBe(403);await evil.close();await c.close();
});
