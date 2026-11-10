import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,scryptSync,createHmac} from 'node:crypto';
import {verifyAdminPassword,verifyAdminSession} from './admin-auth';
import {identifyUpload,validateConfig} from './custom-store';
import {referencedAsset,defaultCustomConfig} from '../custom-mode';

test('admin password hashing rejects wrong user/password and unsigned sessions',()=>{
  const original=[process.env.ADMIN_USERNAME,process.env.ADMIN_PASSWORD_HASH,process.env.ADMIN_SESSION_SECRET];
  try{const salt=randomBytes(16).toString('hex');process.env.ADMIN_USERNAME='owner';process.env.ADMIN_PASSWORD_HASH=`${salt}:${scryptSync('long-test-password',salt,64).toString('hex')}`;process.env.ADMIN_SESSION_SECRET=randomBytes(32).toString('hex');
    assert.equal(verifyAdminPassword('owner','long-test-password'),true);assert.equal(verifyAdminPassword('other','long-test-password'),false);assert.equal(verifyAdminPassword('owner','wrong'),false);assert.equal(verifyAdminSession('9999999999999.fake.forged'),false);assert.equal(verifyAdminSession(undefined),false);
  }finally{['ADMIN_USERNAME','ADMIN_PASSWORD_HASH','ADMIN_SESSION_SECRET'].forEach((key,i)=>{if(original[i]===undefined)delete process.env[key];else process.env[key]=original[i];});}
});
test('custom asset configuration permits only supported card ids, audio events and immutable file ids',()=>{
  const id='b15ba7ab-41e1-4a3b-a975-5f7455550000.png',audio=id.replace('.png','.mp3');
  const c=validateConfig({...defaultCustomConfig(),cards:{'4-clubs':id},sounds:{truco:audio}});assert.equal(referencedAsset(c,id),true);assert.equal(referencedAsset(c,'../../.env.local'),false);assert.equal(referencedAsset(c,id.replace('0000','1111')),false);
  for(const input of [{...c,cards:{'8-clubs':id}},{...c,cards:{'4-clubs':'https://evil.example/photo'}},{...c,sounds:{unknown:audio}},{...c,cards:{'4-clubs':audio}},{...c,sounds:{truco:id}}])assert.throws(()=>validateConfig(input));
});
test('uploads detect actual binary formats and reject HTML and SVG',()=>{
  assert.equal(identifyUpload(Buffer.from([137,80,78,71,13,10,26,10])),'png');assert.equal(identifyUpload(Buffer.from('ID3audio')),'mp3');assert.equal(identifyUpload(Buffer.from('RIFF0000WAVEdata')),'wav');
  for(const value of ['<script>alert(1)</script>','<svg onload="alert(1)"></svg>','not a photo'])assert.throws(()=>identifyUpload(Buffer.from(value)));
});

test('admin session versions invalidate all earlier sessions while accepting legacy tokens only before password changes',()=>{
  const original=[process.env.ADMIN_USERNAME,process.env.ADMIN_PASSWORD_HASH,process.env.ADMIN_SESSION_SECRET];
  try{
    process.env.ADMIN_USERNAME='owner';process.env.ADMIN_PASSWORD_HASH='configured';process.env.ADMIN_SESSION_SECRET=randomBytes(32).toString('hex');
    const now=Date.now(),expires=now+3600000,sign=(payload:string)=>`${payload}.${createHmac('sha256',process.env.ADMIN_SESSION_SECRET!).update(payload).digest('base64url')}`;
    const old=sign(`${expires}.random.initial`),legacy=sign(`${expires}.random`),current=sign(`${expires}.random.new-version`);
    assert.equal(verifyAdminSession(old,now,'initial'),true);assert.equal(verifyAdminSession(legacy,now,'initial'),true);
    assert.equal(verifyAdminSession(old,now,'new-version'),false);assert.equal(verifyAdminSession(legacy,now,'new-version'),false);assert.equal(verifyAdminSession(current,now,'new-version'),true);
    assert.equal(verifyAdminSession(current,expires+1,'new-version'),false);assert.equal(verifyAdminSession(current+'.extra',now,'new-version'),false);
  }finally{['ADMIN_USERNAME','ADMIN_PASSWORD_HASH','ADMIN_SESSION_SECRET'].forEach((key,i)=>{if(original[i]===undefined)delete process.env[key];else process.env[key]=original[i];});}
});
