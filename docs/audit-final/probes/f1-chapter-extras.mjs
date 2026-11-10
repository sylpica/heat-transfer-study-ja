// F1 章末問題・参考文献（章エクストラ）と付録参考文献の実操作確認（375px・ライト）
import {launch,newPage,DIST,SHOTS,makeLog,overflow,errorSummary} from './lib.mjs';
const log=makeLog('F1');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(60000);
const ovCheck=async(tag)=>{const ov=await overflow(page);if(!ov.bad)log.ok(tag+' 375px 横はみ出し 0');else log.fail(tag+' 横はみ出し: '+JSON.stringify(ov));};

await page.goto(DIST+'/index.html#reader',{waitUntil:'load'});
await page.waitForTimeout(2500);
// 目次内の章エクストラボタンを発見
const extrasBtns=await page.evaluate(()=>[...document.querySelectorAll('[data-chapter-extras]')].map(b=>({ch:b.dataset.chapterExtras,visible:!!b.offsetParent})));
log.info('章エクストラボタン: '+JSON.stringify(extrasBtns));
const appendixBtns=await page.evaluate(()=>[...document.querySelectorAll('[data-appendix-references]')].map(b=>({ap:b.dataset.appendixReferences,visible:!!b.offsetParent})));
log.info('付録ボタン: '+JSON.stringify(appendixBtns));

// ---- 第1章 ----
async function openExtras(chId){
  await page.evaluate((id)=>{
    const details=document.querySelector(`[data-chapter-extras="${id}"]`)?.closest('details');
    if(details)details.open=true;
    document.querySelector(`[data-chapter-extras="${id}"]`)?.click();
  },chId);
  await page.waitForSelector('#chapter-extras-panel .chapter-extras-group',{timeout:45000}).catch(()=>null);
  await page.waitForTimeout(600);
}
await openExtras('ch1');
const ch1=await page.evaluate(()=>{
  const panel=document.querySelector('#chapter-extras-panel');
  if(!panel)return {panel:false};
  const groups=[...panel.querySelectorAll('.chapter-extras-group')];
  return {panel:true,
    groupSummaries:groups.map(g=>g.querySelector('summary')?.textContent.trim()),
    problems:panel.querySelectorAll('.chapter-problem-item').length,
    references:panel.querySelectorAll('.chapter-reference-item').length};
});
log.info('第1章エクストラ: '+JSON.stringify(ch1));
if(ch1.panel&&ch1.problems===46)log.ok('第1章：問題46件が一覧表示される（データ実数と一致）');else log.fail('第1章の問題件数が合わない: '+JSON.stringify(ch1));
if(ch1.references===22)log.ok('第1章：参考文献22件が表示される（データ実数と一致）');else log.fail('第1章の参考文献件数が合わない: '+ch1.references);
// グループを開いて問題1.1の全文表示を確認
await page.evaluate(()=>{
  const g=document.querySelector('#chapter-extras-panel .chapter-extras-group'); if(g)g.open=true;
  const item=document.querySelector('#chapter-extra-problem-1-1'); if(item)item.open=true;
});
await page.waitForTimeout(500);
const p11=await page.evaluate(()=>{
  const item=document.querySelector('#chapter-extra-problem-1-1');
  if(!item)return null;
  const body=item.querySelector('.chapter-problem-body');
  const t=body?body.textContent.replace(/\s+/g,' ').trim():'';
  return {len:t.length,hasCork:t.includes('コルクボード'),hasFullEnd:t.includes('示唆されるか'),bodyScrollH:body?body.scrollHeight:0,bodyClientH:body?body.clientHeight:0};
});
log.info('問題1.1本文: '+JSON.stringify(p11));
if(p11&&p11.hasCork&&p11.hasFullEnd)log.ok('問題1.1の題文が末尾まで表示される（見切れなし）');else log.fail('問題1.1の題文が不完全: '+JSON.stringify(p11));
await ovCheck('第1章エクストラ');
await page.screenshot({path:SHOTS+'f1-ch1-extras-375.png'});

