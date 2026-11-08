import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U6c');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#quiz',{waitUntil:'networkidle'});
await page.waitForTimeout(900);
await page.selectOption('select[name=count]',{index:0});
await page.click('button[type=submit]');
await page.waitForTimeout(1000);
for(let i=0;i<3;i++){
  await page.click('label.answer-choice >> nth=0');
  await page.evaluate(()=>{document.querySelector('.answer-submit')?.click();});
  await page.waitForTimeout(700);
  const moved=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/次の問題へ|結果/.test(b.textContent));if(b){b.click();return b.textContent.trim().slice(0,26);}return null;});
  log.info('遷移ボタン: '+moved);
  await page.waitForTimeout(800);
}
const sum=await page.evaluate(()=>document.querySelector('main').textContent.replace(/\s+/g,' ').slice(0,340));
log.info('結果画面: '+sum.slice(0,300));
if(/問中|正解率|結果|おつかれ|完了/.test(sum))log.ok('3問解き終えると結果画面が表示される');
await page.screenshot({path:SHOTS+'u6c-quiz-result-375.png'});
// 復習タブ（回答履歴がある状態）
await page.goto(DIST+'/index.html#review',{waitUntil:'networkidle'});
await page.waitForTimeout(900);
const rv=await page.evaluate(()=>document.querySelector('main').textContent.replace(/\s+/g,' ').slice(0,300));
log.info('復習タブ: '+rv.slice(0,240));
await page.screenshot({path:SHOTS+'u6c-review-375.png'});
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
