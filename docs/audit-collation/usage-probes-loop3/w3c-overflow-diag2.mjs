// W3c はみ出しの精密特定：カード内要素と文書レベルの寄与要素
import {launch,newPage,DIST,makeLog} from './lib.mjs';
const log=makeLog('W3c');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);
await page.goto(DIST+'/index.html#reader/6.1',{waitUntil:'load'});
const btn=page.locator('#reader-original-note [data-start-question="supp-next-local-versus-average-v1"]');
await btn.waitFor({state:'visible',timeout:90000});
await btn.first().click();
await page.waitForTimeout(600);
const modal=page.locator('.quiz-start-modal [data-action="confirm-quiz-start"]');
if(await modal.count())await modal.first().click();
await page.locator('.question-card').waitFor({state:'visible',timeout:90000});
await page.waitForTimeout(500);

const before=await page.evaluate(()=>{
  const card=document.querySelector('.question-card'),cr=card.getBoundingClientRect();
  const inner=[];
  for(const el of card.querySelectorAll('*')){
    const r=el.getBoundingClientRect();
    if(r.width&&r.right>cr.right+0.6)inner.push({tag:el.tagName,cls:String(el.className).slice(0,50),right:Math.round(r.right*10)/10,cardRight:Math.round(cr.right*10)/10,text:(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,60)});
  }
  // 文書レベルの寄与：main 直下で右端が 375 を超える要素
  const docItems=[];
  for(const el of document.querySelectorAll('body *')){
    const r=el.getBoundingClientRect();
    if(r.width&&r.right>375.6&&!el.closest('nav'))docItems.push({tag:el.tagName,cls:String(el.className).slice(0,50),right:Math.round(r.right*10)/10,text:(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,40)});
    if(docItems.length>10)break;
  }
  return {card:{left:cr.left,right:cr.right,sw:card.scrollWidth,cw:card.clientWidth},inner:inner.slice(0,8),docItems,
    bodySW:document.body.scrollWidth,docSW:document.documentElement.scrollWidth};
});
log.info('回答前: '+JSON.stringify(before,null,1));
// ナビがスクロールコンテナかどうか
const navInfo=await page.evaluate(()=>{
  const nav=document.querySelector('nav');
  const cs=getComputedStyle(nav);
  return {overflowX:cs.overflowX,sw:nav.scrollWidth,cw:nav.clientWidth};
});
log.info('nav: '+JSON.stringify(navInfo));
await ctx.close();
await browser.close();
console.log('W3c DONE');
