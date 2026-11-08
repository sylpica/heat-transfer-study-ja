// V0 デバッグ：演習開始画面と取り込みフィードバックの実物採取
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
import {createEmptyState,localDay} from '../../../study-core.mjs';
import {writeFileSync} from 'node:fs';
const log=makeLog('V0');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);
await page.goto(DIST+'/index.html#quiz',{waitUntil:'load'});
await page.waitForTimeout(4000);
const form=await page.evaluate(()=>({
  selects:[...document.querySelectorAll('select')].map(s=>({name:s.name,opts:[...s.options].map(o=>o.textContent.trim()).slice(0,8)})),
  buttons:[...document.querySelectorAll('button')].map(b=>({t:b.textContent.trim().slice(0,30),type:b.type,cls:b.className.slice(0,30)})).slice(0,20),
  radios:[...document.querySelectorAll('input[type=radio]')].map(r=>({name:r.name,value:r.value,checked:r.checked})).slice(0,10),
}));
log.info('quiz開始画面: '+JSON.stringify(form).slice(0,1500));
await page.screenshot({path:SHOTS+'v0-quiz-start-375.png'});
// 送信してみる
await page.evaluate(()=>{const b=document.querySelector('button[type=submit]');if(b)b.click();});
await page.waitForTimeout(12000);
const after=await page.evaluate(()=>({
  text:document.body.textContent.replace(/\s+/g,' ').slice(0,600),
  modal:!!document.querySelector('.quiz-start-modal'),
  qcard:!!document.querySelector('.question-card'),
}));
log.info('送信後: '+JSON.stringify(after).slice(0,900));
await page.screenshot({path:SHOTS+'v0-quiz-after-submit-375.png'});
// 設定：取り込みフィードバック
const now=new Date(),day=localDay(now);
const payload=createEmptyState();
payload.sessions=[{id:'v0-s',date:day,startedAt:now.toISOString(),total:99,correct:99,answers:[]}];
writeFileSync('/tmp/v0-import.json',JSON.stringify(payload));
await page.goto(DIST+'/index.html#settings',{waitUntil:'load'});
await page.waitForTimeout(3000);
await page.setInputFiles('#import-file','/tmp/v0-import.json');
await page.waitForTimeout(8000);
const fb=await page.evaluate(()=>({
  feedback:document.querySelector('#import-feedback')?.textContent.replace(/\s+/g,' ').trim().slice(0,300),
  previewBtns:[...document.querySelectorAll('[data-action^="import"]')].map(b=>b.getAttribute('data-action')+':'+b.textContent.trim().slice(0,20)),
}));
log.info('取り込み後: '+JSON.stringify(fb));
await page.screenshot({path:SHOTS+'v0-import-375.png'});
log.info('errors: '+JSON.stringify(errors.filter(e=>!/404/.test(e))));
await ctx.close();
await browser.close();
console.log('V0 DONE');
