// F2 アプリ内検索：章末問題・参考文献の絞り込みと結果への着地（375px・ライト）
import {launch,newPage,DIST,SHOTS,makeLog,overflow,errorSummary} from './lib.mjs';
const log=makeLog('F2');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(60000);
const notFound=[];
page.on('response',r=>{if(r.status()===404)notFound.push(r.url().replace(DIST,''));});
const ovCheck=async(tag)=>{const ov=await overflow(page);if(!ov.bad)log.ok(tag+' 375px 横はみ出し 0');else log.fail(tag+' 横はみ出し: '+JSON.stringify(ov));};

await page.goto(DIST+'/index.html#search',{waitUntil:'load'});
await page.waitForTimeout(2200);
const inputSel=await page.evaluate(()=>{
  const i=document.querySelector('#search-query, .search-box input, input[type="search"], input[name="query"]');
  return i?{id:i.id,name:i.getAttribute('name'),ph:i.getAttribute('placeholder')}:null;
});
log.info('検索入力欄: '+JSON.stringify(inputSel));
const input=page.locator('#search-query').first();
await input.fill('コルクボード');
await page.click('#search-form button[type="submit"]');
await page.waitForTimeout(2500);
async function resultInfo(){
  return page.evaluate(()=>({
    cards:document.querySelectorAll('.result-card').length,
    kinds:[...document.querySelectorAll('.result-card .result-meta')].map(m=>m.textContent.replace(/\s+/g,' ').trim().slice(0,40)),
    more:document.querySelector('.search-more p')?.textContent.trim()||'',
    empty:document.querySelector('.empty-state h3')?.textContent.trim()||''}));
}
const allKinds=await resultInfo();
log.info('「コルクボード」全種別: '+JSON.stringify(allKinds));
// 種別=章末問題に絞る（フィルタは検索フォーム送信時に FormData として適用される）
await page.evaluate(()=>{const s=document.querySelector('select[name="kind"]');if(s)s.value='chapter-problem';});
await page.click('#search-form button[type="submit"]');
await page.waitForTimeout(3500); // 章末データの遅延読み込みを待つ
const probOnly=await resultInfo();
log.info('種別=章末問題: '+JSON.stringify(probOnly));
if(probOnly.cards>=1&&probOnly.kinds.every(k=>k.includes('章末問題')))log.ok('検索を「章末問題」に絞ると章末問題だけが残る');
else log.fail('章末問題への絞り込みが効かない: '+JSON.stringify(probOnly));
await ovCheck('検索結果（章末問題）');
// 結果をクリックして着地（問題1.1 が開いた状態で読書画面へ）
await page.evaluate(()=>{document.querySelector('.result-card .result-link')?.click();});
await page.waitForTimeout(3500);
const landing=await page.evaluate(()=>{
  const item=document.querySelector('#chapter-extra-problem-1-1');
  return {route:location.hash, itemExists:!!item, itemOpen:item?item.hasAttribute('open'):false,
    panel:!!document.querySelector('#chapter-extras-panel')};
});
log.info('着地: '+JSON.stringify(landing));
if(landing.itemExists&&landing.itemOpen)log.ok('検索結果から問題1.1へ着地し、項目が開いた状態で表示される');
else log.fail('検索結果からの着地が不完全: '+JSON.stringify(landing));
await ovCheck('着地後の読書画面');
await page.screenshot({path:SHOTS+'f2-search-landing-375.png'});

// 参考文献の検索
await page.goto(DIST+'/index.html#search',{waitUntil:'load'});
await page.waitForTimeout(1500);
await page.locator('#search-query').first().fill('Fourier');
await page.click('#search-form button[type="submit"]');
await page.waitForTimeout(2000);
await page.evaluate(()=>{const s=document.querySelector('select[name="kind"]');if(s)s.value='chapter-reference';});
await page.click('#search-form button[type="submit"]');
await page.waitForTimeout(3500);
const refOnly=await resultInfo();
log.info('種別=参考文献「Fourier」: '+JSON.stringify(refOnly));
const refCardText=await page.evaluate(()=>[...document.querySelectorAll('.result-card')].map(c=>c.textContent.replace(/\s+/g,' ').trim()).join(' || ').slice(0,600));
log.info('参考文献カード群: '+refCardText);
if(refOnly.cards>=1&&refOnly.kinds.every(k=>k.includes('参考文献'))&&/熱の解析的理論/.test(refCardText))log.ok('「参考文献」種別で Fourier の書誌だけに絞って検索できる');
else log.fail('参考文献の検索・絞り込みが効かない: '+JSON.stringify(refOnly.kinds)+' / '+refCardText);
await ovCheck('検索結果（参考文献）');
log.info('404 リクエスト: '+JSON.stringify([...new Set(notFound)]));
errorSummary(log,errors,'F2');
await ctx.close();
await browser.close();
console.log('F2 DONE');
