// R7-W2 ダークテーマ：§11.6 / §11.9 を 375px・1280px（colorScheme: dark）で確認
import {launch,newPage,DIST,SHOTS,makeLog,overflow,openSection,termCounts} from './lib.mjs';
const log=makeLog('R7-W2');
const browser=await launch();
for(const width of [375,1280]){
  const {ctx,page,errors}=await newPage(browser,{width,height:width===375?812:900,dark:true});
  page.setDefaultTimeout(120000);
  for(const id of ['11.6','11.9']){
    errors.length=0;
    const st=await openSection(page,id);
    const theme=await page.evaluate(()=>{
      const b=getComputedStyle(document.body);
      const art=document.querySelector('#reader-article');
      const ab=art?getComputedStyle(art):null;
      return {bodyBg:b.backgroundColor,bodyColor:b.color,artBg:ab?ab.backgroundColor:null,
        htmlTheme:document.documentElement.getAttribute('data-theme'),htmlClass:document.documentElement.className};
    });
    const counts=await termCounts(page);
    const ov=await overflow(page);
    log.info(`§${id} dark @${width}px theme=${JSON.stringify(theme)} counts=${JSON.stringify(counts)} docOverflow=${JSON.stringify(ov)}`);
    const rgb=(theme.bodyBg.match(/\d+/g)||[]).map(Number);
    const darkApplied=rgb.length>=3&&(rgb[0]+rgb[1]+rgb[2])<240;
    if(darkApplied)log.ok(`§${id} dark @${width}px ダーク配色が適用されている（body 背景 ${theme.bodyBg}）`);
    else log.obs(`§${id} dark @${width}px body 背景が暗色でない: ${theme.bodyBg}（アプリ側テーマ切替の有無を別途確認）`);
    if(counts.scriptG===0)log.ok(`§${id} dark @${width}px 𝒢 残存 0`);
    else log.fail(`§${id} dark @${width}px 𝒢 残存 ${counts.scriptG}`);
    if(!ov.bad)log.ok(`§${id} dark @${width}px 文書横はみ出し 0`);else log.fail(`§${id} dark @${width}px 横はみ出し ${JSON.stringify(ov)}`);
    const pe=errors.filter(e=>e.startsWith('pageerror'));
    if(pe.length===0)log.ok(`§${id} dark @${width}px pageerror 0`);else log.fail(`§${id} dark @${width}px pageerror ${JSON.stringify(pe)}`);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.waitForTimeout(400);
    await page.screenshot({path:SHOTS+`r7-${id.replace('.','')}-dark-${width}.png`});
  }
  await ctx.close();
}
await browser.close();
console.log('DONE R7-W2');
