// F5b 解法設定の反映確認（順序を正した再検証）：プリセット適用後に nx / dt を変えて「条件を適用」
import {launch,newPage,DIST,SHOTS,makeLog,errorSummary} from './lib.mjs';
const log=makeLog('F5b');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(90000);
await page.goto(DIST+'/dynamic/index.html',{waitUntil:'load'});
await page.waitForTimeout(3000);
await page.selectOption('#mode','expert');
await page.waitForTimeout(400);
await page.evaluate(()=>{const d=document.querySelector('#expert-settings');if(d)d.open=true;});

async function applyAndRun(tag){
  await page.click('#apply');
  await page.waitForTimeout(800);
  await page.fill('#interval','5');
  await page.click('#step');
  await page.waitForFunction(()=>/^5\./.test(document.querySelector('#clock')?.textContent||''),null,{timeout:150000}).catch(()=>null);
  await page.waitForTimeout(400);
  const r=await page.evaluate(()=>({
    clock:document.querySelector('#clock')?.textContent.trim()||'',
    readout:document.querySelector('#readout')?.textContent.replace(/\s+/g,' ').trim().slice(0,120)||'',
    diag:(document.querySelector('#diagnostic-values')?.textContent||'').replace(/\s+/g,' ').trim().slice(0,200)}));
  log.info(tag+': '+JSON.stringify(r));
  return r;
}
// 1) プリセットを押した直後の nx 値（プリセットが格子を決めるか）
await page.click('[data-preset="heating"]');
await page.waitForTimeout(500);
const nxAfterPreset=await page.evaluate(()=>({nx:document.querySelector('#nx')?.value,ny:document.querySelector('#ny')?.value,dt:document.querySelector('#dt')?.value}));
log.info('プリセット適用直後の入力: '+JSON.stringify(nxAfterPreset));
const base=await applyAndRun('ベースライン（プリセット格子）');
// 2) プリセットを押し直さず nx だけ変えて適用
await page.fill('#nx','48');
const nxSet=await page.evaluate(()=>document.querySelector('#nx')?.value);
log.info('nx 入力値（適用前）: '+nxSet);
const fine=await applyAndRun('nx=48');
const gridOf=s=>{const m=s.match(/格子\s*(\d+)\s*×\s*(\d+)/);return m?m[1]+'x'+m[2]:'?';};
log.info('格子比較: base '+gridOf(base.diag)+' → nx48 '+gridOf(fine.diag));
if(gridOf(base.diag)!==gridOf(fine.diag)&&gridOf(fine.diag).startsWith('48'))
  log.ok('nx の変更が適用後の格子に反映される（'+gridOf(base.diag)+' → '+gridOf(fine.diag)+'）');
else log.fail('nx を変えても格子が変わらない: '+gridOf(fine.diag));
if(base.readout!==fine.readout||base.diag!==fine.diag)log.ok('格子変更で計算結果（診断値）が変わる');
else log.fail('格子変更でも診断値まで完全一致');
// 3) dt を明示（nx=48 のまま）
await page.fill('#dt','0.001');
const withDt=await applyAndRun('nx=48, dt=0.001');
if(/時間刻み 0\.001 s/.test(withDt.diag))log.ok('dt の明示指定が診断表示の時間刻みに反映される');else log.obs('dt 反映が診断文で確認できない: '+withDt.diag.slice(0,120));
errorSummary(log,errors,'F5b');
await ctx.close();
await browser.close();
console.log('F5B DONE');
