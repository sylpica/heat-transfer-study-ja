// U2i フィン深掘り問題（supp-deep-fin-base-heat-v1）→ ケースリンク → ラボ着地と条件適用
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U2i');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#quiz',{waitUntil:'networkidle'});
await page.waitForTimeout(900);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/問題一覧/.test(b.textContent));b?.click();});
await page.waitForTimeout(1100);
const opened=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/断熱先端の一定断面フィンで、k=200/.test(b.textContent));if(!b)return false;b.scrollIntoView();b.click();return true;});
log.info('対象問題を開いた: '+opened);
await page.waitForTimeout(1100);
const card=await page.evaluate(()=>document.querySelector('.question-card')?.textContent.replace(/\s+/g,' ').slice(0,120));
log.info('カード: '+card);
// 正解は 5.166 W（選択肢 index 2）
await page.click('label.answer-choice >> nth=2');
await page.evaluate(()=>{document.querySelector('.answer-submit')?.click();});
await page.waitForTimeout(900);
const st=await page.evaluate(()=>({verdict:(document.querySelector('.answer-feedback')?.textContent||'').replace(/\s+/g,' ').slice(0,50),
  links:[...document.querySelectorAll('main a')].filter(a=>/case=|動的実験で観察/.test((a.getAttribute('href')||'')+' '+a.textContent)).map(a=>({href:a.getAttribute('href'),text:a.textContent.trim().slice(0,44)}))}));
log.info('回答後: '+JSON.stringify(st));
if(st.links.length)log.ok('ケース受け口リンクが表示される: '+JSON.stringify(st.links[0]));else log.fail('ケースリンクが表示されない');
await page.screenshot({path:SHOTS+'u2i-case-link-375.png'});
if(st.links.length){
  const [popup]=await Promise.all([
    ctx.waitForEvent('page',{timeout:5000}).catch(()=>null),
    page.evaluate(()=>{const a=[...document.querySelectorAll('main a')].find(a=>/case=/.test(a.getAttribute('href')||''));a.click();}),
  ]);
  const target=popup||page;
  await target.waitForTimeout(2600);
  const now=await target.evaluate(()=>({url:location.href,title:document.title,
    body:document.body.textContent.replace(/\s+/g,' ').slice(0,500),
    inputs:[...document.querySelectorAll('input')].slice(0,10).map(i=>(i.id||i.name)+'='+i.value)}));
  log.info('ラボ着地: '+JSON.stringify(now));
  if(/case=fin-base-v1/.test(now.url))log.ok('ラボURLに case=fin-base-v1');
  if(/断熱先端フィンの問題条件/.test(now.body))log.ok('ラボに問題条件の説明文が表示される（ケース適用）');
  await target.screenshot({path:SHOTS+'u2i-case-lab-375.png'});
}
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U2i DONE');
