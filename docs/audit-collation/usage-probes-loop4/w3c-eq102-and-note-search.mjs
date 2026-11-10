// W3c 式(10.1)/(10.2) の表示式そのものの目視＋ノートタイトルの検索経由確認
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('W3c');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);
await page.goto(DIST+'/index.html#reader/10.1',{waitUntil:'load'});
await page.waitForTimeout(2400);
const eqFigs=await page.evaluate(()=>{
  const out=[];
  for(const fig of document.querySelectorAll('#reader-article figure')){
    const cap=fig.querySelector('figcaption')?.textContent.replace(/\s+/g,' ').trim()||'';
    if(/式（10\.[12]）/.test(cap))out.push({cap,body:fig.textContent.replace(/\s+/g,' ').trim().slice(0,150)});
  }
  return out;
});
log.info('§10.1 の式図: '+JSON.stringify(eqFigs));
const fig102=page.locator('#reader-article figure').filter({hasText:/式（10\.2）/}).first();
if(await fig102.count()){
  await fig102.scrollIntoViewIfNeeded().catch(()=>{});
  await page.waitForTimeout(500);
  await page.screenshot({path:SHOTS+'w3c-eq102-viewport-375.png'});
}else log.obs('式（10.2）の figure が見つからない');
// ノートタイトルを検索（対象=独自の日本語節別ノート）で確認
for(const q of ['低率における対流物質移動','高率の物質移動における熱伝達']){
  await page.goto(DIST+'/index.html#search',{waitUntil:'load'});
  await page.waitForTimeout(1500);
  await page.fill('#search-query',q);
  await page.evaluate(()=>{const s=document.querySelector('#search-form select[name=kind]');if(s){s.value='original-note';s.dispatchEvent(new Event('change',{bubbles:true}));}});
  await page.click('#search-form button[type=submit]');
  await page.waitForTimeout(2800);
  const r=await page.evaluate(()=>{const sec=document.querySelector('.search-results');return sec?sec.textContent.replace(/\s+/g,' ').trim().slice(0,220):'';});
  log.info('ノート検索「'+q+'」: '+r);
  if(r.includes(q))log.ok('検索結果にノートの新タイトル「'+q+'」が出る'); else log.obs('検索結果の冒頭に新タイトル文字列なし');
}
log.info('W3c errors: '+JSON.stringify(errors.filter(e=>e.startsWith('pageerror'))));
await ctx.close();
await browser.close();
console.log('W3c DONE');
