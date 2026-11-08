// V6 幅・テーマ横断スイープ＋カレンダー日詳細の証拠撮影
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('V6');
const browser=await launch();
const ROUTES=['home','reader','quiz','review','search','glossary','map','simulator','lab','plan','calendar','settings','guide'];
async function sweep(width,dark,label){
  const {ctx,page,errors}=await newPage(browser,{width,dark});
  page.setDefaultTimeout(120000);
  const bad=[];
  for(const r of ROUTES){
    await page.goto(DIST+'/index.html#'+r,{waitUntil:'load'});
    await page.waitForTimeout(1100);
    const o=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth}));
    if(o.sw>o.iw+1)bad.push(r+':'+o.sw+'>'+o.iw);
  }
  log.info(label+' 横はみ出し: '+(bad.length?JSON.stringify(bad):'なし（全'+ROUTES.length+'タブ）'));
  if(!bad.length)log.ok(label+' でページ横はみ出し 0 件');
  else log.fail(label+' はみ出しあり');
  log.info(label+' errors: '+JSON.stringify(errors.filter(e=>!/404/.test(e))));
  await page.goto(DIST+'/index.html#reader/9.4',{waitUntil:'load'});
  await page.waitForTimeout(1800);
  await page.screenshot({path:SHOTS+'v6-reader94-'+label+'.png'});
  await ctx.close();
}
await sweep(390,false,'390px-light');
await sweep(1280,false,'1280px-light');
await sweep(375,true,'375px-dark');

// カレンダー日詳細（セッションエントリ部分）の撮影：不整合セッションを取り込んで日詳細へスクロール
{
  const {ctx,page,errors}=await newPage(browser,{width:375});
  page.setDefaultTimeout(120000);
  page.on('dialog',d=>d.accept());
  await page.goto(DIST+'/index.html#settings',{waitUntil:'load'});
  await page.waitForTimeout(2000);
  await page.setInputFiles('#import-file','/tmp/v2-import.json');
  await page.waitForSelector('[data-action="import-replace"]',{timeout:90000});
  await page.click('[data-action="import-replace"]');
  await page.waitForTimeout(2500);
  await page.goto(DIST+'/index.html#calendar',{waitUntil:'load'});
  await page.waitForTimeout(2000);
  const el=page.locator('.session-entry').first();
  if(await el.count()){
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({path:SHOTS+'v6-calendar-day-detail-375.png'});
    log.ok('カレンダー日詳細（セッションエントリ）を撮影');
  }else log.obs('セッションエントリが見つからず撮影できず');
  log.info('errors: '+JSON.stringify(errors.filter(e=>!/404/.test(e))));
  await ctx.close();
}
await browser.close();
console.log('V6 DONE');
