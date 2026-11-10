// F5 ラボ：ポップアップ式ガイド／学び方「操作チュートリアル」／解法設定（格子・時間刻み）
//    ＋主アプリのモーダル inert（R1-P2-08 回帰確認）。375px・ライト中心
import {launch,newPage,DIST,SHOTS,makeLog,overflow,errorSummary} from './lib.mjs';
const log=makeLog('F5');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(90000);

await page.goto(DIST+'/dynamic/index.html',{waitUntil:'load'});
await page.waitForTimeout(3000);

// ---------- A. ポップアップ式ガイド ----------
await page.click('.sim-guide-toggle');
await page.waitForTimeout(600);
const g1=await page.evaluate(()=>{const p=document.querySelector('.sim-guide-popup');
  return {visible:!!p&&!p.hidden,count:p?.querySelector('.sim-guide-count')?.textContent.trim()||'',
    title:p?.querySelector('.sim-guide-title')?.textContent.trim()||'',
    pressed:document.querySelector('.sim-guide-toggle')?.getAttribute('aria-pressed')};});
log.info('ガイド開始: '+JSON.stringify(g1));
if(g1.visible&&/1\s*\/\s*8/.test(g1.count))log.ok('ガイドのポップアップが開き、8ステップ中の1件目が出る');else log.fail('ガイドが開かない: '+JSON.stringify(g1));
await page.evaluate(()=>{[...document.querySelectorAll('.sim-guide-popup button')].find(b=>b.textContent.trim()==='次へ')?.click();});
await page.waitForTimeout(500);
const g2=await page.evaluate(()=>{const p=document.querySelector('.sim-guide-popup');
  return {count:p?.querySelector('.sim-guide-count')?.textContent.trim()||'',title:p?.querySelector('.sim-guide-title')?.textContent.trim()||'',
    highlighted:document.querySelector('.sim-guide-target')?.id||''};});
log.info('ガイド2件目: '+JSON.stringify(g2));
if(/2\s*\/\s*8/.test(g2.count)&&g2.title!==g1.title)log.ok('「次へ」でステップが進み、対象がハイライトされる（#'+g2.highlighted+'）');else log.fail('ガイドの送りが効かない');
// ポップアップ表示中に背景が操作できること（#step で1コマ進める＝決定的に判定）
await page.fill('#interval','0.5');
await page.click('#step');
await page.waitForFunction(()=>parseFloat(document.querySelector('#clock')?.textContent||'0')>0,null,{timeout:60000}).catch(()=>null);
const clockDuringGuide=await page.evaluate(()=>document.querySelector('#clock')?.textContent.trim()||'');
log.info('ガイド表示中の時計（1コマ後）: '+clockDuringGuide);
if(parseFloat(clockDuringGuide)>0)log.ok('ガイド表示中も背景の計算を操作できる（非モーダル）');else log.fail('ガイド表示中に背景が操作できない');
// 再生でも進むか（起動遅延を許容して長めに待つ）
await page.click('#play');
await page.waitForFunction(()=>parseFloat(document.querySelector('#clock')?.textContent||'0')>0.5,null,{timeout:60000}).catch(()=>null);
const clockPlay=await page.evaluate(()=>document.querySelector('#clock')?.textContent.trim()||'');
await page.click('#pause').catch(()=>{});
log.info('ガイド表示中の時計（再生後）: '+clockPlay);
if(parseFloat(clockPlay)>0.5)log.ok('ガイド表示中も再生で計算が進む');else log.obs('再生では時計が進まなかった（step では操作可能）: '+clockPlay);
await page.evaluate(()=>{[...document.querySelectorAll('.sim-guide-popup button')].find(b=>b.textContent.trim()==='閉じる')?.click();});
await page.waitForTimeout(400);
const gClosed=await page.evaluate(()=>document.querySelector('.sim-guide-popup')?.hidden);
if(gClosed)log.ok('「閉じる」でガイドのポップアップが閉じる');else log.fail('ガイドが閉じない');
await page.click('.sim-guide-toggle');
await page.waitForTimeout(400);
const gReopen=await page.evaluate(()=>{const p=document.querySelector('.sim-guide-popup');return !!p&&!p.hidden;});
if(gReopen)log.ok('トグルでガイドを再び開ける');else log.fail('ガイドが再び開けない');
await page.evaluate(()=>{[...document.querySelectorAll('.sim-guide-popup button')].find(b=>b.textContent.trim()==='閉じる')?.click();});
await page.screenshot({path:SHOTS+'f5-guide-375.png'});

