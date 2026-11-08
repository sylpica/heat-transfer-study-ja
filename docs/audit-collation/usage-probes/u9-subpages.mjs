// U9 ラボ専用ページ4件：channel / fin-learning / radial / radiation を開いて基本操作
import {launch,newPage,DIST,SHOTS,makeLog,overflow} from './lib.mjs';
const log=makeLog('U9');
const browser=await launch();
for(const p of ['channel.html','fin-learning.html','radial.html','radiation.html']){
  const {ctx,page,errors}=await newPage(browser,{width:375});
  await page.goto(DIST+'/dynamic/'+p,{waitUntil:'networkidle'});
  await page.waitForTimeout(1600);
  const dom=await page.evaluate(()=>({
    title:document.title,
    h:[...document.querySelectorAll('h1,h2')].map(x=>x.textContent.trim().slice(0,40)).slice(0,3),
    btns:[...document.querySelectorAll('button')].map(b=>b.textContent.trim().slice(0,28)).filter(Boolean).slice(0,10),
    hasCanvas:!!document.querySelector('canvas')}));
  log.info(p+': '+JSON.stringify(dom).slice(0,430));
  // 再生・計算系ボタンがあれば押す
  const run=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/^(再生|計算|初期条件を準備)/.test(b.textContent.trim()));if(b){b.click();return b.textContent.trim().slice(0,24);}return null;});
  if(run){await page.waitForTimeout(2500);
    const t=await page.evaluate(()=>document.body.textContent.replace(/\s+/g,' ').match(/[\d.]+ ?s|Nu|℃/)?.[0]||'');
    log.info(p+' 実行('+run+')後の変化指標: '+t);
  }
  const ov=await overflow(page);
  if(ov.bad)log.fail(p+' で横はみ出し: '+JSON.stringify(ov));else log.ok(p+' 表示・基本操作 OK（はみ出しなし）');
  log.info(p+' errors='+JSON.stringify(errors));
  await page.screenshot({path:SHOTS+'u9-'+p.replace('.html','')+'-375.png'});
  await ctx.close();
}
await browser.close();
console.log('U9 DONE');
