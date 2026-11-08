// U1e 用語リンク：本文 inline-term → シート → 用語集着地／#term-<id> 直リンク着地
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U1e');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#reader/1.1',{waitUntil:'networkidle'});
await page.waitForTimeout(1000);
const n=await page.evaluate(()=>document.querySelectorAll('article .inline-term').length);
log.info('1.1節本文の inline-term 数='+n);
const label=await page.evaluate(()=>{const e=document.querySelector('article .inline-term');if(!e)return null;const l=e.textContent.trim();e.click();return l;});
await page.waitForTimeout(700);
const sheet=await page.evaluate(()=>{
  const d=document.querySelector('[data-term-backdrop], .term-sheet');
  if(!d)return null;
  return {title:d.querySelector('h2,h3')?.textContent.trim().slice(0,40),
    brief:d.textContent.replace(/\s+/g,' ').slice(0,150),
    btns:[...d.querySelectorAll('button,a')].map(b=>b.textContent.trim().slice(0,30))};
});
log.info('用語「'+label+'」シート: '+JSON.stringify(sheet));
if(sheet&&sheet.title)log.ok('本文の用語リンクを押すと用語シートが開く');else log.fail('用語シートが開かない');
await page.screenshot({path:SHOTS+'u1e-termsheet-375.png'});
// シート内の用語集への導線
const toGloss=await page.evaluate(()=>{
  const d=document.querySelector('[data-term-backdrop], .term-sheet');
  const b=[...(d?.querySelectorAll('button,a')||[])].find(x=>/用語集/.test(x.textContent));
  if(b){b.click();return b.textContent.trim().slice(0,30);}
  return null;
});
if(toGloss){await page.waitForTimeout(1000);
  const st=await page.evaluate(()=>({hash:location.hash,expanded:document.querySelectorAll('[aria-expanded="true"]').length}));
  log.info('シート内「'+toGloss+'」→ '+JSON.stringify(st));
  if(/#glossary/.test(st.hash))log.ok('用語シートから用語集の該当用語へ着地する');else log.obs('シートからの着地先: '+st.hash);
}else{
  // シートを閉じて #term-<id> 直リンクを試す
  await page.keyboard.press('Escape');await page.waitForTimeout(400);
  const id=await page.evaluate(()=>document.querySelector('article .inline-term')?.getAttribute('data-term-id'));
  log.info('シート内に用語集導線なし。data-term-id='+id);
  if(id){await page.evaluate((id)=>{location.hash='#term-'+id;},id);await page.waitForTimeout(1000);
    const st=await page.evaluate(()=>({hash:location.hash,h:[...document.querySelectorAll('h2,h3')].map(x=>x.textContent.trim().slice(0,30)).slice(0,4)}));
    log.info('#term- 直リンク後: '+JSON.stringify(st));
    if(/#glossary/.test(st.hash))log.ok('#term-<id> 直リンクで用語集へ着地する');else log.obs('#term- 着地先: '+st.hash);
  }
}
// 未知IDの着地（穏当な着地になるか）
await page.evaluate(()=>{location.hash='#term-does-not-exist-xyz';});
await page.waitForTimeout(900);
const unk=await page.evaluate(()=>({hash:location.hash,h:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim().slice(0,30)).slice(0,3),err:document.body.textContent.includes('エラー')}));
log.info('未知ID着地: '+JSON.stringify(unk));
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U1e DONE');
