// W4b ベクトル矢印（U+20D7）の描画拡大撮影：§11.11 の ∆P⃗ を含む段落を DSF=2 で撮る
import {chromium} from 'playwright';
import {DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('W4b');
const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:2});
const page=await ctx.newPage();
const errs=[];page.on('pageerror',e=>errs.push(e.message));
page.setDefaultTimeout(60000);
await page.goto(DIST+'/index.html#reader/11.11',{waitUntil:'load'});
await page.waitForTimeout(2400);
const el=page.locator('#reader-article p').filter({hasText:/運動量変化/}).first();
log.info('対象段落 count: '+await el.count());
await el.scrollIntoViewIfNeeded().catch(()=>{});
await page.waitForTimeout(500);
await el.screenshot({path:SHOTS+'w4b-vector-arrow-para-375@2x.png'});
log.info('撮影完了: w4b-vector-arrow-para-375@2x.png / pageerrors: '+JSON.stringify(errs));
await ctx.close();await browser.close();
console.log('W4b DONE');
