// W1d 検索の正式フロー確認：送信→結果→結果クリックで節へ／対象=用語集での検索
import {launch,newPage,DIST,SHOTS,makeLog,overflow} from './lib.mjs';
const log=makeLog('W1d');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);
await page.goto(DIST+'/index.html#search',{waitUntil:'load'});
await page.waitForTimeout(1800);
await page.fill('#search-query','熱抵抗');
await page.click('#search-form button[type=submit]');
await page.waitForTimeout(3000);
const r1=await page.evaluate(()=>{
  const sec=document.querySelector('.search-results');
  const links=sec?[...sec.querySelectorAll('a,button')].filter(e=>e.offsetParent).map(e=>e.textContent.replace(/\s+/g,' ').trim().slice(0,46)).slice(0,6):[];
  const cnt=(document.body.textContent.replace(/\s+/g,' ').match(/\d+\s*件/)||[])[0]||'';
  return {cnt,links};
});
log.info('検索「熱抵抗」: '+JSON.stringify(r1));
if(r1.links.length)log.ok('検索結果（リンク付き）が表示される'); else log.fail('検索結果リンクが出ない');
const clicked=await page.evaluate(()=>{
  const sec=document.querySelector('.search-results');
  const el=sec?[...sec.querySelectorAll('a,button')].find(e=>e.offsetParent&&/熱抵抗と電気回路の類推/.test(e.textContent)):null;
  if(el){el.click();return el.textContent.replace(/\s+/g,' ').trim().slice(0,40);} return null;
});
await page.waitForTimeout(2200);
const nav=await page.evaluate(()=>({hash:location.hash,h2:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim()).join(' ').slice(0,50)}));
log.info('結果クリック: '+clicked+' → '+JSON.stringify(nav));
if(/2\.3/.test(nav.h2))log.ok('検索結果から §2.3 の読書画面へ遷移できる'); else log.fail('検索結果から節へ遷移できない: '+JSON.stringify(nav));
// 対象=用語集で「フィン効率」
await page.goto(DIST+'/index.html#search',{waitUntil:'load'});
await page.waitForTimeout(1500);
await page.fill('#search-query','フィン効率');
await page.evaluate(()=>{const s=document.querySelector('#search-form select[name=kind]');if(s){s.value='glossary';s.dispatchEvent(new Event('change',{bubbles:true}));}});
await page.click('#search-form button[type=submit]');
await page.waitForTimeout(3000);
const r2=await page.evaluate(()=>{
  const sec=document.querySelector('.search-results');
  return {text:sec?sec.textContent.replace(/\s+/g,' ').trim().slice(0,200):'',hasTerm:sec?sec.textContent.includes('フィン効率'):false};
});
log.info('用語集検索: '+JSON.stringify(r2));
if(r2.hasTerm)log.ok('対象=用語集の検索で「フィン効率」がヒットする'); else log.fail('用語集検索でヒットしない');
await page.screenshot({path:SHOTS+'w1d-search-glossary-375.png'});
const ov=await overflow(page);
if(!ov.bad)log.ok('検索画面 375px 横はみ出し 0'); else log.fail('検索画面 横はみ出し: '+JSON.stringify(ov));
log.info('W1d errors: '+JSON.stringify(errors.filter(e=>e.startsWith('pageerror'))));
if(!errors.some(e=>e.startsWith('pageerror')))log.ok('W1d セッション pageerror 0');
await ctx.close();
await browser.close();
console.log('W1d DONE');
