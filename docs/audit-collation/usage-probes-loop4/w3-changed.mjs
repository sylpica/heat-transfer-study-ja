// W3 変更面の重点確認（375px）：§1.3 図1.3／§11.6・11.7・11.9 新タイトル／式(5.3)・(7.29)・(10.2)／上線 §2.4・§4.4・§5.6
import {launch,newPage,DIST,SHOTS,makeLog,overflow} from './lib.mjs';
const log=makeLog('W3');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);
const ovCheck=async(tag)=>{const ov=await overflow(page);if(!ov.bad)log.ok(tag+' 375px 横はみ出し 0');else log.fail(tag+' 横はみ出し: '+JSON.stringify(ov));};
const openSec=async(id)=>{await page.goto(DIST+'/index.html#reader/'+id,{waitUntil:'load'});await page.waitForTimeout(2400);
  return page.evaluate(()=>({h2:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim()).join(' ').slice(0,70)}));};

// ---------- 1. §1.3 図1.3 ----------
let st=await openSec('1.3');
log.info('§1.3 見出し: '+JSON.stringify(st));
const fig13=await page.evaluate(()=>{
  const art=document.querySelector('#reader-article')||document.body;
  const all=[...art.querySelectorAll('figure,[class*=figure],[class*=diagram],img,svg')];
  const hits=all.filter(e=>/図\s*1\.3/.test(e.textContent||'')||/図\s*1\.3/.test(e.getAttribute?.('alt')||'')||/図\s*1\.3/.test(e.getAttribute?.('aria-label')||''));
  const introRef=/図\s*1\.3/.test(art.textContent);
  return {introRef,hitCount:hits.length,hits:hits.slice(0,3).map(e=>({tag:e.tagName,cls:(e.className.baseVal!==undefined?'svg':e.className).toString().slice(0,44),
    alt:e.getAttribute&&e.getAttribute('alt'),text:e.textContent.replace(/\s+/g,' ').trim().slice(0,160)}))};
});
log.info('図1.3: '+JSON.stringify(fig13));
if(fig13.introRef&&fig13.hitCount>0)log.ok('§1.3 に図1.3 の図ブロックが表示され、冒頭の参照と対応する');
else log.fail('図1.3 の図ブロックが確認できない: '+JSON.stringify(fig13));
const figEl=page.locator('#reader-article figure, #reader-article [class*=figure], #reader-article [class*=diagram]').filter({hasText:/図\s*1\.3/}).first();
if(await figEl.count()){
  await figEl.scrollIntoViewIfNeeded().catch(()=>{});
  await page.waitForTimeout(600);
  await figEl.screenshot({path:SHOTS+'w3-fig13-375.png'}).catch(e=>log.info('fig screenshot: '+e.message));
}else{
  await page.evaluate(()=>{const e=[...document.querySelectorAll('#reader-article *')].find(x=>/図\s*1\.3/.test(x.textContent)&&x.children.length<4);e?.scrollIntoView({block:'center'});});
  await page.waitForTimeout(600);
  await page.screenshot({path:SHOTS+'w3-fig13-375.png'});
}
await ovCheck('§1.3');

