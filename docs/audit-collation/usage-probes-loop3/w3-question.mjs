// W3 解く：Q01（supp-next-local-versus-average-v1）の改訂選択肢を実画面で回答する
import {launch,newPage,DIST,SHOTS,makeLog,overflow} from './lib.mjs';
const log=makeLog('W3');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);

await page.goto(DIST+'/index.html#reader/6.1',{waitUntil:'load'});
const btn=page.locator('#reader-original-note [data-start-question="supp-next-local-versus-average-v1"]');
await btn.waitFor({state:'visible',timeout:90000}).catch(()=>log.obs('§6.1 ノート内の開始ボタン待ちタイムアウト'));
log.info('開始ボタン数: '+await btn.count());
await btn.first().click();
// 開始確認モーダルが出る経路にも対応
await page.waitForTimeout(600);
const modal=page.locator('.quiz-start-modal [data-action="confirm-quiz-start"]');
if(await modal.count()){await modal.first().click(); log.info('開始確認モーダルを承認');}
await page.locator('.question-card').waitFor({state:'visible',timeout:90000});
await page.waitForTimeout(500);

const card=await page.evaluate(()=>document.querySelector('.question-card').textContent.replace(/\s+/g,' ').trim());
log.info('問題カード: '+card.slice(0,400));
if(card.includes('終端x=Lの局所値h_Lと面平均'))log.ok('対象問題（局所値と面平均）が表示された');
else log.fail('対象問題と異なる問題が表示された');
if(card.includes('局所値と平均は別の量であり、平均には分布の積分が必要'))log.ok('C3-Q01 新しい選択肢文が表示');
else log.fail('C3-Q01 新しい選択肢文が見つからない');
if(card.includes('分布を平均して求める値と終端の値は異なる'))log.fail('C3-Q01 旧選択肢文が残っている');
await page.screenshot({path:SHOTS+'w3-q01-before-375.png'});

// 新文言の選択肢を選んで回答
const picked=await page.evaluate(()=>{
  const l=[...document.querySelectorAll('.question-card .answer-choice')].find(x=>x.textContent.includes('局所値と平均は別の量であり、平均には分布の積分が必要'));
  if(!l)return null; l.click(); return l.textContent.replace(/\s+/g,' ').trim();
});
log.info('選択した肢: '+picked);
await page.waitForTimeout(400);
await page.evaluate(()=>{document.querySelector('.question-card button.answer-submit')?.click();});
await page.waitForFunction(()=>/正解|不正解/.test(document.querySelector('.question-card')?.textContent||''),null,{timeout:60000}).catch(()=>log.obs('判定待ちタイムアウト'));
await page.waitForTimeout(500);
const judged=await page.evaluate(()=>document.querySelector('.question-card').textContent.replace(/\s+/g,' ').trim());
log.info('判定後カード: '+judged.slice(0,700));
if(/正解(?!率)/.test(judged)&&!/不正解/.test(judged))log.ok('新文言の選択肢を選んで正解判定');
else log.fail('正解判定にならなかった');
if(judged.includes('一般に平均h̄_L=(1/L)∫₀ᴸ h_x dx'))log.ok('解説（平均の積分定義）が表示され、選択肢と矛盾しない');
else log.fail('解説の積分定義が見つからない');
if(judged.includes('正解。平均には分布を反映する。'))log.ok('選択肢解説「正解。平均には分布を反映する。」が表示');
await page.screenshot({path:SHOTS+'w3-q01-judged-375.png'});
const ov=await overflow(page);
if(!ov.bad)log.ok('問題画面 375px 横はみ出し 0'); else log.fail('問題画面 横はみ出し: '+JSON.stringify(ov));
log.info('W3 errors: '+JSON.stringify(errors));
if(!errors.some(e=>e.startsWith('pageerror')))log.ok('W3 セッション pageerror 0');
else log.fail('W3 pageerror: '+errors.join(' | '));
await ctx.close();
await browser.close();
console.log('W3 DONE');
