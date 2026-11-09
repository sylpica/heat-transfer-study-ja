// W3b 問題画面 375px 横はみ出し（doc=381）の原因要素の特定
import {launch,newPage,DIST,makeLog} from './lib.mjs';
const log=makeLog('W3b');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);

async function diag(tag){
  const res=await page.evaluate(()=>{
    const W=innerWidth, out=[];
    for(const el of document.querySelectorAll('*')){
      const r=el.getBoundingClientRect();
      if(r.width===0)continue;
      if(r.right>W+0.6||r.left<-0.6){
        out.push({tag:el.tagName,cls:(el.className&&el.className.baseVal!==undefined?'svg':String(el.className)).slice(0,60),
          left:Math.round(r.left*10)/10,right:Math.round(r.right*10)/10,w:Math.round(r.width*10)/10,
          text:(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,50)});
      }
    }
    // 祖先だけに絞る（子がはみ出している場合は最上位の祖先を優先表示するため全件返す）
    return {doc:document.documentElement.scrollWidth,win:W,count:out.length,items:out.slice(0,14)};
  });
  log.info(tag+': '+JSON.stringify(res));
  return res;
}

await page.goto(DIST+'/index.html#reader/6.1',{waitUntil:'load'});
const btn=page.locator('#reader-original-note [data-start-question="supp-next-local-versus-average-v1"]');
await btn.waitFor({state:'visible',timeout:90000});
await btn.first().click();
await page.waitForTimeout(600);
const modal=page.locator('.quiz-start-modal [data-action="confirm-quiz-start"]');
if(await modal.count())await modal.first().click();
await page.locator('.question-card').waitFor({state:'visible',timeout:90000});
await page.waitForTimeout(500);
await diag('回答前');
await page.evaluate(()=>{
  const l=[...document.querySelectorAll('.question-card .answer-choice')].find(x=>x.textContent.includes('局所値と平均は別の量であり'));
  l?.click();
});
await page.waitForTimeout(400);
await page.evaluate(()=>{document.querySelector('.question-card button.answer-submit')?.click();});
await page.waitForFunction(()=>/正解です/.test(document.querySelector('.question-card')?.textContent||''),null,{timeout:60000}).catch(()=>{});
await page.waitForTimeout(500);
await diag('判定後');
// 判定後カード自体の内部はみ出し
const inner=await page.evaluate(()=>{
  const c=document.querySelector('.question-card');
  return {cardSW:c.scrollWidth,cardCW:c.clientWidth};
});
log.info('question-card 内部: '+JSON.stringify(inner));
log.info('W3b errors: '+JSON.stringify(errors));
await ctx.close();
await browser.close();
console.log('W3b DONE');
