import {test,expect} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
const origin=process.env.TRUCO_TEST_URL||'http://localhost:3000';

test('alterar senha no painel persiste, rejeita senha antiga e revoga outras sessões',async({browser})=>{
  test.skip(!origin.includes('localhost:3002')||!existsSync('.data/admin-access.txt'),'Alteração de teste somente no servidor local.');
  const access=readFileSync('.data/admin-access.txt','utf8'),username=access.match(/Usuário: (.+)/)![1],oldPassword=access.match(/Senha: (.+)/)![1],newPassword=`minha mesa ${crypto.randomUUID()}`;
  const admin=await browser.newContext(),other=await browser.newContext();let changed=false;
  try{
    expect((await other.request.put(origin+'/api/admin/password',{data:{currentPassword:oldPassword,newPassword,confirmPassword:newPassword}})).status()).toBe(401);
    const page=await admin.newPage();await page.goto(origin+'/admin');await page.getByLabel('Usuário',{exact:true}).fill(username);await page.getByLabel('Senha',{exact:true}).fill(oldPassword);await page.getByRole('button',{name:'Entrar no painel'}).click();
    await expect(page.getByRole('heading',{name:'Alterar senha',exact:true})).toBeVisible();
    expect((await other.request.post(origin+'/api/admin/auth',{data:{username,password:oldPassword}})).ok()).toBe(true);
    const endpoint=origin+'/api/admin/password';
    const wrong=await admin.request.put(endpoint,{data:{currentPassword:'wrong',newPassword,confirmPassword:newPassword}});expect(wrong.status()).toBe(400);
    const mismatch=await admin.request.put(endpoint,{data:{currentPassword:oldPassword,newPassword,confirmPassword:newPassword+'x'}});expect(mismatch.status()).toBe(400);
    const weak=await admin.request.put(endpoint,{data:{currentPassword:oldPassword,newPassword:'short',confirmPassword:'short'}});expect(weak.status()).toBe(400);
    const csrf=await admin.request.put(endpoint,{headers:{Origin:'https://untrusted.example'},data:{currentPassword:oldPassword,newPassword,confirmPassword:newPassword}});expect(csrf.status()).toBe(403);
    await page.getByLabel('Senha atual',{exact:true}).fill(oldPassword);await page.getByLabel('Nova senha',{exact:true}).fill(newPassword);await page.getByLabel('Confirmar nova senha',{exact:true}).fill(newPassword);
    await page.getByRole('button',{name:'Alterar senha',exact:true}).click();await expect(page.getByRole('status')).toContainText('Senha alterada');changed=true;
    await expect(page.getByLabel('Nova senha',{exact:true})).toHaveValue('');
    expect((await admin.request.get(origin+'/api/admin/config')).ok()).toBe(true);
    expect((await other.request.get(origin+'/api/admin/config')).status()).toBe(401);
    expect((await other.request.post(origin+'/api/admin/auth',{data:{username,password:oldPassword}})).status()).toBe(401);
    expect((await other.request.post(origin+'/api/admin/auth',{data:{username,password:newPassword}})).ok()).toBe(true);
    const restored=await admin.request.put(endpoint,{data:{currentPassword:newPassword,newPassword:oldPassword,confirmPassword:oldPassword}});expect(restored.ok(),await restored.text()).toBe(true);changed=false;
    expect((await other.request.get(origin+'/api/admin/config')).status()).toBe(401);
    expect((await other.request.post(origin+'/api/admin/auth',{data:{username,password:oldPassword}})).ok()).toBe(true);
    await page.setViewportSize({width:390,height:844});await page.reload();await expect(page.getByRole('heading',{name:'Alterar senha',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{
    if(changed)await admin.request.put(origin+'/api/admin/password',{data:{currentPassword:newPassword,newPassword:oldPassword,confirmPassword:oldPassword}});
    await Promise.all([admin.close(),other.close()]);
  }
});
