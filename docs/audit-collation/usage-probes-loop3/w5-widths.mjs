// W5 幅・テーマ横断：全ルートの横はみ出し走査（390／1280／375ダーク＋375ライト未実施ルート）
import {launch,newPage,DIST,makeLog,overflow} from './lib.mjs';
const log=makeLog('W5');
const browser=await launch();
const ROUTES=['home','reader','search','glossary','quiz','review','plan','calendar','map','simulator','lab','settings','guide'];
const CONFIGS=[
  {width:375,dark:false,tag:'375-light',routes:['search','quiz','review','plan','calendar','map','lab','guide']},
  {width:390,dark:false,tag:'390-light',routes:ROUTES},
  {width:1280,dark:false,tag:'1280-light',routes:ROUTES},
  {width:375,dark:true,tag:'375-dark',routes:ROUTES},
];
for(const cfg of CONFIGS){
  const {ctx,page,errors}=await newPage(browser,{width:cfg.width,dark:cfg.dark});
  page.setDefaultTimeout(120000);
  const badRoutes=[];
  for(const r of cfg.routes){
    await page.goto(DIST+'/index.html#'+r,{waitUntil:'load'});
    await page.waitForTimeout(1300);
    const ov=await overflow(page);
    if(ov.bad)badRoutes.push(r+'(doc='+ov.doc+')');
  }
  log.info(cfg.tag+' はみ出しルート: '+JSON.stringify(badRoutes));
  if(badRoutes.length===0)log.ok(cfg.tag+' 全対象ルートで横はみ出し 0');
  else log.fail(cfg.tag+' 横はみ出し: '+badRoutes.join(', '));
  const pe=errors.filter(e=>e.startsWith('pageerror'));
  if(pe.length===0)log.ok(cfg.tag+' pageerror 0');
  else log.fail(cfg.tag+' pageerror: '+pe.join(' | '));
  await ctx.close();
}
await browser.close();
console.log('W5 DONE');
