// W3d F01 の範囲確認：別問題（supp-applied-1-1-v1、§1.1）の問題カードでも 375px はみ出しが出るか
import {launch,newPage,DIST,makeLog,overflow} from './lib.mjs';
const log=makeLog('W3d');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);
await page.goto(DIST+'/index.html#reader/1.1',{waitUntil:'load'});
const btn=page.locator('#reader-original-note [data-start-question="supp-applied-1-1-v1"]');
await btn.waitFor({state:'visible',timeout:90000}).catch(()=>log.obs('開始ボタン待ちタイムアウト'));
await btn.first().click();
await page.waitForTimeout(600);
const modal=page.locator('.quiz-start-modal [data-action="confirm-quiz-start"]');
if(await modal.count())await modal.first().click();
await page.locator('.question-card').waitFor({state:'visible',timeout:90000});
await page.waitForTimeout(500);
const ov=await overflow(page);
log.info('別問題カードの overflow: '+JSON.stringify(ov));
const detail=await page.evaluate(()=>{
  const card=document.querySelector('.question-card'),cr=card.getBoundingClientRect();
  const qa=document.querySelector('.question-actions');
  const qr=qa?qa.getBoundingClientRect():null;
  const head=document.querySelector('.question-card .card-heading, .question-card header');
  return {cardRight:Math.round(cr.right),actionsRight:qr?Math.round(qr.right):null,
    statusText:(document.querySelector('.question-card .status-pill, .question-card [class*=pill]')?.textContent||'').trim().slice(0,40)};
});
log.info('詳細: '+JSON.stringify(detail));
if(!ov.bad)log.ok('別問題では横はみ出しなし（F01 は状態依存の可能性）');
else log.obs('別問題でも横はみ出しあり（F01 は問題カード一般の可能性）');
log.info('W3d errors: '+JSON.stringify(errors));
await ctx.close();
await browser.close();
console.log('W3d DONE');
