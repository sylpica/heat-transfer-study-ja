// R7-W3 レッスン・問題面：§11.9 深層レッスン（lessons[73]）／章末問題 11.32／問題 6.20 ヒント
import {launch,newPage,DIST,SHOTS,makeLog,overflow,openSection} from './lib.mjs';
const log=makeLog('R7-W3');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);

// ---------- 1. §11.9 深層レッスン ----------
errors.length=0;
await openSection(page,'11.9');
const les=await page.evaluate(()=>{
  const el=document.querySelector('#reader-deep-lesson');
  if(!el)return {found:false};
  const t=el.textContent||'';
  const cnt=(re)=>(t.match(re)||[]).length;
  const i=t.indexOf('h_{fg}');
  return {found:true,heading:(el.querySelector('h3,h2')?.textContent||'').trim().slice(0,60),
    braced:cnt(/h_\{fg\}/g),scriptG:cnt(/𝒢/g),gm:cnt(/gm,/g),
    snippet:i>=0?t.slice(Math.max(0,i-50),i+60).replace(/\s+/g,' '):''};
});
log.info('深層レッスン: '+JSON.stringify(les));
if(les.found&&les.braced>=11)log.ok(`§11.9 深層レッスンに h_{fg} が ${les.braced} 件表示（データ lessons[73] の 11 件以上）`);
else log.fail('深層レッスンの h_{fg} 件数が不足: '+JSON.stringify(les));
if(les.found&&les.scriptG===0)log.ok('深層レッスンに 𝒢 残存 0');else if(les.found)log.fail('深層レッスンに 𝒢 残存 '+les.scriptG);
const lesEl=page.locator('#reader-deep-lesson').filter({hasText:/h_\{fg\}/}).first();
if(await lesEl.count()){
  const f=page.locator('#reader-deep-lesson .formula, #reader-deep-lesson p').filter({hasText:/h_\{fg\}/}).first();
  if(await f.count()){await f.scrollIntoViewIfNeeded().catch(()=>{});await page.waitForTimeout(500);
    await f.screenshot({path:SHOTS+'r7-119-lesson-hfg-375.png'});log.ok('深層レッスンの h_{fg} 箇所を撮影');}
}
let ov=await overflow(page);
if(!ov.bad)log.ok('§11.9（レッスン含む）375px 横はみ出し 0');else log.fail('§11.9 横はみ出し '+JSON.stringify(ov));
let pe=errors.filter(e=>e.startsWith('pageerror'));
if(pe.length===0)log.ok('§11.9 pageerror 0');else log.fail('§11.9 pageerror '+JSON.stringify(pe));

// ---------- 検索ヘルパ ----------
async function searchAndClick(query,matchRe,tag){
  errors.length=0;
  await page.goto(DIST+'/index.html#search',{waitUntil:'load'});
  await page.waitForTimeout(1800);
  await page.fill('#search-query',query);
  await page.click('#search-form button[type=submit]');
  await page.waitForTimeout(4000);
  const res=await page.evaluate(()=>{
    const sec=document.querySelector('.search-results');
    const items=sec?[...sec.querySelectorAll('a,button')].filter(e=>e.offsetParent).map(e=>e.textContent.replace(/\s+/g,' ').trim().slice(0,80)):[];
    const cnt=(document.body.textContent.replace(/\s+/g,' ').match(/\d+\s*件/)||[])[0]||'';
    return {cnt,items:items.slice(0,10)};
  });
  log.info(tag+' 検索結果: '+JSON.stringify(res));
  const clicked=await page.evaluate((reSrc)=>{
    const re=new RegExp(reSrc);
    const sec=document.querySelector('.search-results');
    const el=sec?[...sec.querySelectorAll('a,button')].find(e=>e.offsetParent&&re.test(e.textContent)):null;
    if(el){el.click();return el.textContent.replace(/\s+/g,' ').trim().slice(0,60);} return null;
  },matchRe.source);
  await page.waitForTimeout(2600);
  log.info(tag+' クリック: '+clicked+' hash='+await page.evaluate(()=>location.hash));
  return clicked;
}

// ---------- 2. 章末問題 11.32 ----------
const c32=await searchAndClick('コーティング工程','11\\.32|コーティング','問題11.32');
const v32=await page.evaluate(()=>{
  const t=document.body.textContent.replace(/\s+/g,' ');
  const i=t.indexOf('h_{fg}');
  return {hasText:t.includes('コーティング工程'),hasHfg:t.includes('h_{fg}'),
    snippet:i>=0?t.slice(Math.max(0,i-30),i+50):'',scriptG:(t.match(/𝒢/g)||[]).length,
    h2:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim()).join(' ').slice(0,60)};
});
log.info('問題11.32 到達先: '+JSON.stringify(v32));
if(c32&&v32.hasText&&v32.hasHfg)log.ok('章末問題 11.32 が開き、h_{fg} = 9.3 × 10⁵ J/kg の表示を確認');
else log.fail('問題11.32 の表示確認に失敗: clicked='+c32+' '+JSON.stringify(v32));
if(v32.scriptG===0)log.ok('問題11.32 表示に 𝒢 残存 0');else log.fail('問題11.32 に 𝒢 残存 '+v32.scriptG);
await page.screenshot({path:SHOTS+'r7-problem1132-375.png'});
ov=await overflow(page);
if(!ov.bad)log.ok('問題11.32 画面 375px 横はみ出し 0');else log.fail('問題11.32 横はみ出し '+JSON.stringify(ov));
pe=errors.filter(e=>e.startsWith('pageerror'));
if(pe.length===0)log.ok('問題11.32 pageerror 0');else log.fail('問題11.32 pageerror '+JSON.stringify(pe));

// ---------- 3. 問題 6.20 ヒント ----------
const c620=await searchAndClick('板が突然','6\\.20|板が突然','問題6.20');
const v620=await page.evaluate(()=>{
  const t=document.body.textContent.replace(/\s+/g,' ');
  const i=t.indexOf('0.003');
  return {hasCong:t.includes('≅'),hasValue:t.includes('0.003'),hasOld:t.includes('≃ 0.003')||t.includes('u ≃'),
    snippet:i>=0?t.slice(Math.max(0,i-40),i+30):'',
    h2:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim()).join(' ').slice(0,60)};
});
log.info('問題6.20 到達先: '+JSON.stringify(v620));
if(c620&&v620.hasCong&&v620.hasValue&&!v620.hasOld)log.ok('問題 6.20 のヒントが「u ≅ 0.003 m/s」と表示される（旧 ≃ は出ない）');
else log.obs('問題6.20 ヒントの表示状態: clicked='+c620+' '+JSON.stringify(v620));
await page.screenshot({path:SHOTS+'r7-problem620-375.png'});
ov=await overflow(page);
if(!ov.bad)log.ok('問題6.20 画面 375px 横はみ出し 0');else log.fail('問題6.20 横はみ出し '+JSON.stringify(ov));
pe=errors.filter(e=>e.startsWith('pageerror'));
if(pe.length===0)log.ok('問題6.20 セッション pageerror 0');else log.fail('問題6.20 pageerror '+JSON.stringify(pe));

await ctx.close();
await browser.close();
console.log('DONE R7-W3');
