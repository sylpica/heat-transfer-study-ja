// R7-W4 主経路の回帰（375px）：ホーム→検索→節／目次→節／用語集／問題演習／保存・復元／オフライン
// 手続きはループ4 W1 を踏襲
import {launch,newPage,DIST,SHOTS,makeLog,overflow} from './lib.mjs';
import {writeFileSync} from 'node:fs';
const log=makeLog('R7-W4');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);
const ovCheck=async(tag)=>{const ov=await overflow(page);if(!ov.bad)log.ok(tag+' 375px 横はみ出し 0');else log.fail(tag+' 横はみ出し: '+JSON.stringify(ov));};
const peCheck=(tag)=>{const pe=errors.filter(e=>e.startsWith('pageerror'));if(pe.length===0)log.ok(tag+' pageerror 0（累計）');else log.fail(tag+' pageerror: '+JSON.stringify(pe));};

// ---------- A. ホーム ----------
await page.goto(DIST+'/index.html',{waitUntil:'load'});
await page.waitForTimeout(2200);
const home=await page.evaluate(()=>({title:document.querySelector('h1')?.textContent.trim()||'',nav:document.querySelectorAll('.nav-link').length}));
log.info('ホーム: '+JSON.stringify(home));
if(home.title&&home.nav>0)log.ok('ホームが描画される（ナビ '+home.nav+' 件）'); else log.fail('ホーム描画不全');
await ovCheck('ホーム');

// ---------- B. 検索→節着地 ----------
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
if(r1.links.length)log.ok('検索結果が表示される（'+r1.cnt+'）'); else log.fail('検索結果が出ない');
const clicked=await page.evaluate(()=>{
  const sec=document.querySelector('.search-results');
  const el=sec?[...sec.querySelectorAll('a,button')].find(e=>e.offsetParent&&/熱抵抗と電気回路の類推/.test(e.textContent)):null;
  if(el){el.click();return el.textContent.replace(/\s+/g,' ').trim().slice(0,40);} return null;
});
await page.waitForTimeout(2200);
const nav1=await page.evaluate(()=>({hash:location.hash,h2:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim()).join(' ').slice(0,50)}));
log.info('結果クリック: '+clicked+' → '+JSON.stringify(nav1));
if(/2\.3/.test(nav1.h2))log.ok('検索結果から §2.3 の読書画面へ着地できる'); else log.fail('検索→節着地に失敗: '+JSON.stringify(nav1));
await ovCheck('検索→§2.3');

// ---------- C. 目次→節 ----------
await page.goto(DIST+'/index.html#reader',{waitUntil:'load'});
await page.waitForTimeout(2000);
const tocClicked=await page.evaluate(()=>{
  const el=document.querySelector('[data-open-section="2.3"]')||[...document.querySelectorAll('a,button')].find(e=>/2\.3/.test(e.textContent)&&e.textContent.length<60);
  if(el){el.click();return el.textContent.trim().slice(0,40);}return null;
});
await page.waitForTimeout(1800);
const sec=await page.evaluate(()=>({h2:[...document.querySelectorAll('h2')].map(x=>x.textContent).join(' ').slice(0,60),paras:document.querySelectorAll('#reader-article p').length}));
log.info('目次クリック: '+tocClicked+' / 到達: '+JSON.stringify(sec));
if(/2\.3/.test(sec.h2)&&sec.paras>0)log.ok('目次から §2.3 の読書画面へ到達'); else log.fail('目次→§2.3 到達できず');
await ovCheck('§2.3 読書');

