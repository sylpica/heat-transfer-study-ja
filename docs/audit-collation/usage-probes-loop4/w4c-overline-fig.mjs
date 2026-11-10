// W4c 上線の拡大撮影：§2.4 式(2.33) の図要素を DSF=2 で撮る
import {chromium} from 'playwright';
import {DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('W4c');
const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:2});
const page=await ctx.newPage();
const errs=[];page.on('pageerror',e=>errs.push(e.message));
page.setDefaultTimeout(60000);
await page.goto(DIST+'/index.html#reader/2.4',{waitUntil:'load'});
await page.waitForTimeout(2400);
for(const cap of ['式（2.33）','式（2.34）']){
  const fig=page.locator('#reader-article figure').filter({hasText:cap}).first();
  log.info(cap+' figure count: '+await fig.count());
  if(await fig.count()){
    await fig.scrollIntoViewIfNeeded().catch(()=>{});
    await page.waitForTimeout(400);
    await fig.screenshot({path:SHOTS+'w4c-overline-'+(cap.includes('2.33')?'233':'234')+'-375@2x.png'}).catch(e=>log.info('shot: '+e.message));
  }
}
log.info('pageerrors: '+JSON.stringify(errs));
await ctx.close();await browser.close();
console.log('W4c DONE');
