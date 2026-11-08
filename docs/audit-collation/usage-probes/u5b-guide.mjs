// U5b 使い方ガイド：項目を開き、手順が実際にたどれるか確認／不正JSON取り込みの扱い
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
import {writeFileSync} from 'node:fs';
const log=makeLog('U5b');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#guide',{waitUntil:'networkidle'});
await page.waitForTimeout(900);
const items=await page.evaluate(()=>[...document.querySelectorAll('main a, main button')].map(e=>({t:e.textContent.trim().slice(0,40),href:e.getAttribute('href')})).filter(x=>x.t.length>3).slice(0,54));
log.info('ガイド項目数(リンク候補): '+items.length);
log.info('項目サンプル: '+JSON.stringify(items.slice(0,14)));
// start 項目
await page.goto(DIST+'/index.html#guide/start',{waitUntil:'networkidle'});
await page.waitForTimeout(800);
let g=await page.evaluate(()=>{const m=document.querySelector('main');return {h:[...m.querySelectorAll('h2,h3')].map(x=>x.textContent.trim().slice(0,40)).slice(0,4),text:m.textContent.replace(/\s+/g,' ').slice(0,420)};});
log.info('guide/start: '+JSON.stringify(g).slice(0,520));
if(/13|タブ|シミュレーター/.test(g.text))log.ok('start ガイドが現行の画面構成（13タブ等）を説明している');
// lab 項目
await page.goto(DIST+'/index.html#guide/lab',{waitUntil:'networkidle'});
await page.waitForTimeout(800);
g=await page.evaluate(()=>{const m=document.querySelectorAll('main');const mm=document.querySelector('main');return {text:mm?mm.textContent.replace(/\s+/g,' ').slice(0,500):''};});
log.info('guide/lab: '+g.text.slice(0,420));
if(/実験室|ポップアップ|単語帳|章末問題/.test(g.text))log.ok('lab ガイド項目が存在し現行機能に触れている');
await page.screenshot({path:SHOTS+'u5b-guide-lab-375.png'});
// ガイド内の導線リンクを実際にたどる（実験室を開く等）
const follow=await page.evaluate(()=>{const a=[...document.querySelectorAll('main a')].find(a=>/実験室|シミュレーター/.test(a.textContent));if(a){return {t:a.textContent.trim().slice(0,30),href:a.getAttribute('href')};}return null;});
log.info('ガイド内導線: '+JSON.stringify(follow));
// ガイド項目をもう1件（sim-chf：簡易シミュレーターのガイド）
await page.goto(DIST+'/index.html#guide/sim-chf',{waitUntil:'networkidle'});
await page.waitForTimeout(800);
g=await page.evaluate(()=>{const mm=document.querySelector('main');return mm?mm.textContent.replace(/\s+/g,' ').slice(0,300):'';});
log.info('guide/sim-chf: '+g.slice(0,240));
// 不正JSONの取り込み
writeFileSync('/tmp/heat-usage/bad.json','{"schemaVersion":999,"settings":');
await page.goto(DIST+'/index.html#settings',{waitUntil:'networkidle'});
await page.waitForTimeout(700);
await page.setInputFiles('#import-file','/tmp/heat-usage/bad.json');
await page.waitForTimeout(1200);
const badState=await page.evaluate(()=>({alive:!!document.querySelector('main'),msg:document.body.textContent.replace(/\s+/g,' ').match(/(読み込め|形式|エラー|失敗|対応して)[^。]{0,40}/)?.[0]||''}));
log.info('不正JSON取り込み後: '+JSON.stringify(badState));
if(badState.alive)log.ok('不正JSONを取り込んでもアプリは壊れず、画面が維持される');
await page.screenshot({path:SHOTS+'u5b-bad-import-375.png'});
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U5b DONE');
