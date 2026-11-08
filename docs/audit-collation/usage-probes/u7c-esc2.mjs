import {launch,newPage,ROOT,DIST,makeLog} from './lib.mjs';
const log=makeLog('U7c');
const browser=await launch();
async function vis(page){return page.evaluate(()=>{const p=document.querySelector('.sim-guide-popup');
  if(!p)return 'absent';
  const cs=getComputedStyle(p);const r=p.getBoundingClientRect();
  return (cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0)?'visible':'hidden';});}
async function test(url,label){
  const {ctx,page}=await newPage(browser,{width:375});
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForTimeout(1300);
  log.info(label+' 読込時: '+await vis(page));
  await page.getByRole('button',{name:'ガイド',exact:true}).click().catch(async()=>{await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='ガイド');b?.click();});});
  await page.waitForTimeout(700);
  log.info(label+' ガイド押下後: '+await vis(page));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  log.info(label+' Esc後: '+await vis(page));
  // 再度開いて外側クリック
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='ガイド');b?.click();});
  await page.waitForTimeout(700);
  const v2=await vis(page);
  await page.mouse.click(365,110);
  await page.waitForTimeout(700);
  log.info(label+' 再表示='+v2+' 外側クリック後: '+await vis(page));
  // 再度開いて閉じるボタン
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='ガイド');b?.click();});
  await page.waitForTimeout(600);
  await page.evaluate(()=>{const p=document.querySelector('.sim-guide-popup');const b=p?[...p.querySelectorAll('button')].find(b=>b.textContent.trim()==='閉じる'):null;b?.click();});
  await page.waitForTimeout(600);
  log.info(label+' 閉じるボタン後: '+await vis(page));
  await ctx.close();
}
await test(DIST+'/dynamic/index.html','ラボ本画面');
await test(ROOT+'/dynamic/dev/heat-sink.html','heat-sink開発画面');
await browser.close();
