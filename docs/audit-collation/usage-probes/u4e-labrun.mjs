// U4e ラボ計算実行の厳密検証：学び方=自由に試す で再生し、時計と測定点の変化を実測
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U4e');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/dynamic/index.html',{waitUntil:'networkidle'});
await page.waitForTimeout(1400);
// 学び方を「自由に試す」に
await page.selectOption('#learning-path',{label:'自由に試す'}).catch(e=>log.info('learning-path選択失敗: '+e.message));
await page.waitForTimeout(500);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='板を加熱');b?.click();});
await page.waitForTimeout(800);
const btnState=()=>page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/準備|再生|計算|停止/.test(b.textContent)).map(b=>({t:b.textContent.trim().slice(0,20),disabled:b.disabled,visible:!!b.offsetParent})));
log.info('ボタン状態(加熱選択後): '+JSON.stringify(await btnState()));
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/初期条件を準備/.test(b.textContent));b?.click();});
await page.waitForTimeout(600);
log.info('ボタン状態(準備後): '+JSON.stringify(await btnState()));
const snap=()=>page.evaluate(()=>({clock:document.querySelector('[id=clock]')?.textContent||'',
  readout:document.querySelector('.readout')?.textContent.replace(/\s+/g,' ').slice(0,110)||''}));
log.info('再生前: '+JSON.stringify(await snap()));
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='再生');b?.click();});
await page.waitForTimeout(3000);
log.info('再生3秒後: '+JSON.stringify(await snap()));
await page.waitForTimeout(3000);
log.info('再生6秒後: '+JSON.stringify(await snap()));
await page.screenshot({path:SHOTS+'u4e-lab-heating-run-375.png'});
// 5秒まで計算ボタンでも
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/初期状態へ戻す|リセット/.test(b.textContent));b?.click();});
await page.waitForTimeout(500);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/初期条件を準備/.test(b.textContent));b?.click();});
await page.waitForTimeout(500);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/5秒まで計算/.test(b.textContent));b?.click();});
await page.waitForTimeout(3500);
log.info('5秒まで計算後: '+JSON.stringify(await snap()));
// フィン実験でも再生確認
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='フィンの温度');b?.click();});
await page.waitForTimeout(800);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/初期条件を準備/.test(b.textContent));b?.click();});
await page.waitForTimeout(500);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='再生');b?.click();});
await page.waitForTimeout(4000);
log.info('フィン再生4秒後: '+JSON.stringify(await snap()));
await page.screenshot({path:SHOTS+'u4e-lab-fin-run-375.png'});
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U4e DONE');