// ---------- B. 学び方「操作チュートリアル」 ----------
try{
const lpOptions=await page.evaluate(()=>[...document.querySelector('#learning-path').options].map(o=>({v:o.value,t:o.textContent.trim()})));
log.info('学び方の選択肢: '+JSON.stringify(lpOptions));
const tutOpt=lpOptions.find(o=>/チュートリアル/.test(o.t));
if(tutOpt){
  await page.selectOption('#learning-path',tutOpt.v);
  await page.waitForTimeout(700);
  const lcVisible=await page.evaluate(()=>{const c=document.querySelector('#learning-content');return !!c&&!c.hidden;});
  if(lcVisible)log.ok('「操作チュートリアル」を選ぶと案内が開く');else log.fail('チュートリアルの案内が開かない');
  await page.click('#learning-prepare');
  await page.waitForTimeout(700);
  const steps1=await page.evaluate(()=>document.querySelector('#learning-steps')?.textContent.replace(/\s+/g,' ').trim().slice(0,120)||'');
  log.info('準備後の案内: '+steps1);
  const runDisabled1=await page.evaluate(()=>document.querySelector('#learning-run')?.disabled);
  log.info('準備直後の「5秒まで計算」disabled: '+runDisabled1);
  await page.click('#learning-locate');
  await page.waitForTimeout(700);
  const runDisabled2=await page.evaluate(()=>document.querySelector('#learning-run')?.disabled);
  log.info('測定点移動後の disabled: '+runDisabled2);
  if(runDisabled1===true&&runDisabled2===false)log.ok('チュートリアルは手順の順序を強制する（測定点を移すまで計算ボタンが無効）');
  await page.click('#learning-run');
  await page.waitForFunction(()=>/^5\./.test(document.querySelector('#clock')?.textContent||''),null,{timeout:120000}).catch(()=>null);
  const clockTut=await page.evaluate(()=>document.querySelector('#clock')?.textContent.trim()||'');
  log.info('チュートリアル計算後の時計: '+clockTut);
  if(/^5\./.test(clockTut))log.ok('チュートリアルの案内どおり5秒まで計算できる');else log.fail('チュートリアルで5秒に到達しない: '+clockTut);
  await page.click('#learning-rewind');
  await page.waitForTimeout(900);
  const clockRew=await page.evaluate(()=>document.querySelector('#clock')?.textContent.trim()||'');
  log.info('巻き戻し後の時計: '+clockRew);
  if(/^0\./.test(clockRew))log.ok('「初期状態へ戻す」で時計が0に戻る');else log.fail('巻き戻しが効かない: '+clockRew);
}else log.fail('学び方に操作チュートリアルがない');
}catch(e){log.fail('チュートリアル区画で例外: '+String(e).split('\n')[0]);}

