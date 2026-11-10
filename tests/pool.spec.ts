import{test,expect,type BrowserContext}from'@playwright/test';import{FileRoomStore}from'../src/lib/server/storage';import{rackBalls,ball}from'../src/lib/pool/physics';import type{Pool}from'../src/lib/pool/game';
const origin=process.env.TRUCO_TEST_URL||'http://localhost:3000';
test('sinuca: entrada pelo site, treino, mesa no celular, posicionar branca, tacar e silenciar',async({page})=>{
  test.skip(!origin.includes('localhost:3002'),'Servidor local para saída determinística.');
  await page.setViewportSize({width:390,height:844});await page.goto(origin);await page.getByRole('link',{name:'Sinuca',exact:true}).click();await expect(page).toHaveURL(/\/sinuca$/);
  await page.getByLabel('Como te chamam?').fill('Aprendiz');await page.getByRole('button',{name:'Treinar contra bot',exact:true}).click();await expect(page).toHaveURL(/\/sinuca\/room\/[A-Za-z0-9_-]+$/);
  const code=page.url().split('/').pop()!,store=new FileRoomStore(),saved=(await store.get<Pool>(code))!;saved.document.state.breaker=1;saved.document.state.revision++;expect(await store.compareAndSwap(code,saved.version,saved.document)).toBe(true);await page.reload();
  await page.getByRole('button',{name:'Estou pronto',exact:true}).click();await expect(page.getByRole('button',{name:'Confirmar posição e mirar'})).toBeVisible();
  const table=page.getByTestId('pool-table');await expect(table).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/pool-mobile-placement.png'});
  await page.getByRole('button',{name:'Confirmar posição e mirar'}).click();await expect(page.getByRole('button',{name:'Tacar',exact:true})).toBeEnabled();
  expect((await page.getByRole('button',{name:'Tacar',exact:true}).boundingBox())!.y).toBeLessThan(844);
  await page.getByRole('slider',{name:/Força/}).press('End');await page.getByRole('slider',{name:/Mira/}).press('Home');await page.getByRole('button',{name:'Tacar',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Bolas em movimento'})).toBeVisible();
  const replay=await(await page.context().request.get(origin+'/api/sinuca/rooms/'+code)).json();await page.waitForTimeout(Math.max(0,replay.replay.startedAt-Date.now()+1000));const before=await table.evaluate((canvas:HTMLCanvasElement)=>canvas.toDataURL());await page.waitForTimeout(220);expect(await table.evaluate((canvas:HTMLCanvasElement)=>canvas.toDataURL())).not.toBe(before);
  await page.getByRole('button',{name:'Silenciar sons',exact:true}).click();await expect(page.getByRole('button',{name:'Ativar sons',exact:true})).toBeVisible();
  await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'test-results/pool-desktop-moving.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const canvas=await table.evaluate((canvas:HTMLCanvasElement)=>{const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;let green=0;for(let i=0;i<data.length;i+=16)if(data[i+1]>data[i]*1.25&&data[i+1]>data[i+2]*1.1)green++;return green;});expect(canvas).toBeGreaterThan(1000);
});

test('sinuca 2x2: quatro sessões, replay igual, parceiro continua, preta marcada e revanche',async({browser})=>{
  test.skip(!origin.includes('localhost:3002'),'Posições controladas somente no servidor local.');const contexts:BrowserContext[]=[];
  try{for(let i=0;i<5;i++)contexts.push(await browser.newContext());const create=await contexts[0].request.post(origin+'/api/sinuca/rooms',{data:{name:'Pessoa 0',mode:'2x2'}});expect(create.ok(),await create.text()).toBe(true);const{code}=await create.json(),endpoint=origin+'/api/sinuca/rooms/'+code;
    const view=async(i:number)=>{const response=await contexts[i].request.get(endpoint);expect(response.ok(),await response.text()).toBe(true);return response.json();};
    async function command(i:number,command:any,joining=false){const state=joining?{revision:0}:await view(i);const response=await contexts[i].request.post(endpoint,{data:{command,revision:state.revision,requestId:crypto.randomUUID()}});expect(response.ok(),await response.text()).toBe(true);return response.json();}
    for(let i=1;i<4;i++)await command(i,{type:'join',name:`Pessoa ${i}`},true);await command(4,{type:'watch',name:'Visitante'},true);for(let i=0;i<4;i++)await command(i,{type:'ready'});
    const store=new FileRoomStore();async function fixture(eightOnly=false){const saved=(await store.get<Pool>(code))!,r=saved.document.state;r.balls=rackBalls().map(b=>({...b,pocketed:true}));Object.assign(r.balls[0],ball(0,500,240));Object.assign(r.balls[eightOnly?8:1],ball(eightOnly?8:1,500,120));Object.assign(r.balls[9],ball(9,900,300));if(!eightOnly){Object.assign(r.balls[2],ball(2,720,250));Object.assign(r.balls[8],ball(8,800,250));}r.groups=['solids','stripes'];r.currentSeat=eightOnly?2:0;r.nextSeats=[r.currentSeat,1];r.isBreak=false;r.ballInHand=null;r.pending=null;r.replay=null;r.deadline=Date.now()+45000;r.revision++;r.players.forEach(p=>p.lastSeen=Date.now());expect(await store.compareAndSwap(code,saved.version,saved.document)).toBe(true);}
    await fixture();const pages=await Promise.all(contexts.map(c=>c.newPage()));await Promise.all(pages.map(p=>p.goto(origin+'/sinuca/room/'+code)));
    await expect(pages[4].getByRole('button',{name:'Tacar',exact:true})).toHaveCount(0);
    const shot=await command(0,{type:'shoot',angle:-Math.PI/2,power:.5});const views=await Promise.all([0,1,2,3,4].map(view));expect(new Set(views.map(v=>v.replay.id)).size).toBe(1);expect(views.every(v=>v.moving)).toBe(true);
    await expect.poll(async()=>(await view(0)).moving,{timeout:15000}).toBe(false);expect((await view(0)).currentSeat).toBe(2);
    const settled=await Promise.all([0,1,2,3].map(view));for(const v of settled)expect(v.balls).toEqual(settled[0].balls);
    await fixture(true);await expect(pages[2].getByRole('combobox',{name:'Caçapa da preta',exact:true})).toBeVisible();
    await pages[2].getByRole('slider',{name:/Mira/}).focus();await pages[2].getByRole('slider',{name:/Mira/}).press('End');
    await pages[2].getByRole('combobox',{name:'Caçapa da preta',exact:true}).selectOption('1');
    // Keep the actual UI for the called pocket; send the exact angle to exercise the server adjudication.
    const chosen=(await pages[2].getByRole('combobox',{name:'Caçapa da preta',exact:true}).inputValue());expect(chosen).toBe('1');
    await command(2,{type:'shoot',angle:-Math.PI/2,power:.5,calledPocket:1});
    await Promise.all(pages.slice(0,4).map(p=>expect(p.getByRole('region',{name:'Resultado da sinuca'})).toBeVisible({timeout:15000})));
    expect((await view(0)).winner).toBe(0);await expect(pages[0].getByRole('heading',{name:'Essa foi sua!',exact:true})).toBeVisible();await expect(pages[1].getByRole('heading',{name:'Deu para o outro lado.',exact:true})).toBeVisible();
    for(let i=0;i<3;i++)await command(i,{type:'rematch'});expect((await view(0)).status).toBe('finished');await command(3,{type:'rematch'});const rematch=await view(0);expect(rematch.status).toBe('playing');expect(rematch.balls.filter((b:any)=>!b.pocketed)).toHaveLength(16);
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});
