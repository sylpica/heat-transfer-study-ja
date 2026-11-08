// U4d ラボ確定版：予想確定→計算→値確認、ガイドポップアップ内の手順送り、説明書16項目
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U4d');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/dynamic/index.html',{waitUntil:'networkidle'});
await page.waitForTimeout(1400);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='フィンの温度');b?.click();});
await page.waitForTimeout(800);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/初期条件を準備/.test(b.textContent));b?.click();});
await page.waitForTimeout(500);
// 予想を選んで確定
const pred=await page.evaluate(()=>{
  const r=document.querySelector('input[type=radio]');if(r){r.click();}
  const b=[...document.querySelectorAll('button')].find(b=>/予想を確定/.test(b.textContent));if(b){b.click();return true;}return false;});
log.info('予想確定='+pred);
await page.waitForTimeout(400);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/5秒まで計算/.test(b.textContent));b?.click();});
await page.waitForTimeout(4000);
const st=await page.evaluate(()=>({clock:document.querySelector('#clock')?.textContent||document.querySelector('[id=clock]')?.textContent||'',
  readout:document.querySelector('.readout, [id*=readout]')?.textContent.replace(/\s+/g,' ').slice(0,120)||'',
  graph:[...document.querySelectorAll('*')].map(e=>e.textContent).find(t=>/t=[\d.]+ s/.test(t||''))?.slice(0,60)||''}));
log.info('計算後: '+JSON.stringify(st));
if(/A [2-9]\d\./.test(st.readout)||/t=[1-9]/.test(st.graph))log.ok('フィン計算が進み測定点温度が初期20℃から変化する');
else log.obs('温度変化を読み取れず: '+JSON.stringify(st));
await page.screenshot({path:SHOTS+'u4d-lab-fin-run-375.png'});
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='停止');b?.click();});
// ガイドポップアップ内の手順送り（要素を限定）
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='ガイド');b?.click();});
await page.waitForTimeout(800);
const popText=()=>page.evaluate(()=>document.querySelector('.sim-guide-popup')?.textContent.replace(/\s+/g,' ').slice(0,110)||null);
const s1=await popText();log.info('ガイド step表示: '+s1);
await page.evaluate(()=>{const p=document.querySelector('.sim-guide-popup');const b=[...p.querySelectorAll('button')].find(b=>b.textContent.trim()==='次へ');b?.click();});
await page.waitForTimeout(600);
const s2=await popText();log.info('次へ後: '+s2);
if(s1&&s2&&s1!==s2&&/2 \/ 8/.test(s2))log.ok('ポップアップガイドが 1/8 → 2/8 へ進む');
await page.evaluate(()=>{const p=document.querySelector('.sim-guide-popup');const b=[...p.querySelectorAll('button')].find(b=>b.textContent.trim()==='戻る');b?.click();});
await page.waitForTimeout(500);
const s3=await popText();log.info('戻る後: '+s3);
if(s3&&/1 \/ 8/.test(s3))log.ok('戻るで 1/8 に戻る');
// ガイドOFFトグル（画面内のガイド表示切替）
const toggles=await page.evaluate(()=>[...document.querySelectorAll('input[type=checkbox]')].map(i=>({id:i.id,label:(i.closest('label')?.textContent||'').trim().slice(0,30),checked:i.checked})).filter(t=>/ガイド/.test(t.label)));
log.info('ガイド系トグル: '+JSON.stringify(toggles));
await page.evaluate(()=>{const p=document.querySelector('.sim-guide-popup');const b=[...p.querySelectorAll('button')].find(b=>b.textContent.trim()==='閉じる');b?.click();});
await page.waitForTimeout(400);
// 説明書：モデル別説明書の1モデル分を開いて項目数を確認
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/使い方と理論/.test(b.textContent));b?.click();});
await page.waitForTimeout(900);
const man=await page.evaluate(()=>{
  const det=[...document.querySelectorAll('details')].find(d=>/モデル別説明書|説明書/.test(d.querySelector('summary')?.textContent||''));
  return {found:!!det, summaries:[...document.querySelectorAll('details>summary')].map(s=>s.textContent.trim().slice(0,40)).slice(0,20)};
});
log.info('説明書details: '+JSON.stringify(man));
const openedMan=await page.evaluate(()=>{
  const sums=[...document.querySelectorAll('details>summary')];
  const s=sums.find(x=>/矩形|フィン|放射/.test(x.textContent))||sums[0];
  if(s){s.click();return s.textContent.trim().slice(0,44);}return null;});
await page.waitForTimeout(700);
const manBody=await page.evaluate(()=>{
  const open=[...document.querySelectorAll('details[open]')];
  const last=open[open.length-1];
  return last?last.textContent.replace(/\s+/g,' ').slice(0,300):'';
});
log.info('開いた説明書('+openedMan+'): '+manBody.slice(0,240));
await page.screenshot({path:SHOTS+'u4d-manual-open-375.png'});
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U4d DONE');
