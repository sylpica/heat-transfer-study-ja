// U4h ヒートシンク連成（結果待ちを長く）と共役（定常まで進める）
import {launch,newPage,ROOT,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U4h');
const browser=await launch();
{
  const {ctx,page,errors}=await newPage(browser,{width:375});
  await page.goto(ROOT+'/dynamic/dev/heat-sink-coupled.html',{waitUntil:'networkidle'});
  await page.waitForTimeout(1200);
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/この条件で計算/.test(b.textContent));b?.click();});
  let out='';
  for(let i=0;i<10;i++){
    await page.waitForTimeout(3000);
    out=await page.evaluate(()=>document.querySelector('main').textContent.replace(/\s+/g,' '));
    if(/316|平均温度|圧力損失/.test(out)&&out.length>200)break;
  }
  const m=out.match(/平均[^。]{0,60}|圧力[^。]{0,40}|放射[^。]{0,40}/g);
  log.info('HS連成 main抜粋: '+JSON.stringify(m)+' 全長'+out.length);
  log.info('HS連成 温度候補: '+JSON.stringify(out.match(/[\d.]+ ?K/g)?.slice(0,6)));
  await page.screenshot({path:SHOTS+'u4h-heatsink-375.png'});
  log.info('HS errors='+JSON.stringify(errors));
  await ctx.close();
}
{
  const {ctx,page,errors}=await newPage(browser,{width:375});
  await page.goto(ROOT+'/dynamic/dev/conjugate-cavity.html',{waitUntil:'networkidle'});
  await page.waitForTimeout(1200);
  await page.selectOption('#preset',{index:1}); // 主ケース
  await page.waitForTimeout(400);
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/定常まで進める/.test(b.textContent));b?.click();});
  let tau='';
  for(let i=0;i<14;i++){
    await page.waitForTimeout(3000);
    tau=await page.evaluate(()=>document.body.textContent.replace(/\s+/g,' ').match(/τ = [\d.]+/)?.[0]||'');
    if(/τ = 2\.[5-9]|τ = 3/.test(tau))break;
  }
  log.info('共役 τ: '+tau);
  const out=await page.evaluate(()=>document.querySelector('main').textContent.replace(/\s+/g,' ').slice(0,600));
  log.info('共役 main: '+out.slice(0,420));
  await page.screenshot({path:SHOTS+'u4h-conjugate-375.png'});
  log.info('共役 errors='+JSON.stringify(errors));
  await ctx.close();
}
await browser.close();
console.log('U4h DONE');
