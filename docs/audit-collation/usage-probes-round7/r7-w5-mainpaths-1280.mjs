// R7-W5 主経路の 1280px スポット確認：ホーム／目次（実クリック）→§2.3／用語集／問題開始
import {launch,newPage,DIST,makeLog,overflow} from './lib.mjs';
const log=makeLog('R7-W5');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:1280,height:900});
page.setDefaultTimeout(120000);
const ovCheck=async(tag)=>{const ov=await overflow(page);if(!ov.bad)log.ok(tag+' 1280px 横はみ出し 0');else log.fail(tag+' 横はみ出し: '+JSON.stringify(ov));};

await page.goto(DIST+'/index.html',{waitUntil:'load'});
await page.waitForTimeout(2200);
const home=await page.evaluate(()=>({title:document.querySelector('h1')?.textContent.trim()||'',nav:document.querySelectorAll('.nav-link').length}));
log.info('ホーム: '+JSON.stringify(home));
if(home.title&&home.nav>0)log.ok('ホームが描画される'); else log.fail('ホーム描画不全');
await ovCheck('ホーム');

// 目次：1280px では第2章 details を実クリックで展開してから 2.3 を実クリック（ループ4 W2 の手続き）
await page.goto(DIST+'/index.html#reader',{waitUntil:'load'});
await page.waitForTimeout(2200);
const tocSteps=await page.evaluate(()=>{
  const sums=[...document.querySelectorAll('.toc details > summary, details > summary')];
  const s2=sums.find(s=>/第2章/.test(s.textContent));
  if(s2&&s2.parentElement&&!s2.parentElement.open)s2.click();
  return {summaries:sums.length,opened:!!s2};
});
await page.waitForTimeout(700);
const item=page.locator('.toc-item[data-section="2.3"]');
log.info('目次展開: '+JSON.stringify(tocSteps)+' / 2.3 項目数: '+await item.count());
if(await item.count()){await item.first().click();}
await page.waitForTimeout(2000);
const sec=await page.evaluate(()=>({h2:[...document.querySelectorAll('h2')].map(x=>x.textContent).join(' ').slice(0,60),paras:document.querySelectorAll('#reader-article p').length}));
log.info('到達: '+JSON.stringify(sec));
if(/2\.3/.test(sec.h2)&&sec.paras>0)log.ok('目次（実クリック経路）から §2.3 へ到達'); else log.fail('目次→§2.3 到達できず');
await ovCheck('§2.3 読書');

// 用語集
await page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
await page.waitForTimeout(1800);
const inp=page.locator('#glossary-search, input[type=search], .glossary-tools input').first();
if(await inp.count()){await inp.fill('フィン効率');await page.waitForTimeout(1200);}
const rowVis=await page.evaluate(()=>{const r=document.querySelector('#term-fin-efficiency');return r?{visible:!!r.offsetParent}:null;});
log.info('用語行: '+JSON.stringify(rowVis));
if(rowVis&&rowVis.visible)log.ok('用語集で「フィン効率」の行が表示される'); else log.fail('用語行が出ない');
await ovCheck('用語集');

// 問題開始（§6.1 ノート）
await page.goto(DIST+'/index.html#reader/6.1',{waitUntil:'load'});
await page.waitForTimeout(2400);
const qbtn=page.locator('#reader-original-note [data-start-question="supp-next-local-versus-average-v1"]');
log.info('§6.1 問題ボタン: '+await qbtn.count());
if(await qbtn.count()){
  await qbtn.first().click();
  await page.waitForTimeout(600);
  const modal=page.locator('.quiz-start-modal [data-action="confirm-quiz-start"]');
  if(await modal.count())await modal.first().click();
  await page.locator('.question-card').waitFor({state:'visible',timeout:90000}).catch(()=>log.obs('問題カード待ちタイムアウト'));
  await page.waitForTimeout(600);
  const card=await page.evaluate(()=>document.querySelector('.question-card')?.textContent.replace(/\s+/g,' ').trim().slice(0,80)||'');
  log.info('問題カード: '+card);
  if(card)log.ok('1280px でも問題カードが開く'); else log.fail('問題カードが開かない');
}else log.fail('§6.1 ノートに問題開始ボタンがない');
await ovCheck('問題演習');
const pe=errors.filter(e=>e.startsWith('pageerror'));
if(pe.length===0)log.ok('R7-W5 全体 pageerror 0'); else log.fail('pageerror: '+JSON.stringify(pe));
await ctx.close();
await browser.close();
console.log('DONE R7-W5');
