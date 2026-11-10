// W2 主要ユーザーパス（1280px）：ホーム／目次→節／用語集／問題演習／ガイド／簡易シム／通常ラボ
import {launch,newPage,DIST,SHOTS,makeLog,overflow} from './lib.mjs';
const log=makeLog('W2');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:1280,height:800});
page.setDefaultTimeout(120000);
const ovCheck=async(tag)=>{const ov=await overflow(page);if(!ov.bad)log.ok(tag+' 1280px 横はみ出し 0');else log.fail(tag+' 横はみ出し: '+JSON.stringify(ov));};

await page.goto(DIST+'/index.html',{waitUntil:'load'});
await page.waitForTimeout(2200);
const home=await page.evaluate(()=>({title:document.querySelector('h1')?.textContent.trim()||''}));
log.info('ホーム: '+JSON.stringify(home));
if(home.title)log.ok('ホームが描画される'); else log.fail('ホームの見出しがない');
await ovCheck('ホーム');
await page.screenshot({path:SHOTS+'w2-home-1280.png'});

// 目次→節
await page.goto(DIST+'/index.html#reader',{waitUntil:'load'});
await page.waitForTimeout(2000);
await page.evaluate(()=>{document.querySelector('[data-open-section="2.3"]')?.click();});
await page.waitForTimeout(1800);
const sec=await page.evaluate(()=>({h2:[...document.querySelectorAll('h2')].map(x=>x.textContent).join(' ').slice(0,60),paras:document.querySelectorAll('#reader-article p').length}));
log.info('§2.3: '+JSON.stringify(sec));
if(/2\.3/.test(sec.h2)&&sec.paras>0)log.ok('目次から §2.3 へ到達'); else log.fail('§2.3 到達できず');
await ovCheck('§2.3 読書');

// 用語集（検索＋展開）
await page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
await page.waitForTimeout(1800);
const inp=page.locator('#glossary-search, input[type=search], .glossary-tools input').first();
if(await inp.count()){await inp.fill('フィン効率');await page.waitForTimeout(1200);}
await page.evaluate(()=>{document.querySelector('#term-fin-efficiency .term-toggle')?.click();});
await page.waitForTimeout(700);
const expanded=await page.evaluate(()=>{const b=document.querySelector('#term-fin-efficiency .term-body');return b?b.textContent.replace(/\s+/g,' ').trim().slice(0,60):null;});
log.info('行展開: '+expanded);
if(expanded&&expanded.length>15)log.ok('1280px でも用語の行展開で定義が表示される'); else log.fail('行展開で定義が出ない');
await page.screenshot({path:SHOTS+'w2-glossary-1280.png'});
await ovCheck('用語集');

// 問題演習（§6.1 ノートから開始→回答→解説）
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
await page.waitForFunction(()=>/正解|不正解/.test(document.querySelector('.question-card')?.textContent||''),null,{timeout:60000}).catch(()=>log.obs('判定待ちタイムアウト'));
await page.waitForTimeout(600);
const judged=await page.evaluate(()=>document.querySelector('.question-card').textContent.replace(/\s+/g,' ').trim());
if(/正解です/.test(judged)&&judged.includes('正解へ至る考え方'))log.ok('1280px でも回答→正解判定→解説表示が実働');
else log.fail('1280px の問題フロー異常: '+judged.slice(0,120));
await page.screenshot({path:SHOTS+'w2-question-judged-1280.png'});
await ovCheck('問題カード表示中');

// ガイド
await page.goto(DIST+'/index.html#guide',{waitUntil:'load'});
await page.waitForTimeout(1500);
await ovCheck('ガイド');

// 簡易シミュレーター（ピッカー）
await page.goto(DIST+'/index.html#simulator',{waitUntil:'load'});
await page.waitForTimeout(2000);
const bar=await page.evaluate(()=>({changeBtn:!![...document.querySelectorAll('button')].find(b=>/モードを変更/.test(b.textContent))}));
log.info('ピッカー初期: '+JSON.stringify(bar));
if(bar.changeBtn)log.ok('1280px でも初期状態はピッカー収納'); else log.fail('ピッカー収納でない');
await ovCheck('簡易シミュレーター');
await page.screenshot({path:SHOTS+'w2-simulator-1280.png'});

// 通常ラボ（起動確認のみ要点）
await page.goto(DIST+'/index.html#lab',{waitUntil:'load'});
await page.waitForTimeout(1800);
let labPage=page; const labErrors=[];
const [popup]=await Promise.all([
  ctx.waitForEvent('page',{timeout:30000}).catch(()=>null),
  page.evaluate(()=>{const a=[...document.querySelectorAll('a')].find(a=>/dynamic\/index\.html/.test(a.getAttribute('href')||''));a?.click();}),
]);
if(popup){labPage=popup;labPage.on('pageerror',e=>labErrors.push(e.message));log.ok('1280px でもタブから別タブにラボが開く');}
else{log.obs('ポップアップ捕捉できず直接遷移で代替');await page.goto(DIST+'/dynamic/index.html',{waitUntil:'load'});}
await labPage.setViewportSize({width:1280,height:800}).catch(()=>{});
await labPage.waitForTimeout(2500);
const labTitle=await labPage.evaluate(()=>({t:document.title,hasCanvas:!!document.querySelector('canvas')}));
log.info('ラボ: '+JSON.stringify(labTitle));
await labPage.screenshot({path:SHOTS+'w2-lab-1280.png'});
const lov=await overflow(labPage);
if(!lov.bad)log.ok('ラボ 1280px 横はみ出し 0'); else log.fail('ラボ 横はみ出し: '+JSON.stringify(lov));
log.info('lab pageerrors: '+JSON.stringify(labErrors));
if(labPage!==page)await labPage.close();

log.info('W2 errors: '+JSON.stringify(errors.filter(e=>e.startsWith('pageerror'))));
if(!errors.some(e=>e.startsWith('pageerror')))log.ok('W2 セッション pageerror 0');
else log.fail('W2 pageerror: '+errors.join(' | '));
await ctx.close();
await browser.close();
console.log('W2 DONE');
