// U4a 簡易シミュレーター：ピッカーでモード変更、値変更で再計算、比較保存
import {launch,newPage,DIST,SHOTS,makeLog,overflow} from './lib.mjs';
const log=makeLog('U4a');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#simulator',{waitUntil:'networkidle'});
await page.waitForTimeout(1000);
let st=await page.evaluate(()=>({mode:document.querySelector('main h2, main h3')?.textContent.trim().slice(0,50),
  outputs:[...document.querySelectorAll('main output, main .result, main dd, main strong')].map(e=>e.textContent.trim().slice(0,40)).slice(0,8),
  bodyHead:document.querySelector('main').textContent.replace(/\s+/g,' ').slice(0,260)}));
log.info('初期モード: '+JSON.stringify(st).slice(0,420));
await page.screenshot({path:SHOTS+'u4a-sim-initial-375.png'});
// ピッカーを開く
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/モードを変更/.test(b.textContent));b?.click();});
await page.waitForTimeout(600);
const picker=await page.evaluate(()=>{
  const items=[...document.querySelectorAll('button')].map(b=>b.textContent.trim().slice(0,34)).filter(t=>t.length>3);
  const tabs=[...document.querySelectorAll('[role=tab], .picker-tab, button')].map(b=>b.textContent.trim().slice(0,20)).filter(t=>/伝導|対流|放射|沸騰|総合/.test(t));
  return {tabs:tabs.slice(0,8),items:items.slice(0,26),count:items.length};
});
log.info('ピッカー: '+JSON.stringify(picker));
await page.screenshot({path:SHOTS+'u4a-picker-375.png'});
// モードを1つ選ぶ（放射っぽいもの）
const picked=await page.evaluate(()=>{
  const bs=[...document.querySelectorAll('button')].filter(b=>/放射/.test(b.textContent)&&b.textContent.length<40&&!/モード/.test(b.textContent));
  if(bs.length){bs[bs.length-1].click();return bs[bs.length-1].textContent.trim().slice(0,34);}
  return null;});
await page.waitForTimeout(900);
st=await page.evaluate(()=>({h:[...document.querySelectorAll('main h2,main h3')].map(x=>x.textContent.trim().slice(0,44)).slice(0,3),
  inputs:[...document.querySelectorAll('main input[name]')].map(i=>i.name+'='+i.value).slice(0,6)}));
log.info('放射系モード選択('+picked+'): '+JSON.stringify(st));
if(picked)log.ok('ピッカーでモードを変更できる');
// Escで閉じる挙動（ピッカー再開→Esc）
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/モードを変更/.test(b.textContent));b?.click();});
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const pickerGone=await page.evaluate(()=>![...document.querySelectorAll('button')].some(b=>b.offsetParent&&/放射の/.test(b.textContent)&&b.textContent.length<40));
log.info('Esc後ピッカー項目の可視性（消えていればtrue）: '+pickerGone);
// 入力変更で再計算されるか（最初の数値入力を変更）
const before=await page.evaluate(()=>document.querySelector('main').textContent.replace(/\s+/g,' ').match(/[\d,.]+\s*(W|W\/m|K|℃)/)?.[0]||'');
const changed=await page.evaluate(()=>{const i=document.querySelector('main input[type=number]');if(!i)return false;const v=parseFloat(i.value);i.value=String(v*2);i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));return i.name+' '+v+'→'+i.value;});
await page.waitForTimeout(700);
const after=await page.evaluate(()=>document.querySelector('main').textContent.replace(/\s+/g,' ').match(/[\d,.]+\s*(W|W\/m|K|℃)/)?.[0]||'');
log.info('入力変更('+changed+'): 結果表記 '+before+' → '+after);
if(changed&&before!==after)log.ok('入力変更で結果が再計算される');else log.obs('結果表記の変化を確認できず（抽出方法の限界の可能性）');
// 比較保存
const cmp=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/比較用に保存/.test(b.textContent));if(b){b.click();return true;}return false;});
await page.waitForTimeout(500);
const cmpState=await page.evaluate(()=>/比較/.test(document.body.textContent)&&/保存/.test(document.body.textContent));
log.info('比較保存クリック='+cmp+' 状態表示='+cmpState);
const ov=await overflow(page);log.info('横はみ出し: '+JSON.stringify(ov));
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U4a DONE');