// ---------- C. 解法設定（専門解析：格子と時間刻み） ----------
try{
await page.selectOption('#mode','expert');
await page.waitForTimeout(500);
await page.evaluate(()=>{const d=document.querySelector('#expert-settings');if(d)d.open=true;});
await page.waitForTimeout(300);
const nxVisible=await page.evaluate(()=>{const i=document.querySelector('#nx');return {visible:!!i?.offsetParent,value:i?.value,dtExists:!!document.querySelector('#dt')};});
log.info('専門解析の設定: '+JSON.stringify(nxVisible));
if(nxVisible.visible&&nxVisible.dtExists)log.ok('専門解析で格子（nx）と時間刻み（dt）の入力が見える');else log.fail('解法設定の入力が見えない');
async function runTo5s(tag){
  await page.click('[data-preset="heating"]');
  await page.waitForTimeout(300);
  await page.click('#apply');
  await page.waitForTimeout(800);
  await page.fill('#interval','5');
  await page.click('#step');
  await page.waitForFunction(()=>/^5\./.test(document.querySelector('#clock')?.textContent||''),null,{timeout:150000}).catch(()=>null);
  await page.waitForTimeout(400);
  return page.evaluate(()=>({
    clock:document.querySelector('#clock')?.textContent.trim()||'',
    readout:document.querySelector('#readout')?.textContent.replace(/\s+/g,' ').trim().slice(0,200)||'',
    diag:(document.querySelector('#diagnostic-values')?.textContent||'').replace(/\s+/g,' ').trim().slice(0,240)}));
}
const run24=await runTo5s('nx=24');
log.info('nx=24: '+JSON.stringify(run24));
await page.fill('#nx','48');
const run48=await runTo5s('nx=48');
log.info('nx=48: '+JSON.stringify(run48));
if(run24.clock.startsWith('5.')&&run48.clock.startsWith('5.')){
  if(run24.readout!==run48.readout)log.ok('格子を 24→48 に変えると測定点の結果が変わる（解法設定が計算に反映される）');
  else log.fail('格子を変えても読み値が完全一致（設定が反映されていない疑い）');
}else log.fail('5秒までの計算に到達しない: '+run24.clock+' / '+run48.clock);
// 明示 dt の確認
await page.fill('#dt','0.001');
const runDt=await runTo5s('nx=48,dt=0.001');
log.info('nx=48 dt明示: '+JSON.stringify(runDt));
if(runDt.clock.startsWith('5.'))log.ok('時間刻みを明示指定しても計算が完走する');else log.fail('明示dtで完走しない: '+runDt.clock);
const ov=await overflow(page);
if(!ov.bad)log.ok('ラボ 375px 横はみ出し 0');else log.fail('ラボ 375px はみ出し: '+JSON.stringify(ov));
await page.screenshot({path:SHOTS+'f5-solver-375.png'});
}catch(e){log.fail('解法設定区画で例外: '+String(e).split('\n')[0]);}
errorSummary(log,errors,'F5-lab');

// ---------- D. 主アプリ：報告モーダルの inert（R1-P2-08 回帰） ----------
const s2=await newPage(browser,{width:390,height:844});
const p2=s2.page; p2.setDefaultTimeout(60000);
await p2.goto(DIST+'/index.html#quiz',{waitUntil:'load'});
await p2.waitForTimeout(2200);
await p2.evaluate(()=>{document.querySelector('#quiz-start-form button[type="submit"]')?.click();});
await p2.waitForTimeout(1200);
const inQuiz=await p2.evaluate(()=>!!document.querySelector('[data-action="open-report"]'));
log.info('演習開始: '+inQuiz);
if(inQuiz){
  await p2.click('[data-action="open-report"]');
  await p2.waitForTimeout(600);
  const st=await p2.evaluate(()=>{
    const shell=document.querySelector('.app-shell');
    const link=document.querySelector('.main-nav .nav-link');
    link?.focus();
    return {modal:!!document.querySelector('.report-modal'),inert:shell?.hasAttribute('inert')||false,bgFocused:document.activeElement===link};
  });
  log.info('報告モーダル: '+JSON.stringify(st));
  if(st.modal&&st.inert&&!st.bgFocused)log.ok('報告モーダル表示中は背景が inert で操作できない');else log.fail('モーダルの inert が効いていない: '+JSON.stringify(st));
  await p2.click('[data-action="close-report"]');
  await p2.waitForTimeout(500);
  const after=await p2.evaluate(()=>document.querySelector('.app-shell')?.hasAttribute('inert'));
  if(after===false)log.ok('モーダルを閉じると inert が外れる');else log.fail('閉じた後も inert が残る');
}else log.fail('演習を開始できない');
errorSummary(log,s2.errors,'F5-app');
await s2.ctx.close();
await ctx.close();
await browser.close();
console.log('F5 DONE');
