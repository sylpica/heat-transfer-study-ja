// R7-W1c h_{fg} の修正正規表現での再計数＋数式要素の撮影（§11.6/11.7/11.9/11.10）
import {launch,newPage,SHOTS,makeLog,openSection} from './lib.mjs';
const log=makeLog('R7-W1c');
const browser=await launch();
for(const width of [375,1280]){
  const {ctx,page,errors}=await newPage(browser,{width,height:width===375?812:900});
  page.setDefaultTimeout(120000);
  for(const id of ['11.7','11.9','11.10']){
    errors.length=0;
    await openSection(page,id);
    const r=await page.evaluate(()=>{
      const t=(document.querySelector('#reader-article')||document.body).textContent||'';
      const cnt=(re)=>(t.match(re)||[]).length;
      return {fgForms:cnt(/h_\{fg\}|h_fg|hfg/g),braced:cnt(/h_\{fg\}/g),under:cnt(/h_fg/g),flat:cnt(/hfg/g),scriptG:cnt(/𝒢/g)};
    });
    log.info(`§${id} @${width}px fg系=${JSON.stringify(r)} pageerror=${errors.filter(e=>e.startsWith('pageerror')).length}`);
  }
  // §11.6 の gm,i を含む数式要素と §11.7 の h_{fg} を含む数式要素を撮影（375px のみ）
  if(width===375){
    await openSection(page,'11.6');
    const f1=page.locator('#reader-article .formula').filter({hasText:/gm,i/}).first();
    if(await f1.count()){await f1.scrollIntoViewIfNeeded().catch(()=>{});await page.waitForTimeout(500);
      await f1.screenshot({path:SHOTS+'r7-116-gmi-formula-375.png'});log.ok('§11.6 gm,i 数式要素を撮影');}
    else log.obs('§11.6 で gm,i を含む .formula 要素が見つからない');
    await openSection(page,'11.7');
    const f2=page.locator('#reader-article .formula').filter({hasText:/h_\{fg\}/}).first();
    if(await f2.count()){await f2.scrollIntoViewIfNeeded().catch(()=>{});await page.waitForTimeout(500);
      await f2.screenshot({path:SHOTS+'r7-117-hfg-formula-375.png'});log.ok('§11.7 h_{fg} 数式要素を撮影');}
    else log.obs('§11.7 で h_{fg} を含む .formula 要素が見つからない');
  }
  await ctx.close();
}
await browser.close();
console.log('DONE R7-W1c');
