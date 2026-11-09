// W3e F01 の幅依存：同じ問題カードを 390px／1280px で測定
import {launch,newPage,DIST,SHOTS,makeLog,overflow} from './lib.mjs';
const log=makeLog('W3e');
const browser=await launch();
for(const width of [390,1280]){
  const {ctx,page,errors}=await newPage(browser,{width});
  page.setDefaultTimeout(120000);
  await page.goto(DIST+'/index.html#reader/1.1',{waitUntil:'load'});
  const btn=page.locator('#reader-original-note [data-start-question="supp-applied-1-1-v1"]');
  await btn.waitFor({state:'visible',timeout:90000}).catch(()=>{});
  await btn.first().click();
  await page.waitForTimeout(600);
  const modal=page.locator('.quiz-start-modal [data-action="confirm-quiz-start"]');
  if(await modal.count())await modal.first().click();
  await page.locator('.question-card').waitFor({state:'visible',timeout:90000});
  await page.waitForTimeout(500);
  const ov=await overflow(page);
  const detail=await page.evaluate(()=>{
    const card=document.querySelector('.question-card'),cr=card.getBoundingClientRect();
    const qa=document.querySelector('.question-actions');const qr=qa?qa.getBoundingClientRect():null;
    return {cardRight:Math.round(cr.right),actionsRight:qr?Math.round(qr.right):null};
  });
  log.info(width+'px: overflow='+JSON.stringify(ov)+' '+JSON.stringify(detail));
  if(width===390)await page.screenshot({path:SHOTS+'w3e-qcard-390.png'});
  await ctx.close();
}
await browser.close();
console.log('W3e DONE');
