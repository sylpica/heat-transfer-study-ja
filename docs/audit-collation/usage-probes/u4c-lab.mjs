// U4c 通常ラボ：フィン実験の計算実行と値、ポップアップガイド、説明書・チュートリアル
import {launch,newPage,DIST,SHOTS,makeLog,overflow} from './lib.mjs';
const log=makeLog('U4c');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/dynamic/index.html',{waitUntil:'networkidle'});
await page.waitForTimeout(1500);
// 初期表示でガイドポップアップが出ているか
let pop=await page.evaluate(()=>{const p=document.querySelector('.sim-guide-pop, [data-sim-guide], .guide-popover');return p?{cls:p.className,text:p.textContent.replace(/\s+/g,' ').slice(0,120)}:null;});
log.info('初期ポップアップ: '+JSON.stringify(pop));
// フィンの温度 実験を選ぶ
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='フィンの温度');b?.click();});
await page.waitForTimeout(1000);
let st=await page.evaluate(()=>({h:[...document.querySelectorAll('h2,h3')].map(x=>x.textContent.trim().slice(0,40)).slice(0,5),
  readouts:[...document.querySelectorAll('[id*=temp], [id*=readout], output, .readout')].map(e=>e.id+':'+e.textContent.trim().slice(0,60)).slice(0,8)}));
log.info('フィン実験: '+JSON.stringify(st));
// 初期条件を準備 → 計算
const prep=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/初期条件を準備/.test(b.textContent));if(b){b.click();return true;}return false;});
await page.waitForTimeout(600);
const calcBtn=await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/計算|再生/.test(b.textContent)).map(b=>b.textContent.trim().slice(0,24)));
log.info('準備='+prep+' 計算系ボタン: '+JSON.stringify(calcBtn));
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/5秒まで計算|10秒まで計算|計算する/.test(b.textContent))||[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='再生');b?.click();});
await page.waitForTimeout(3500);
st=await page.evaluate(()=>{
  const texts=[...document.querySelectorAll('main *, body *')].map(e=>e.textContent).filter(t=>/測定点|温度/.test(t||'')&&t.length<90);
  const canvas=document.querySelector('canvas');
  return {samples:texts.slice(0,8), time:[...document.querySelectorAll('*')].map(e=>e.textContent).find(t=>/^\s*[\d.]+ ?秒|t = /.test(t||''))?.slice(0,30)||''};
});
log.info('計算後: '+JSON.stringify(st));
await page.screenshot({path:SHOTS+'u4c-lab-fin-375.png'});
// 停止
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/停止|一時停止/.test(b.textContent));b?.click();});
await page.waitForTimeout(300);
// ポップアップガイド：ガイドボタンを押す
const guideBtn=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='ガイド');if(b){b.click();return true;}return false;});
await page.waitForTimeout(900);
pop=await page.evaluate(()=>{const p=document.querySelector('.sim-guide-pop, [data-sim-guide], .guide-popover, [role=dialog]');
  const cands=[...document.querySelectorAll('div,section')].filter(e=>/ステップ|ガイド/.test(e.textContent)&&e.textContent.length<400);
  return {direct:p?{cls:p.className,text:p.textContent.replace(/\s+/g,' ').slice(0,140)}:null,
    cand:cands.slice(-2).map(e=>(e.className||'').toString().slice(0,40)+':'+e.textContent.replace(/\s+/g,' ').slice(0,120))};});
log.info('ガイド('+guideBtn+'): '+JSON.stringify(pop));
await page.screenshot({path:SHOTS+'u4c-guide-pop-375.png'});
// 次へで手順送り
const stepBefore=pop.direct?.text||'';
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='次へ');b?.click();});
await page.waitForTimeout(700);
const pop2=await page.evaluate(()=>{const cands=[...document.querySelectorAll('div,section')].filter(e=>/ステップ|ガイド/.test(e.textContent)&&e.textContent.length<400);return cands.slice(-1).map(e=>e.textContent.replace(/\s+/g,' ').slice(0,140));});
log.info('次へ後: '+JSON.stringify(pop2));
if(pop2.length&&pop2[0]!==stepBefore)log.ok('ポップアップガイドの手順送りができる');
// Escで終了
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
const popGone=await page.evaluate(()=>{const cands=[...document.querySelectorAll('div,section')].filter(e=>e.offsetParent&&/ステップ/.test(e.textContent)&&e.textContent.length<400);return cands.length;});
log.info('Esc後のガイド残存数: '+popGone);
if(popGone===0)log.ok('Escでポップアップガイドが閉じる');
// 使い方と理論（説明書）
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/使い方と理論/.test(b.textContent));b?.click();});
await page.waitForTimeout(1000);
const manual=await page.evaluate(()=>{
  const heads=[...document.querySelectorAll('h2,h3,h4')].map(x=>x.textContent.trim().slice(0,44)).slice(0,16);
  const dets=[...document.querySelectorAll('details')].slice(0,6).map(d=>d.querySelector('summary')?.textContent.trim().slice(0,44));
  return {heads,dets,bodyLen:document.body.textContent.length};
});
log.info('説明書ビュー: '+JSON.stringify(manual));
await page.screenshot({path:SHOTS+'u4c-manual-375.png'});
const ov=await overflow(page);log.info('横はみ出し: '+JSON.stringify(ov));
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U4c DONE');
