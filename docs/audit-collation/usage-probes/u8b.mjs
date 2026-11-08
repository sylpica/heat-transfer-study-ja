import {launch,newPage,DIST,makeLog} from './lib.mjs';
const log=makeLog('U8b');
const browser=await launch();
const {ctx,page}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#glossary',{waitUntil:'networkidle'});
await page.waitForTimeout(900);
await page.fill('#glossary-query','熱');
await page.waitForTimeout(600);
// 先頭行（熱）を展開
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='詳しく見る');b?.click();});
await page.waitForTimeout(600);
const t=await page.evaluate(()=>{
  const row=document.querySelector('[aria-expanded="true"]')?.closest('li,article,div');
  const scope=row?.parentElement||document.querySelector('main');
  return scope.textContent.replace(/\s+/g,' ').slice(0,700);});
log.info('行展開テキスト: '+t.slice(0,480));
const dup=t.includes('温度差があるために、ある物体や領域から別の物体や領域へ移るエネルギー。温度差があるために');
log.info('行展開でも重複: '+dup);
await ctx.close();await browser.close();