// 参考文献グループを開いて Fourier の項目が完全表示されるか
await page.evaluate(()=>{
  const groups=document.querySelectorAll('#chapter-extras-panel .chapter-extras-group');
  if(groups[1])groups[1].open=true;
  document.querySelector('#chapter-extra-reference-1-1')?.scrollIntoView({block:'center'});
});
await page.waitForTimeout(500);
const ref11=await page.evaluate(()=>{
  const el=document.querySelector('#chapter-extra-reference-1-1');
  if(!el)return null;
  const t=el.textContent.replace(/\s+/g,' ').trim();
  return {len:t.length,text:t.slice(0,220)};
});
log.info('参考文献1.1: '+JSON.stringify(ref11));
if(ref11&&/Fourier/.test(ref11.text)&&/熱の解析的理論/.test(ref11.text))log.ok('参考文献1.1（Fourier）が著者・邦題つきで表示される');else log.fail('参考文献1.1の表示が不完全: '+JSON.stringify(ref11));
await ovCheck('第1章参考文献');

// ---- 第6章（表ブロックつき） ----
await openExtras('ch6');
const ch6=await page.evaluate(()=>{
  const panel=document.querySelector('#chapter-extras-panel');
  if(!panel)return {panel:false};
  return {panel:true,
    groupSummaries:[...panel.querySelectorAll('.chapter-extras-group > summary')].map(g=>g.textContent.trim()),
    problems:panel.querySelectorAll('.chapter-problem-item').length,
    references:panel.querySelectorAll('.chapter-reference-item').length,
    tables:panel.querySelectorAll('table').length};
});
log.info('第6章エクストラ: '+JSON.stringify(ch6));
if(ch6.problems===51)log.ok('第6章：問題51件が表示される（表ブロックを問題と数えない）');else log.fail('第6章の問題件数: '+ch6.problems);
if(ch6.references===37)log.ok('第6章：参考文献37件');else log.fail('第6章の参考文献件数: '+ch6.references);
if(ch6.tables>=3)log.ok('第6章：問題付属の表3件が描画される');else log.fail('第6章の表が不足: '+ch6.tables);
await ovCheck('第6章エクストラ');

// ---- 付録A・B ----
async function openAppendix(apId){
  await page.evaluate((id)=>{document.querySelector(`[data-appendix-references="${id}"]`)?.click();},apId);
  await page.waitForSelector('#appendix-references',{timeout:30000}).catch(()=>null);
  await page.waitForTimeout(800);
  await page.evaluate(()=>{const g=document.querySelector('#appendix-references .chapter-extras-group');if(g)g.open=true;});
  await page.waitForTimeout(300);
  return page.evaluate(()=>{
    const sec=document.querySelector('#appendix-references');
    if(!sec)return {panel:false};
    const items=[...sec.querySelectorAll('article.book-reference')];
    const longest=items.map(el=>el.textContent.replace(/\s+/g,' ').trim()).sort((a,b)=>b.length-a.length)[0]||'';
    return {panel:true,items:items.length,
      heading:sec.querySelector('h3')?.textContent.trim()||'',
      longestLen:longest.length,longestHead:longest.slice(0,120)};
  });
}
const apA=await openAppendix('A');
log.info('付録A: '+JSON.stringify(apA));
if(apA.panel&&apA.items===41)log.ok('付録A：参考文献41件が表示される');else log.fail('付録Aの件数: '+JSON.stringify(apA));
if(apA.longestLen>150)log.ok('付録A：最長の書誌（'+apA.longestLen+'字）も項目として描画される');else log.obs('付録A最長書誌: '+apA.longestLen+'字');
await ovCheck('付録A');
await page.screenshot({path:SHOTS+'f1-appendix-a-375.png'});
const apB=await openAppendix('B');
log.info('付録B: '+JSON.stringify(apB));
if(apB.panel&&apB.items===1)log.ok('付録B：参考文献1件が表示される（A+B=42件でデータ実数と一致）');else log.fail('付録Bの件数: '+JSON.stringify(apB));
await ovCheck('付録B');

errorSummary(log,errors,'F1');
await ctx.close();
await browser.close();
console.log('F1 DONE');