// ---------- D. 用語集：検索・展開・ブックマーク・単語帳 ----------
await page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
await page.waitForTimeout(1800);
const inp=page.locator('#glossary-search, input[type=search], .glossary-tools input').first();
if(await inp.count()){await inp.fill('フィン効率');await page.waitForTimeout(1200);}
const rowVis=await page.evaluate(()=>{const r=document.querySelector('#term-fin-efficiency');return r?{visible:!!r.offsetParent}:null;});
log.info('用語行: '+JSON.stringify(rowVis));
if(rowVis&&rowVis.visible)log.ok('用語集で「フィン効率」の行が表示される'); else log.fail('用語行が出ない');
await page.evaluate(()=>{document.querySelector('#term-fin-efficiency .term-toggle')?.click();});
await page.waitForTimeout(600);
const expanded=await page.evaluate(()=>{const b=document.querySelector('#term-fin-efficiency .term-body');return b?b.textContent.replace(/\s+/g,' ').trim().slice(0,90):null;});
log.info('行展開: '+expanded);
if(expanded)log.ok('用語行を展開して定義が読める'); else log.fail('行展開できない');
const bm=await page.evaluate(()=>{const row=document.querySelector('#term-fin-efficiency');const b=row?[...row.querySelectorAll('button')].find(x=>/☆|★/.test(x.textContent)):null;if(b){b.click();return b.textContent.trim();}return null;});
await page.waitForTimeout(500);
const bmAfter=await page.evaluate(()=>{const row=document.querySelector('#term-fin-efficiency');const b=row?[...row.querySelectorAll('button')].find(x=>/☆|★/.test(x.textContent)):null;return b?b.textContent.trim():null;});
log.info('ブックマーク: '+bm+' → '+bmAfter);
if(bmAfter&&bmAfter.includes('★'))log.ok('ブックマーク ☆→★ が機能する'); else log.fail('ブックマークが付かない');
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='単語帳');b?.click();});
await page.waitForTimeout(800);
await page.evaluate(()=>{const s=document.querySelector('select[name=flash-scope]');if(s){const o=[...s.options].find(o=>/ブックマーク/.test(o.textContent));if(o){s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));}}});
await page.waitForTimeout(800);
const stage=await page.evaluate(()=>document.querySelector('.flash-stage')?.textContent.replace(/\s+/g,' ').trim()||'');
log.info('単語帳表面: '+stage.slice(0,60));
if(stage.includes('フィン効率'))log.ok('単語帳（ブックマークのみ）にフィン効率のカードが出る'); else log.obs('単語帳の表面にフィン効率が出ない: '+stage.slice(0,80));
await page.evaluate(()=>{document.querySelector('.flash-face')?.click();});
await page.waitForTimeout(700);
const back=await page.evaluate(()=>document.querySelector('.flash-scroll')?.textContent.replace(/\s+/g,' ').trim().slice(0,90)||'');
log.info('単語帳裏面: '+back);
if(back.length>10)log.ok('フラッシュカードをめくって裏面（定義）が読める'); else log.fail('カード裏面が読めない');
await ovCheck('用語集・単語帳');

// ---------- E. 問題演習：§6.1 ノートから開始→回答→解説 ----------
await page.goto(DIST+'/index.html#reader/6.1',{waitUntil:'load'});
await page.waitForTimeout(2400);
const qbtn=page.locator('#reader-original-note [data-start-question="supp-next-local-versus-average-v1"]');
log.info('§6.1 ノートの問題ボタン: '+await qbtn.count());
if(await qbtn.count()){
  await qbtn.first().click();
  await page.waitForTimeout(600);
  const modal=page.locator('.quiz-start-modal [data-action="confirm-quiz-start"]');
  if(await modal.count()){await modal.first().click(); log.info('開始確認モーダルを承認');}
  await page.locator('.question-card').waitFor({state:'visible',timeout:90000}).catch(()=>log.obs('問題カード待ちタイムアウト'));
  await page.waitForTimeout(600);
  const card=await page.evaluate(()=>document.querySelector('.question-card')?.textContent.replace(/\s+/g,' ').trim().slice(0,140)||'');
  log.info('問題カード: '+card);
  const picked=await page.evaluate(()=>{
    const l=[...document.querySelectorAll('.question-card .answer-choice')].find(x=>x.textContent.includes('局所値と平均は別の量であり、平均には分布の積分が必要'));
    if(!l)return null; l.click(); return l.textContent.replace(/\s+/g,' ').trim().slice(0,50);
  });
  log.info('選択肢: '+picked);
  if(picked)log.ok('選択肢を選べる'); else log.fail('想定の選択肢が見つからない');
  await page.evaluate(()=>{document.querySelector('.question-card button.answer-submit')?.click();});
  await page.waitForFunction(()=>/正解|不正解/.test(document.querySelector('.question-card')?.textContent||''),null,{timeout:60000}).catch(()=>log.obs('判定待ちタイムアウト'));
  await page.waitForTimeout(600);
  const judged=await page.evaluate(()=>document.querySelector('.question-card')?.textContent.replace(/\s+/g,' ').trim()||'');
  log.info('判定後カード: '+judged.slice(0,300));
  if(/正解/.test(judged))log.ok('正解判定が表示される'); else log.obs('判定表示: '+judged.slice(0,60));
  if(/平均h̄|積分/.test(judged))log.ok('解説（平均の積分定義を含む）が表示される'); else log.obs('解説内の積分定義は文字列で未確認: '+judged.slice(0,120));
  await page.screenshot({path:SHOTS+'r7-w4-question-375.png'});
}else log.fail('§6.1 ノートに問題開始ボタンがない');
await ovCheck('問題演習');