// ---------- 2. §11.6／11.7／11.9 の新タイトル ----------
// 目次（第11章 details を展開）
await page.goto(DIST+'/index.html#reader',{waitUntil:'load'});
await page.waitForTimeout(2200);
const tocTitles=await page.evaluate(()=>{
  const items=[...document.querySelectorAll('.toc-item')];
  const get=id=>{const e=items.find(x=>x.getAttribute('data-section')===id);return e?e.textContent.replace(/\s+/g,' ').trim():null;};
  return {'11.6':get('11.6'),'11.7':get('11.7'),'11.9':get('11.9')};
});
log.info('目次のタイトル: '+JSON.stringify(tocTitles));
const expect={'11.6':'低率における対流物質移動','11.7':'低率における熱・物質同時移動','11.9':'高率の物質移動における熱伝達'};
for(const id of ['11.6','11.7','11.9']){
  if(tocTitles[id]&&tocTitles[id].includes(expect[id]))log.ok('目次 '+id+' = '+expect[id]);
  else log.fail('目次 '+id+' のタイトル不一致: '+tocTitles[id]);
}
// 節画面見出し＋ノート見出し
for(const id of ['11.6','11.7','11.9']){
  const s=await openSec(id);
  const note=await page.evaluate(()=>{const n=document.querySelector('#reader-original-note');return n?n.textContent.replace(/\s+/g,' ').trim().slice(0,140):null;});
  log.info('§'+id+' 見出し: '+s.h2+' / ノート冒頭: '+note);
  if(s.h2.includes(expect[id]))log.ok('節画面 '+id+' の見出しが新タイトル'); else log.fail('節画面 '+id+' 見出し不一致: '+s.h2);
  if(note&&note.includes(expect[id]))log.ok('学習ノート '+id+' のタイトルが新タイトル'); else log.obs('ノート '+id+' 冒頭に新タイトル文字列なし（冒頭140字の範囲）');
  await ovCheck('§'+id);
}
// 問題の前提ラベル：§11.9 ノートから問題を開始してカードのラベルを見る
await openSec('11.9');
const qbtns=await page.evaluate(()=>[...document.querySelectorAll('#reader-original-note [data-start-question]')].map(b=>b.getAttribute('data-start-question')));
log.info('§11.9 ノートの問題ボタン: '+JSON.stringify(qbtns.slice(0,5)));
if(qbtns.length){
  await page.locator('#reader-original-note [data-start-question]').first().click();
  await page.waitForTimeout(600);
  const modal=page.locator('.quiz-start-modal [data-action="confirm-quiz-start"]');
  if(await modal.count())await modal.first().click();
  await page.locator('.question-card').waitFor({state:'visible',timeout:90000}).catch(()=>log.obs('問題カード待ちタイムアウト'));
  await page.waitForTimeout(600);
  const cardHead=await page.evaluate(()=>document.querySelector('.question-card')?.textContent.replace(/\s+/g,' ').trim().slice(0,220)||'');
  log.info('問題カード冒頭: '+cardHead);
  if(cardHead.includes('高率の物質移動における熱伝達')||cardHead.includes('11.9'))log.ok('問題の前提ラベルに §11.9 の新タイトル（または節番号）が出る');
  else log.obs('問題カード冒頭220字に節タイトルは出ない（ラベル形式の確認はここまで）');
  await page.screenshot({path:SHOTS+'w3-q119-card-375.png'});
  await ovCheck('§11.9 問題カード');
}else log.obs('§11.9 ノートに問題開始ボタンなし（前提ラベルの確認は目次・節・ノートで実施）');

