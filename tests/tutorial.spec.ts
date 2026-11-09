import { test, expect } from '@playwright/test';
const origin=process.env.TRUCO_TEST_URL||'http://localhost:3000';

test('tutorial: hierarquia, encobertas, tentos, empates, exemplos e exercícios no celular', async ({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto(origin);
  await page.getByRole('link',{name:'Aprender a jogar',exact:true}).click();
  const guide=page.locator('.truco-tutorial');const chapter=guide.getByLabel('Escolha um capítulo');
  await expect(guide.getByRole('heading',{name:'Primeiros passos',exact:true})).toBeVisible();
  await chapter.selectOption('3');
  await guide.getByLabel('Escolher carta 1').selectOption('A-spades');await guide.getByLabel('Escolher carta 2').selectOption('3-diamonds');
  await expect(guide.getByRole('status')).toContainText('A♠ · espadas venceu');
  await guide.getByLabel('Escolher carta 1').selectOption('3-hearts');await guide.getByLabel('Escolher carta 2').selectOption('3-clubs');
  await expect(guide.getByRole('status')).toContainText('Empatou');
  const covered=guide.getByRole('checkbox');await covered.first().check();
  await expect(guide.getByRole('status')).toContainText('3♣ · paus venceu');await covered.last().check();
  await expect(guide.getByRole('status')).toContainText('Todas estão encobertas');
  await chapter.selectOption('7');
  const lab=guide.getByTestId('score-simulator');
  await lab.getByLabel('Placar de quem leva a mão').selectOption('3');await lab.getByLabel('Valor aceito da mão').selectOption('7');
  await expect(lab.getByRole('status')).toContainText('9');
  await lab.getByLabel('Placar de quem leva a mão').selectOption('7');await lab.getByLabel('Valor aceito da mão').selectOption('5');
  await expect(lab.getByRole('status')).toContainText('11');await expect(lab.getByRole('status')).not.toContainText('Vitória');
  await lab.getByLabel('Placar de quem leva a mão').selectOption('9');await expect(lab.getByRole('status')).toContainText('Vitória');
  await lab.getByLabel('Placar de quem leva a mão').selectOption('0');await lab.getByLabel('O que aconteceu').selectOption('refused');
  await lab.getByLabel('Pedido proposto').selectOption('7');await expect(lab.getByRole('status')).toContainText('5');
  await chapter.selectOption('5');const selectors=guide.locator('.tutorial-lab select');
  await expect(guide.getByRole('status')).toContainText('Sua equipe ganha');
  await selectors.nth(0).selectOption('tie');await selectors.nth(1).selectOption('tie');await selectors.nth(2).selectOption('tie');
  await expect(guide.getByRole('status')).toContainText('Ninguém recebe tentos');
  await chapter.selectOption('15');await guide.getByLabel('Escolha um exemplo').selectOption('11');await guide.getByRole('button',{name:'Ver o que acontece',exact:true}).click();
  await expect(guide.getByRole('status')).toContainText('Partindo de 0, chega a 11');
  await guide.getByRole('radio',{name:'3♦',exact:true}).check();await guide.getByRole('button',{name:'Conferir resposta'}).click();
  await expect(guide.getByRole('status').filter({hasText:'Ainda não'})).toBeVisible();
  await guide.getByRole('radio',{name:'A♠',exact:true}).check();await guide.getByRole('button',{name:'Conferir resposta'}).click();
  await expect(guide.getByRole('status').filter({hasText:'Acertou'})).toBeVisible();
  // Every chapter must fit the phone. Wide tables scroll inside their own region.
  for(let i=0;i<16;i++){await chapter.selectOption(String(i));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`chapter ${i+1}`).toBe(true);}
  await chapter.selectOption('1');await page.screenshot({path:'test-results/tutorial-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await guide.getByRole('button',{name:/03 Quem mata quem/}).click();
  await page.screenshot({path:'test-results/tutorial-desktop.png',fullPage:true});
});

test('consultar tutorial na sala não envia jogadas e fecha com Escape devolvendo foco',async({browser})=>{
  const context=await browser.newContext();try{
    const response=await context.request.post(origin+'/api/rooms',{data:{mode:'1x1',name:'Aprendiz'}});expect(response.ok()).toBe(true);
    const {code}=await response.json(),endpoint=origin+'/api/rooms/'+code;
    const page=await context.newPage();await page.goto(origin+'/room/'+code);
    const before=await(await context.request.get(endpoint)).json();let commands=0;
    page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/api/rooms/'))commands++;});
    const opener=page.getByRole('button',{name:'Aprender a jogar',exact:true});await opener.click();
    const dialog=page.getByRole('dialog',{name:'Tutorial do Truco da Casa'});await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button',{name:'Fechar tutorial'})).toBeFocused();
    await page.setViewportSize({width:390,height:844});await dialog.getByLabel('Escolha um capítulo').selectOption('3');
    await dialog.getByLabel('Escolher carta 1').selectOption('4-clubs');
    await expect(dialog.getByRole('status')).toContainText('4♣ · paus venceu');
    await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(opener).toBeFocused();
    const after=await(await context.request.get(endpoint)).json();expect(after.revision).toBe(before.revision);expect(after.hand).toEqual(before.hand);expect(commands).toBe(0);
  }finally{await context.close();}
});
