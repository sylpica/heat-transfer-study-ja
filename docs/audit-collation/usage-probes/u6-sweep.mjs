// U6 幅・テーマ横断：全13タブ＋ラボ＋開発画面を 390px/1280px/ダークで走査
import {launch,newPage,DIST,ROOT,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U6');
const browser=await launch();
const TABS=['home','reader','quiz','review','search','glossary','map','simulator','lab','plan','calendar','settings','guide'];
async function sweep(width,dark,label){
  const {ctx,page,errors}=await newPage(browser,{width,height:width<600?844:900,dark});
  const bad=[];
  for(const t of TABS){
    await page.goto(DIST+'/index.html#'+t,{waitUntil:'networkidle'});
    await page.waitForTimeout(550);
    const r=await page.evaluate(()=>({ov:document.documentElement.scrollWidth>innerWidth+1,
      docW:document.documentElement.scrollWidth,
      clipped:[...document.querySelectorAll('button,a,h1,h2,h3')].filter(e=>e.scrollWidth>e.clientWidth+2&&e.clientWidth>0&&getComputedStyle(e).overflow!=='visible').length}));
    if(r.ov)bad.push(t+':overflow(docW='+r.docW+')');
    if(r.clipped>0)bad.push(t+':clippedCtrls='+r.clipped);
  }
  log.info(label+': 問題タブ='+JSON.stringify(bad)+' errors='+JSON.stringify(errors.slice(0,3)));
  return {ctx,page,bad};
}
const a=await sweep(390,false,'390px light');
await a.ctx.close();
const b=await sweep(1280,false,'1280px light');
await b.page.screenshot({path:SHOTS+'u6-home-1280.png'});
await b.ctx.close();
const c=await sweep(375,true,'375px dark(colorScheme)');
await c.page.goto(DIST+'/index.html#reader/5.3',{waitUntil:'networkidle'});
await c.page.waitForTimeout(900);
await c.page.screenshot({path:SHOTS+'u6-reader-dark-375.png'});
await c.page.goto(DIST+'/index.html#glossary',{waitUntil:'networkidle'});
await c.page.waitForTimeout(800);
await c.page.screenshot({path:SHOTS+'u6-glossary-dark-375.png'});
await c.ctx.close();
// ラボとマップ・計画等の個別スクリーンショット（1280）
const {ctx,page,errors}=await newPage(browser,{width:1280,height:900});
await page.goto(DIST+'/dynamic/index.html',{waitUntil:'networkidle'});
await page.waitForTimeout(1400);
let ov=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
log.info('ラボ1280 overflow='+ov);
await page.screenshot({path:SHOTS+'u6-lab-1280.png'});
await page.goto(DIST+'/index.html#map',{waitUntil:'networkidle'});
await page.waitForTimeout(800);
const mapText=await page.evaluate(()=>document.querySelector('main').textContent.replace(/\s+/g,' ').slice(0,200));
log.info('分野マップ: '+mapText.slice(0,160));
await page.screenshot({path:SHOTS+'u6-map-1280.png'});
await page.goto(DIST+'/index.html#plan',{waitUntil:'networkidle'});
await page.waitForTimeout(800);
await page.screenshot({path:SHOTS+'u6-plan-1280.png'});
await page.goto(DIST+'/index.html#calendar',{waitUntil:'networkidle'});
await page.waitForTimeout(800);
const calText=await page.evaluate(()=>document.querySelector('main').textContent.replace(/\s+/g,' ').slice(0,160));
log.info('カレンダー: '+calText.slice(0,140));
await ctx.close();
// 開発画面の幅確認（390）
const d=await newPage(browser,{width:390,height:844});
for(const p of ['heat-sink-coupled','conjugate-cavity','fin-gap-flow']){
  await d.page.goto(ROOT+'/dynamic/dev/'+p+'.html',{waitUntil:'networkidle'});
  await d.page.waitForTimeout(900);
  const r=await d.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  log.info('開発画面 '+p+' 390px overflow='+r);
}
await d.ctx.close();
await browser.close();
console.log('U6 DONE');
