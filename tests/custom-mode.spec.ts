import {test,expect,type BrowserContext} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {makeDeck} from '../src/lib/truco-rules';
const origin=process.env.TRUCO_TEST_URL||'http://localhost:3000';
test('admin, uploads privados, snapshots, tentos manuais, animação pública e encerramento unânime',async({browser})=>{
  test.skip(!origin.includes('localhost:3002')||!existsSync('.data/admin-access.txt'),'Credenciais locais de teste necessárias.');
  const secret=readFileSync('.data/admin-access.txt','utf8'),username=secret.match(/Usuário: (.+)/)![1],password=secret.match(/Senha: (.+)/)![1];
  const contexts:BrowserContext[]=[];let original:any;
  try{
    for(let i=0;i<6;i++)contexts.push(await browser.newContext());
    const admin=contexts[0],anon=contexts[5];
    expect((await anon.request.get(origin+'/api/admin/config')).status()).toBe(401);
    const page=await admin.newPage();await page.goto(origin+'/admin');await page.getByLabel('Usuário',{exact:true}).fill(username);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar no painel'}).click();
    await expect(page.getByRole('heading',{name:'O baralho da turma.'})).toBeVisible();
    const configResponse=await admin.request.get(origin+'/api/admin/config');expect(configResponse.ok()).toBe(true);original=await configResponse.json();
    const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/sWoAAAAASUVORK5CYII=','base64');
    const upload=await admin.request.post(origin+'/api/admin/assets',{multipart:{file:{name:'foto.png',mimeType:'image/png',buffer:image}}});expect(upload.ok(),await upload.text()).toBe(true);const {id}=await upload.json();
    const wav=Buffer.alloc(204);wav.write('RIFF');wav.writeUInt32LE(196,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(160,40);
    const audioUpload=await admin.request.post(origin+'/api/admin/assets',{multipart:{file:{name:'grito.wav',mimeType:'audio/wav',buffer:wav}}});expect(audioUpload.ok()).toBe(true);const audio=await audioUpload.json();
    const configured={...original,name:'Mesa de teste',enabled:true,cards:Object.fromEntries(makeDeck().map(c=>[c.id,id])),sounds:{truco:audio.id,six:audio.id,run:audio.id}};
    const saved=await admin.request.put(origin+'/api/admin/config',{data:configured});expect(saved.ok(),await saved.text()).toBe(true);const published=await saved.json();
    expect((await anon.request.get(origin+'/api/admin/assets/'+id)).status()).toBe(401);
    expect((await admin.request.get(origin+'/api/admin/assets/'+id)).headers()['content-type']).toBe('image/png');
    expect((await admin.request.post(origin+'/api/admin/assets',{multipart:{file:{name:'fake.png',mimeType:'image/png',buffer:Buffer.from('<svg onload="alert(1)"></svg>')}}})).status()).toBe(400);
    const created=await contexts[1].request.post(origin+'/api/rooms',{data:{name:'Pessoa 1',mode:'2x2',variant:'custom',scoreMode:'manual'}});expect(created.ok(),await created.text()).toBe(true);const {code}=await created.json(),endpoint=origin+'/api/rooms/'+code;
    async function view(i:number){const response=await contexts[i].request.get(endpoint);expect(response.ok(),await response.text()).toBe(true);return response.json();}
    async function send(i:number,command:any,joining=false){const state=joining?{revision:0}:await view(i);const response=await contexts[i].request.post(endpoint,{data:{command,revision:state.revision,requestId:crypto.randomUUID()}});expect(response.ok(),await response.text()).toBe(true);return response.json();}
    for(let i=2;i<=4;i++)await send(i,{type:'join',name:`Pessoa ${i}`},true);
    await send(5,{type:'watch',name:'Visitante'},true);
    for(let i=1;i<=4;i++)await send(i,{type:'ready'});
    const roomPage=await contexts[1].newPage(),otherPage=await contexts[2].newPage();
    await roomPage.addInitScript(()=>{const Original=window.Audio;(window as any).__customSoundUrls=[];window.Audio=class extends Original{constructor(src?:string){super(src);(window as any).__customSoundUrls.push(src);}};});
    await Promise.all([roomPage.goto(origin+'/room/'+code),otherPage.goto(origin+'/room/'+code)]);
    await expect(roomPage.locator('.custom-mode-badge')).toContainText('Tentos manuais');
    await expect(roomPage.getByTestId('dealing-animation')).toBeHidden({timeout:10000});
    await expect.poll(async()=>roomPage.locator('.your-hand .card-photo').count()).toBe(3);
    expect((await contexts[5].request.get(endpoint+'/assets/'+id)).ok()).toBe(true);
    const outsider=await browser.newContext();try{expect((await outsider.request.get(endpoint+'/assets/'+id)).status()).toBe(403);}finally{await outsider.close();}
    await roomPage.getByRole('button',{name:'Puxar tentos',exact:true}).click();await roomPage.getByLabel('Quantos tentos').selectOption('3');await roomPage.getByRole('button',{name:'Puxar 3',exact:true}).click();
    await expect(roomPage.getByLabel('Quantos tentos')).toBeHidden();
    await expect(roomPage.locator('.pull-announcement').filter({hasText:'Pessoa 1 puxou 3 tentos'})).toBeVisible();await expect(otherPage.locator('.pull-announcement').filter({hasText:'Pessoa 1 puxou 3 tentos'})).toBeVisible();
    expect((await view(1)).scores).toEqual([3,0]);
    const turn=await view(1);await send(turn.currentSeat+1,{type:'raise'});
    await expect.poll(async()=>roomPage.evaluate((asset:string)=>(window as any).__customSoundUrls.some((url:string)=>url?.endsWith(asset)),audio.id)).toBe(true);
    await roomPage.screenshot({path:'test-results/custom-manual-desktop.png'});
    await roomPage.setViewportSize({width:390,height:844});expect(await roomPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await roomPage.screenshot({path:'test-results/custom-manual-mobile.png',fullPage:true});
    // A new admin revision never changes the room's immutable asset snapshot.
    expect((await admin.request.put(origin+'/api/admin/config',{data:{...configured,name:'Próxima versão',cards:{}}})).ok()).toBe(true);
    expect((await view(1)).custom.config.version).toBe(published.version);expect((await view(1)).custom.config.cards['4-clubs']).toBe(id);
    const normal=await contexts[5].request.post(origin+'/api/rooms',{data:{mode:'1x1',name:'Normal'}});const normalCode=(await normal.json()).code;expect((await(await contexts[5].request.get(origin+'/api/rooms/'+normalCode)).json()).custom).toBeNull();
    for(let i=1;i<=3;i++){await send(i,{type:'finish-vote'});expect((await view(1)).status).toBe('playing');}
    await send(4,{type:'finish-vote'});expect((await view(1)).status).toBe('finished');expect((await view(1)).winner).toBe(0);
    await page.setViewportSize({width:390,height:844});await page.reload();await expect(page.getByRole('heading',{name:'O baralho da turma.'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/admin-mobile.png',fullPage:true});
  }finally{if(original&&contexts[0])await contexts[0].request.put(origin+'/api/admin/config',{data:original});await Promise.all(contexts.map(c=>c.close()));}
});

test('criação pelo site escolhe personalizado manual e bots confirmam encerramento',async({page})=>{
  test.skip(!origin.includes('localhost:3002'),'Teste isolado local.');
  await page.goto(origin);await page.getByLabel('Como te chamam?').fill('Amigos da casa');
  await page.getByRole('button',{name:/Personalizado/}).click();await page.getByRole('button',{name:/Tentos manuais/}).click();
  await page.getByRole('button',{name:'Treinar contra bot',exact:true}).click();await page.getByRole('button',{name:'Estou pronto',exact:true}).click();
  await expect(page.locator('.custom-mode-badge')).toContainText('Tentos manuais');await page.getByRole('button',{name:'Puxar tentos',exact:true}).click();
  await page.getByLabel('Quantos tentos').selectOption('11');await page.getByRole('button',{name:'Puxar 11',exact:true}).click();
  await expect(page.getByRole('region',{name:'Resultado da partida'})).toHaveCount(0);
  await page.getByRole('button',{name:/Votar para encerrar/}).click();
  await expect(page.getByRole('region',{name:'Resultado da partida'})).toContainText('Sua equipe venceu');
});