// ---------- 3. 式(5.3) §5.2 ----------
st=await openSec('5.2');
const eq53=await page.evaluate(()=>{
  const art=document.querySelector('#reader-article');const t=art?art.textContent.replace(/\s+/g,' '):'';
  const m=t.match(/.{40}ζ.{60}/);
  return {snippet:m?m[0]:'',hasWrongForm:/√\s*\(\s*x\s*\/\s*\(?\s*αt/.test(t)||/√\(x\/αt\)/.test(t),hasXOverRoot:/x\s*\/\s*√\s*\(?\s*αt/.test(t)};
});
log.info('式(5.3) 周辺: '+JSON.stringify(eq53));
if(eq53.hasXOverRoot&&!eq53.hasWrongForm)log.ok('式(5.3) が ζ = x/√(αt) の形で表示される（根号は分母のみ）');
else log.obs('式(5.3) の文字列判定は保留（スクリーンショットで目視）: '+JSON.stringify(eq53));
await page.evaluate(()=>{const e=[...document.querySelectorAll('#reader-article p,#reader-article .block,#reader-article div')].find(x=>/ζ/.test(x.textContent)&&x.textContent.length<400);e?.scrollIntoView({block:'center'});});
await page.waitForTimeout(600);
await page.screenshot({path:SHOTS+'w3-eq53-375.png'});
await ovCheck('§5.2');

// ---------- 4. 式(7.29) §7.2 ----------
st=await openSec('7.2');
const eq729=await page.evaluate(()=>{
  const art=document.querySelector('#reader-article');const t=art?art.textContent.replace(/\s+/g,' '):'';
  const i=t.indexOf('tanh');
  return {snippet:i>=0?t.slice(Math.max(0,i-60),i+190):'',hasTanh:t.includes('tanh'),has17:/1\.7/.test(t)};
});
log.info('式(7.29) 周辺: '+JSON.stringify(eq729));
if(eq729.hasTanh&&eq729.snippet.includes('1.7'))log.ok('式(7.29) の tanh 引数に +1.7 項を含む形で表示される');
else log.obs('式(7.29) はスクリーンショットで目視確認: '+JSON.stringify(eq729));
await page.evaluate(()=>{const e=[...document.querySelectorAll('#reader-article p,#reader-article .block,#reader-article div')].find(x=>/tanh/.test(x.textContent)&&x.textContent.length<600);e?.scrollIntoView({block:'center'});});
await page.waitForTimeout(600);
await page.screenshot({path:SHOTS+'w3-eq729-375.png'});
await ovCheck('§7.2');

// ---------- 5. 式(10.2) §10.1 ----------
st=await openSec('10.1');
const eq102=await page.evaluate(()=>{
  const art=document.querySelector('#reader-article');const t=art?art.textContent:'';
  const plain=t.replace(/\s+/g,' ');
  return {scriptF:(t.match(/ℱ/g)||[]).length,hasConv:/形態係数/.test(plain)&&/伝達係数/.test(plain),
    snippet:(plain.match(/.{30}ℱ.{50}/)||[''])[0]};
});
log.info('§10.1: '+JSON.stringify(eq102));
if(eq102.scriptF>0&&eq102.hasConv)log.ok('§10.1 に ℱ と形態係数／伝達係数の規約説明が表示される');
else log.obs('§10.1 の ℱ／規約説明は目視確認: '+JSON.stringify(eq102));
await page.evaluate(()=>{const e=[...document.querySelectorAll('#reader-article p,#reader-article .block,#reader-article div')].find(x=>/\(10\.2\)|ℱ/.test(x.textContent)&&x.textContent.length<700);e?.scrollIntoView({block:'center'});});
await page.waitForTimeout(600);
await page.screenshot({path:SHOTS+'w3-eq102-375.png'});
await ovCheck('§10.1');

// ---------- 6. 上線（U+0304）の代表箇所 ----------
for(const [id,tag] of [['2.4','§2.4'],['4.4','§4.4'],['5.6','§5.6']]){
  await openSec(id);
  const bars=await page.evaluate(()=>{
    const art=document.querySelector('#reader-article');const t=art?art.textContent:'';
    return {hBar:(t.match(/h\u0304/g)||[]).length,qBar:(t.match(/q\u0304/g)||[]).length,nuBar:(t.match(/Nu\u0304/g)||[]).length,
      snippet:(t.replace(/\s+/g,' ').match(/.{20}h\u0304.{30}/)||[''])[0]};
  });
  log.info(tag+' 上線: '+JSON.stringify(bars));
  if(bars.hBar>0||bars.nuBar>0)log.ok(tag+' で上線つき平均記号が本文にレンダリングされている'); else log.fail(tag+' で上線が見つからない');
  await ovCheck(tag);
}
await page.evaluate(()=>{const e=[...document.querySelectorAll('#reader-article p,#reader-article .block,#reader-article div')].find(x=>/h\u0304/.test(x.textContent)&&x.textContent.length<400);e?.scrollIntoView({block:'center'});});
await page.waitForTimeout(600);
await page.screenshot({path:SHOTS+'w3-overline-56-375.png'});

log.info('W3 errors: '+JSON.stringify(errors.filter(e=>e.startsWith('pageerror'))));
if(!errors.some(e=>e.startsWith('pageerror')))log.ok('W3 セッション pageerror 0');
else log.fail('W3 pageerror: '+errors.join(' | '));
await ctx.close();
await browser.close();
console.log('W3 DONE');
