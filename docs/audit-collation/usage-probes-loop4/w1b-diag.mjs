// W1b 切り分け：検索結果の DOM 構造／ブックマーク保持の再測定／判定後解説の表示経路
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('W1b');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);

// ---------- 検索の構造 ----------
await page.goto(DIST+'/index.html#search',{waitUntil:'load'});
await page.waitForTimeout(1800);
const inp=page.locator('#search-input, #search input, input[type=search]').first();
await inp.fill('熱抵抗');
await page.waitForTimeout(2500);
const s1=await page.evaluate(()=>{
  const main=document.querySelector('#search')||document.body;
  const items=[...main.querySelectorAll('li,article,.search-result,[data-search-result]')].filter(e=>e.offsetParent).slice(0,6).map(e=>({tag:e.tagName,cls:e.className.slice(0,40),text:e.textContent.replace(/\s+/g,' ').trim().slice(0,70)}));
  return {items,htmlSample:(main.querySelector('ul,ol')?.outerHTML||'').slice(0,600)};
});
log.info('検索「熱抵抗」結果要素: '+JSON.stringify(s1.items));
log.info('検索結果リストHTML: '+s1.htmlSample);
await inp.fill('フィン効率');
await page.waitForTimeout(2500);
const s2=await page.evaluate(()=>{
  const main=document.querySelector('#search')||document.body;
  const items=[...main.querySelectorAll('li,article,.search-result,[data-search-result]')].filter(e=>e.offsetParent).slice(0,6).map(e=>({tag:e.tagName,cls:e.className.slice(0,40),text:e.textContent.replace(/\s+/g,' ').trim().slice(0,70)}));
  const bodyText=main.textContent.replace(/\s+/g,' ');
  return {items,フィン効率含む:bodyText.includes('フィン効率'),件数表示:(bodyText.match(/\d+\s*件/)||[])[0]||''};
});
log.info('検索「フィン効率」: '+JSON.stringify(s2));
// 結果をクリックして遷移できるか（熱抵抗で再検索）
await inp.fill('熱抵抗');
await page.waitForTimeout(2500);
const clicked=await page.evaluate(()=>{
  const main=document.querySelector('#search')||document.body;
  const el=[...main.querySelectorAll('a,button,li,article')].find(e=>e.offsetParent&&/2\.3|熱抵抗と電気/.test(e.textContent)&&e.textContent.length<200);
  if(el){const t=el.textContent.replace(/\s+/g,' ').trim().slice(0,40);(el.closest('a,button')||el).click();return t;}
  return null;
});
await page.waitForTimeout(2200);
const nav=await page.evaluate(()=>({hash:location.hash,h2:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim()).join(' ').slice(0,50)}));
log.info('検索結果クリック: '+clicked+' → '+JSON.stringify(nav));
if(nav.h2.includes('2.3'))log.ok('検索結果から §2.3 へ遷移できる'); else log.obs('遷移先: '+JSON.stringify(nav));

