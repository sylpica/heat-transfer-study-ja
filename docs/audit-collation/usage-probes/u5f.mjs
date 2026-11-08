import {launch,newPage,DIST,makeLog} from './lib.mjs';
const log=makeLog('U5f');
const browser=await launch();
const {ctx,page}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#guide/lab',{waitUntil:'networkidle'});
await page.waitForTimeout(900);
const res=await page.evaluate(()=>{
  const secs=[...document.querySelectorAll('.guide-section')];
  const find=(re)=>secs.find(s=>re.test(s.querySelector('h2,h3')?.textContent||''));
  const lab=find(/通常シミュレーター/);
  const search=find(/検索と用語集/);
  const data=find(/保存・書き出し/);
  return {count:secs.length,
    labY:lab?lab.getBoundingClientRect().top+scrollY:null, scrollY,
    lab:lab?lab.textContent.replace(/\s+/g,' ').slice(0,650):null,
    search:search?search.textContent.replace(/\s+/g,' ').slice(0,420):null,
    data:data?data.textContent.replace(/\s+/g,' ').slice(0,300):null};
});
log.info('ガイド項目総数: '+res.count);
log.info('guide/lab 項目: '+(res.lab||'').slice(0,600));
log.info('スクロール位置: scrollY='+res.scrollY+' lab項目top='+res.labY);
if(res.lab&&/ポップアップ/.test(res.lab))log.ok('lab ガイド項目にポップアップ式ガイドの説明がある');
if(res.lab&&/実験室/.test(res.lab))log.ok('lab ガイド項目が実験室の使い方を説明している');
log.info('guide/search 項目: '+(res.search||'').slice(0,380));
if(res.search&&/単語帳/.test(res.search))log.ok('search ガイド項目に単語帳・ブックマークの説明がある');
if(res.search&&/章末問題/.test(res.search))log.ok('search ガイド項目に章末問題検索の説明がある');
await ctx.close();await browser.close();
