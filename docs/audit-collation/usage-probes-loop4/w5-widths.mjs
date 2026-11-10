// W5 幅走査：全ルート初期画面（375/1280）＋変更節（375/1280）の文書はみ出しと記事内の内部横スクロール要素数
import {launch,newPage,DIST,makeLog,overflow} from './lib.mjs';
const log=makeLog('W5');
const browser=await launch();
const routes=['home','reader','quiz','review','search','glossary','map','simulator','lab','plan','calendar','settings','guide'];
const changedSecs=['1.3','2.4','4.2','4.4','5.2','5.6','7.2','10.1','10.4','11.6','11.7','11.9','11.10','11.11'];
for(const width of [375,1280]){
  const {ctx,page,errors}=await newPage(browser,{width,height:width===375?812:800});
  page.setDefaultTimeout(120000);
  let badRoutes=[];
  for(const r of routes){
    await page.goto(DIST+'/index.html#'+r,{waitUntil:'load'});
    await page.waitForTimeout(1500);
    const ov=await overflow(page);
    if(ov.bad)badRoutes.push(r+':'+JSON.stringify(ov));
  }
  if(badRoutes.length)log.fail(width+'px ルートはみ出し: '+badRoutes.join(' | '));
  else log.ok(width+'px 全'+routes.length+'ルート初期画面で文書はみ出し 0');
  let badSecs=[];
  for(const s of changedSecs){
    await page.goto(DIST+'/index.html#reader/'+s,{waitUntil:'load'});
    await page.waitForTimeout(1700);
    const ov=await overflow(page);
    if(ov.bad)badSecs.push(s+':'+JSON.stringify(ov));
  }
  if(badSecs.length)log.fail(width+'px 変更節はみ出し: '+badSecs.join(' | '));
  else log.ok(width+'px 変更節'+changedSecs.length+'節で文書はみ出し 0');
  // 記事内の内部横スクロール要素（375 のみ数える）
  if(width===375){
    await page.goto(DIST+'/index.html#reader/11.11',{waitUntil:'load'});
    await page.waitForTimeout(2000);
    const inner=await page.evaluate(()=>{
      const art=document.querySelector('#reader-article');if(!art)return -1;
      return [...art.querySelectorAll('*')].filter(e=>e.scrollWidth>e.clientWidth+1&&e.clientWidth>0).length;
    });
    log.info('§11.11 記事内の内部横スクロール要素数: '+inner);
  }
  const pe=errors.filter(e=>e.startsWith('pageerror'));
  if(pe.length)log.fail(width+'px pageerror: '+pe.join(' | ')); else log.ok(width+'px セッション pageerror 0');
  await ctx.close();
}
await browser.close();
console.log('W5 DONE');