// ---------- ブックマーク保持の再測定 ----------
await page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
await page.waitForTimeout(1800);
await page.evaluate(()=>{const row=document.querySelector('#term-fin-efficiency');const b=row?[...row.querySelectorAll('button')].find(x=>/☆|★/.test(x.textContent)):null;b?.click();});
await page.waitForTimeout(600);
const lsBefore=await page.evaluate(()=>{const raw=localStorage.getItem('heat-study-ja:v1');if(!raw)return null;const j=JSON.parse(raw);const s=JSON.stringify(j);return {len:s.length,フィン効率:s.includes('fin-efficiency')};});
log.info('ブックマーク直後の localStorage: '+JSON.stringify(lsBefore));
await page.reload({waitUntil:'load'});
await page.waitForTimeout(2500);
const afterNoFilter=await page.evaluate(()=>{const row=document.querySelector('#term-fin-efficiency');if(!row)return{row:false};return{row:true,visible:!!row.offsetParent,btns:[...row.querySelectorAll('button')].map(b=>b.textContent.trim().slice(0,12))};});
log.info('リロード後（フィルターなし）: '+JSON.stringify(afterNoFilter));
const gInp=page.locator('#glossary-search, input[type=search], .glossary-tools input').first();
if(await gInp.count()){await gInp.fill('フィン効率');await page.waitForTimeout(1500);}
const afterFilter=await page.evaluate(()=>{const row=document.querySelector('#term-fin-efficiency');if(!row)return{row:false};return{row:true,btns:[...row.querySelectorAll('button')].map(b=>b.textContent.trim().slice(0,12))};});
log.info('リロード後（フィルターあり）: '+JSON.stringify(afterFilter));
const lsAfter=await page.evaluate(()=>{const raw=localStorage.getItem('heat-study-ja:v1');return raw?JSON.stringify(JSON.parse(raw)).includes('fin-efficiency'):null;});
log.info('リロード後の localStorage に fin-efficiency: '+lsAfter);
if(lsAfter&&(afterFilter.btns||[]).some(t=>t.includes('★')))log.ok('リロード後もブックマーク保持（★表示＋localStorage）の両方で確認');
else if(lsAfter)log.obs('localStorage には保持されるが ★ 表示の読み取り方が要再確認: '+JSON.stringify(afterFilter));
else log.fail('リロード後に localStorage からブックマークが消えている');

// ---------- 判定後解説の表示経路 ----------
await page.goto(DIST+'/index.html#reader/6.1',{waitUntil:'load'});
const qbtn=page.locator('#reader-original-note [data-start-question="supp-next-local-versus-average-v1"]');
await qbtn.waitFor({state:'visible',timeout:90000}).catch(()=>log.obs('開始ボタン待ちタイムアウト'));
await qbtn.first().click();
await page.waitForTimeout(600);
const modal=page.locator('.quiz-start-modal [data-action="confirm-quiz-start"]');
if(await modal.count())await modal.first().click();
await page.locator('.question-card').waitFor({state:'visible',timeout:90000});
await page.waitForTimeout(400);
await page.evaluate(()=>{const l=[...document.querySelectorAll('.question-card .answer-choice')].find(x=>x.textContent.includes('局所値と平均は別の量であり、平均には分布の積分が必要'));l?.click();});
await page.waitForTimeout(400);
await page.evaluate(()=>{document.querySelector('.question-card button.answer-submit')?.click();});
await page.waitForFunction(()=>/正解|不正解/.test(document.querySelector('.question-card')?.textContent||''),null,{timeout:60000}).catch(()=>{});
await page.waitForTimeout(600);
const cardState=await page.evaluate(()=>{
  const card=document.querySelector('.question-card');
  const btns=[...card.querySelectorAll('button')].map(b=>b.textContent.trim().slice(0,24));
  return {btns,text:card.textContent.replace(/\s+/g,' ').trim()};
});
log.info('判定後ボタン: '+JSON.stringify(cardState.btns));
log.info('判定後カード全文: '+cardState.text.slice(0,900));
if(cardState.text.includes('一般に平均'))log.ok('解説は判定直後に表示されている');
else{
  const expBtn=cardState.btns.find(t=>/解説/.test(t));
  if(expBtn){
    await page.evaluate(()=>{const b=[...document.querySelectorAll('.question-card button')].find(x=>/解説/.test(x.textContent));b?.click();});
    await page.waitForTimeout(900);
    const t2=await page.evaluate(()=>document.querySelector('.question-card').textContent.replace(/\s+/g,' ').trim());
    log.info('解説ボタン後のカード: '+t2.slice(0,700));
    if(t2.includes('一般に平均h̄_L=(1/L)∫₀ᴸ h_x dx'))log.ok('「解説」操作で解説（平均の積分定義）が表示される'); else log.obs('解説表示後の文字列でも積分定義は捉えられず');
  } else log.obs('解説ボタンが見当たらない');
}
await page.screenshot({path:SHOTS+'w1b-question-explanation-375.png'});
log.info('W1b errors: '+JSON.stringify(errors.filter(e=>e.startsWith('pageerror'))));
await ctx.close();
await browser.close();
console.log('W1b DONE');
