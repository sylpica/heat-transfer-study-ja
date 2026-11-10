// F3 用語集フラッシュカード（単語帳）と用語ブックマーク：反転・付け外し・再読み込み後の保持
// 1280px ダークで主操作、375px ライトで保持と幅を確認
import {launch,newPage,DIST,SHOTS,makeLog,overflow,errorSummary} from './lib.mjs';
const log=makeLog('F3');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:1280,height:900,dark:true});
page.setDefaultTimeout(60000);
const ovCheck=async(tag,w)=>{const ov=await overflow(page);if(!ov.bad)log.ok(tag+' '+w+'px 横はみ出し 0');else log.fail(tag+' 横はみ出し: '+JSON.stringify(ov));};

await page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
await page.waitForTimeout(2200);
// 一覧で「フィン効率」をブックマーク
const bmList=await page.evaluate(()=>{
  const row=document.querySelector('#term-fin-efficiency');
  const b=row?.querySelector('[data-term-bookmark]');
  if(!b)return null; const before=b.textContent.trim(); b.click(); return before;
});
await page.waitForTimeout(600);
const bmListAfter=await page.evaluate(()=>document.querySelector('#term-fin-efficiency [data-term-bookmark]')?.textContent.trim());
log.info('一覧ブックマーク: '+bmList+' → '+bmListAfter);
if(bmListAfter==='★')log.ok('用語一覧でブックマークを付けられる（☆→★）');else log.fail('一覧でブックマークが付かない');
// 単語帳モードへ
await page.click('[data-action="glossary-mode"][data-mode="cards"]');
await page.waitForTimeout(900);
const card0=await page.evaluate(()=>({
  side:document.querySelector('.flash-side')?.textContent.trim()||'',
  count:document.querySelector('.flash-count')?.textContent.trim()||'',
  face:document.querySelector('.flash-face')?.textContent.replace(/\s+/g,' ').trim().slice(0,60)||'',
  stage:!!document.querySelector('.flash-stage')}));
log.info('単語帳初期: '+JSON.stringify(card0));
if(card0.stage&&card0.side==='表')log.ok('単語帳が開き、最初のカード表面が表示される');else log.fail('単語帳の初期表示が異常: '+JSON.stringify(card0));
// 反転
await page.click('.flash-face');
await page.waitForTimeout(700);
const card1=await page.evaluate(()=>({
  side:document.querySelector('.flash-side')?.textContent.trim()||'',
  back:document.querySelector('.flash-scroll')?.textContent.replace(/\s+/g,' ').trim().slice(0,80)||''}));
log.info('反転後: '+JSON.stringify(card1));
if(card1.side==='裏'&&card1.back.length>15)log.ok('カードを押すと裏面（説明）に反転する');else log.fail('カードが反転しない: '+JSON.stringify(card1));
await page.screenshot({path:SHOTS+'f3-flashcard-back-1280-dark.png'});
// カード内でブックマーク（表示中の用語）
const inCard=await page.evaluate(()=>{
  const card=document.querySelector('.flash-card');
  const name=card?.querySelector('.flash-term, .flash-face h3, .flash-face .term-name')?.textContent.trim()||card?.textContent.replace(/\s+/g,' ').trim().slice(0,30)||'';
  const b=card?.querySelector('[data-term-bookmark]');
  if(!b)return {name,clicked:false};
  const before=b.textContent.trim(); if(before==='☆')b.click();
  return {name,clicked:true,before};
});
await page.waitForTimeout(600);
const inCardAfter=await page.evaluate(()=>document.querySelector('.flash-card [data-term-bookmark]')?.textContent.trim());
log.info('カード内ブックマーク: '+JSON.stringify(inCard)+' → '+inCardAfter);
if(inCardAfter==='★')log.ok('単語帳カードの中でもブックマークを付けられる');else log.fail('カード内ブックマークが付かない');
// 範囲を「ブックマークのみ」に
await page.selectOption('select[name="flash-scope"]','bookmarks').catch(e=>log.info('scope select: '+e.message));
await page.waitForTimeout(900);
const deckInfo=await page.evaluate(()=>({
  count:document.querySelector('.flash-count')?.textContent.trim()||'',
  face:document.querySelector('.flash-face')?.textContent.replace(/\s+/g,' ').trim().slice(0,50)||''}));
log.info('ブックマークのみデッキ: '+JSON.stringify(deckInfo));
const totalMatch=deckInfo.count.match(/\/\s*(\d+)/);
if(totalMatch&&Number(totalMatch[1])>=1)log.ok('「ブックマークのみ」でブックマーク用語だけのデッキになる（総数 '+totalMatch[1]+'）');
else log.fail('ブックマークのみデッキが成立しない: '+JSON.stringify(deckInfo));
await ovCheck('単語帳（ブックマークのみ）',1280);
// リロード後の保持
await page.reload({waitUntil:'load'});
await page.waitForTimeout(1800);
await page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
await page.waitForTimeout(1800);
const keptMode=await page.evaluate(()=>({
  mode:document.querySelector('[data-action="glossary-mode"][data-mode="cards"]')?.getAttribute('aria-pressed'),
  scope:document.querySelector('select[name="flash-scope"]')?.value||'',
  count:document.querySelector('.flash-count')?.textContent.trim()||''}));
log.info('リロード後の単語帳状態: '+JSON.stringify(keptMode));
if(keptMode.mode==='true')log.ok('リロード後も単語帳モードが保持される');else log.obs('リロード後のモード: '+JSON.stringify(keptMode));
await page.click('[data-action="glossary-mode"][data-mode="list"]');
await page.waitForTimeout(800);
const keptBm=await page.evaluate(()=>document.querySelector('#term-fin-efficiency [data-term-bookmark]')?.textContent.trim());
log.info('リロード後の一覧ブックマーク: '+keptBm);
if(keptBm==='★')log.ok('リロード後も用語ブックマークが保持される');else log.fail('リロード後にブックマークが消えた');
// 375px ライトでも保持確認
const s2=await newPage(browser,{width:375,dark:false});
await s2.page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
await s2.page.waitForTimeout(2000);
const kept375=await s2.page.evaluate(()=>document.querySelector('#term-fin-efficiency [data-term-bookmark]')?.textContent.trim());
log.info('別コンテキスト(375px)では新規端末扱いのためブックマークは無い想定: '+kept375);
const ov2=await overflow(s2.page);
if(!ov2.bad)log.ok('用語集 375px 横はみ出し 0');else log.fail('用語集 375px はみ出し: '+JSON.stringify(ov2));
errors.push(...s2.errors);
await s2.ctx.close();
errorSummary(log,errors,'F3');
await ctx.close();
await browser.close();
console.log('F3 DONE');
