// U2h 問題一覧 #49（フィン）→ 回答 → ケースリンク → ラボ着地
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U2h');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#quiz',{waitUntil:'networkidle'});
await page.waitForTimeout(900);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/問題一覧/.test(b.textContent));b?.click();});
await page.waitForTimeout(1100);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/^49一定断面の直線フィン/.test(b.textContent.trim()));b?.scrollIntoView();b?.click();});
await page.waitForTimeout(1100);
let st=await page.evaluate(()=>({card:document.querySelector('.question-card')?.textContent.replace(/\s+/g,' ').slice(0,120),
  caseBefore:[...document.querySelectorAll('main a')].map(a=>a.getAttribute('href')).filter(h=>h&&/case=/.test(h))}));
log.info('問題49表示: '+JSON.stringify(st));
await page.click('label.answer-choice >> nth=1');
await page.evaluate(()=>{document.querySelector('.answer-submit')?.click();});
await page.waitForTimeout(900);
st=await page.evaluate(()=>({verdict:(document.querySelector('.answer-feedback')?.textContent||'').slice(0,40),
  caseAfter:[...document.querySelectorAll('main a')].filter(a=>/case=/.test(a.getAttribute('href')||'')).map(a=>({href:a.getAttribute('href'),text:a.textContent.trim().slice(0,50),target:a.target}))}));
log.info('回答後: '+JSON.stringify(st));
if(st.caseAfter.length)log.ok('フィン問題の回答後にケース受け口リンクが表示される: '+st.caseAfter[0].href);
await page.screenshot({path:SHOTS+'u2h-case-link-375.png'});
if(st.caseAfter.length){
  const [popup]=await Promise.all([
    ctx.waitForEvent('page',{timeout:5000}).catch(()=>null),
    page.evaluate(()=>{const a=[...document.querySelectorAll('main a')].find(a=>/case=/.test(a.getAttribute('href')||''));a.click();}),
  ]);
  const target=popup||page;
  await target.waitForTimeout(2500);
  const now=await target.evaluate(()=>({url:location.href,title:document.title,
    body:document.body.textContent.replace(/\s+/g,' ').slice(0,420)}));
  log.info('ラボ着地: '+JSON.stringify(now));
  if(/case=fin-base-v1/.test(now.url))log.ok('ラボURLに case=fin-base-v1 が載る');
  if(/フィン/.test(now.body))log.ok('ラボ側でフィンの文脈が表示される');
  await target.screenshot({path:SHOTS+'u2h-case-lab-375.png'});
}
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U2h DONE');
