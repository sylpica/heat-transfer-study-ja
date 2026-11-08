import {launch,newPage,DIST,makeLog} from './lib.mjs';
const log=makeLog('U5g');
const browser=await launch();
const {ctx,page}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#guide',{waitUntil:'networkidle'});
await page.waitForTimeout(900);
const res=await page.evaluate(()=>{
  const secs=[...document.querySelectorAll('.guide-section')];
  const get=(re)=>{const s=secs.find(s=>re.test(s.querySelector('h2,h3')?.textContent||''));return s?s.textContent.replace(/\s+/g,' '):'';};
  const lab=get(/通常シミュレーター/),search=get(/検索と用語集/),reader=get(/教材を読む/),sim=get(/共通操作/);
  return {labLen:lab.length,labPop:lab.includes('ポップアップ'),labGuide:lab.includes('ガイド'),
    searchCard:search.includes('単語帳'),searchBm:search.includes('ブックマーク'),searchProb:search.includes('章末問題'),
    readerApx:reader.includes('付録'),readerProb:reader.includes('章末問題'),simPicker:/モードを変更|ピッカー|一覧から/.test(sim)};
});
log.info(JSON.stringify(res));
await ctx.close();await browser.close();
