import {launch,newPage,DIST,makeLog} from './lib.mjs';
const log=makeLog('U8');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
// 分野マップ→問題
await page.goto(DIST+'/index.html#map',{waitUntil:'networkidle'});
await page.waitForTimeout(900);
await page.evaluate(()=>{const a=[...document.querySelectorAll('a,button')].find(e=>/この分野の問題を解く/.test(e.textContent));a?.click();});
await page.waitForTimeout(1000);
let st=await page.evaluate(()=>({hash:location.hash,h:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim().slice(0,30)).slice(0,3),
  field:document.querySelector('select[name=field]')?.selectedOptions[0]?.textContent||''}));
log.info('マップ→問題: '+JSON.stringify(st));
if(/#quiz/.test(st.hash))log.ok('分野マップから分野指定で問題画面へ進める');
// 読書の日英切替
await page.goto(DIST+'/index.html#reader/1.1',{waitUntil:'networkidle'});
await page.waitForTimeout(1000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='英語');b?.click();});
await page.waitForTimeout(900);
st=await page.evaluate(()=>({notice:[...document.querySelectorAll('main p, main div')].map(e=>e.textContent.trim()).filter(t=>/英語|PDF/.test(t)&&t.length<120).slice(0,3)}));
log.info('英語切替後: '+JSON.stringify(st));
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