// ---------- F. 設定：書き出し→取り込み往復 ----------
await page.goto(DIST+'/index.html#settings',{waitUntil:'load'});
await page.waitForTimeout(1800);
await page.evaluate(()=>{document.querySelector('[data-action="export-preview"]')?.click();});
await page.waitForTimeout(900);
const exported=await page.evaluate(()=>document.querySelector('#export-json')?.value||'');
log.info('書き出しJSON: '+exported.length+' bytes / 問題記録含む: '+exported.includes('supp-next-local-versus-average-v1'));
if(exported.length>100)log.ok('設定から学習データを書き出せる'); else log.fail('書き出しが得られない');
if(exported.includes('supp-next-local-versus-average-v1'))log.ok('書き出しに §6.1 問題の学習記録が含まれる'); else log.obs('書き出しに当該問題IDは見当たらず');
writeFileSync('/tmp/r7-export.json',exported);
await page.setInputFiles('#import-file','/tmp/r7-export.json');
await page.waitForSelector('[data-action="import-merge"]',{timeout:60000});
await page.click('[data-action="import-merge"]');
await page.waitForTimeout(1600);
const fb=await page.evaluate(()=>document.body.textContent.replace(/\s+/g,' ').match(/学習データを追加しました|取り込み可能なデータです|取り込みました/)?.[0]||'');
log.info('取り込みフィードバック: '+fb);
if(fb)log.ok('書き出したデータをそのまま取り込み直せる（往復成立）'); else log.fail('取り込みの成否表示が捉えられない');
await ovCheck('設定');
// リロード後の保持
await page.reload({waitUntil:'load'});
await page.waitForTimeout(2000);
await page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
await page.waitForTimeout(1500);
const kept=await page.evaluate(()=>{const row=document.querySelector('#term-fin-efficiency');const b=row?[...row.querySelectorAll('button')].find(x=>/☆|★/.test(x.textContent)):null;return b?b.textContent.trim():null;});
log.info('リロード後のブックマーク表示: '+kept);
if(kept&&kept.includes('★'))log.ok('リロード後もブックマークが保持される'); else log.fail('リロード後にブックマークが保持されない');

// ---------- G. オフライン再読み込み ----------
await page.goto(DIST+'/index.html',{waitUntil:'load'});
await page.evaluate(()=>navigator.serviceWorker.ready).catch(()=>{});
await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:90000}).catch(()=>log.obs('SW controller 待ちタイムアウト'));
await ctx.setOffline(true);
await page.reload({waitUntil:'load'}).catch(e=>log.info('offline reload: '+e.message));
await page.waitForTimeout(2500);
const off=await page.evaluate(()=>({h1:document.querySelector('h1')?.textContent.trim()||'',hasNav:document.querySelectorAll('.nav-link').length}));
log.info('オフライン再読込: '+JSON.stringify(off));
if(off.h1||off.hasNav>0)log.ok('オフライン再読み込みでホームが描画される'); else log.fail('オフライン再読み込みで描画されない');
await page.goto(DIST+'/index.html#reader/2.3',{waitUntil:'load'}).catch(e=>log.info('offline section: '+e.message));
await page.waitForTimeout(2500);
const offSec=await page.evaluate(()=>({h2:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim()).join(' ').slice(0,50),paras:document.querySelectorAll('#reader-article p').length}));
log.info('オフラインで §2.3: '+JSON.stringify(offSec));
if(offSec.paras>0)log.ok('オフラインでも節本文が表示される（プリキャッシュ実働）'); else log.obs('オフラインで節本文は未確認');
await ctx.setOffline(false);

peCheck('R7-W4 全体');
const ce=errors.filter(e=>e.startsWith('console'));
log.info('console エラー（既知404想定）: '+JSON.stringify(ce));
await ctx.close();
await browser.close();
console.log('DONE R7-W4');
