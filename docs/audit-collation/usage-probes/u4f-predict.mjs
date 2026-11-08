// U4f 予想して確かめる経路を可視UIの実クリックのみで検証
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U4f');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/dynamic/index.html',{waitUntil:'networkidle'});
await page.waitForTimeout(1400);
const lp=await page.evaluate(()=>document.querySelector('#learning-path')?.selectedOptions[0]?.textContent);
log.info('既定の学び方: '+lp);
await page.selectOption('#learning-path',{label:'予想して確かめる'});
await page.waitForTimeout(600);
await page.getByRole('button',{name:'フィンの温度',exact:true}).click();
await page.waitForTimeout(800);
await page.getByRole('button',{name:/初期条件を準備/}).click();
await page.waitForTimeout(600);
const snap=()=>page.evaluate(()=>({clock:document.querySelector('[id=clock]')?.textContent||'',
  readout:document.querySelector('#readout')?.textContent.replace(/\s+/g,' ').slice(0,110)||'',
  predVisible:(()=>{const e=[...document.querySelectorAll('*')].find(x=>/5秒後の予想/.test(x.textContent)&&x.children.length<3);return !!e;})()}));
log.info('準備後: '+JSON.stringify(await snap()));
// 予想ラジオ（可視）を選ぶ
const radios=page.locator('label:has(input[type=radio]) >> visible=true');
const rc=await radios.count();
log.info('可視ラジオ数='+rc);
if(rc)await radios.first().click();
await page.waitForTimeout(300);
await page.getByRole('button',{name:/予想を確定/}).click();
await page.waitForTimeout(600);
log.info('予想確定後: '+JSON.stringify(await snap()));
await page.screenshot({path:SHOTS+'u4f-predict-confirm-375.png'});
await page.getByRole('button',{name:/5秒まで計算/}).click();
await page.waitForTimeout(5000);
log.info('5秒まで計算+5秒後: '+JSON.stringify(await snap()));
await page.waitForTimeout(4000);
log.info('さらに4秒後: '+JSON.stringify(await snap()));
await page.screenshot({path:SHOTS+'u4f-predict-run-375.png'});
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U4f DONE');
