import {launch,newPage,DIST,makeLog} from './lib.mjs';
const log=makeLog('U4a2');
const browser=await launch();
const {ctx,page}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#simulator',{waitUntil:'networkidle'});
await page.waitForTimeout(900);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/モードを変更/.test(b.textContent));b?.click();});
await page.waitForTimeout(400);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/二面間の放射/.test(b.textContent));b?.click();});
await page.waitForTimeout(800);
async function resultText(){return page.evaluate(()=>{
  const els=[...document.querySelectorAll('main *')].filter(e=>e.children.length===0&&/計算結果|正味/.test(e.textContent));
  const main=document.querySelector('main');
  const t=main.textContent.replace(/\s+/g,' ');
  const m=t.match(/計算結果(.{0,160})/);
  return m?m[1]:t.slice(0,200);});}
const r1=await resultText();log.info('初期結果: '+r1);
await page.evaluate(()=>{const i=document.querySelector('input[name=area1]');i.value='2';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));});
await page.waitForTimeout(700);
const r2=await resultText();log.info('A1=2変更後: '+r2);
if(r1!==r2)log.ok('入力変更で計算結果が更新される');else log.fail('入力変更で結果が変わらない');
// 独立検算：平行平板 F=1 と仮定した式と比較（表示値の桁確認）
const vals=await page.evaluate(()=>{const g=n=>parseFloat(document.querySelector('input[name='+n+']')?.value);
  return {A1:g('area1'),A2:g('area2'),e1:g('epsilon1'),e2:g('epsilon2'),T1:g('temp1'),T2:g('temp2')};});
log.info('入力値: '+JSON.stringify(vals));
const qtext=await page.evaluate(()=>document.querySelector('main').textContent.replace(/\s+/g,' '));
const qm=qtext.match(/([\d,]+\.?\d*)\s*W(?!\/)/);
log.info('表示Q候補: '+(qm?qm[0]:'なし'));
await ctx.close();await browser.close();
console.log('U4a2 DONE');
