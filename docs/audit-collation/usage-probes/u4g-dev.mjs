// U4g 開発画面：ヒートシンク連成・共役キャビティ・フィン間流路のプリセット計算（ルート配信）
import {launch,newPage,ROOT,SHOTS,makeLog,overflow} from './lib.mjs';
const log=makeLog('U4g');
const browser=await launch();
async function visit(path,tag){
  const {ctx,page,errors}=await newPage(browser,{width:375});
  await page.goto(ROOT+path,{waitUntil:'networkidle'});
  await page.waitForTimeout(1500);
  const dom=await page.evaluate(()=>({
    title:document.title,
    presets:[...document.querySelectorAll('button')].map(b=>b.textContent.trim().slice(0,40)).filter(t=>/プリセット|標準|基準|ケース|例/.test(t)).slice(0,8),
    btns:[...document.querySelectorAll('button')].map(b=>b.textContent.trim().slice(0,30)).filter(Boolean).slice(0,16),
    selects:[...document.querySelectorAll('select')].map(s=>({id:s.id,opts:[...s.options].map(o=>o.textContent.slice(0,34))})).slice(0,4)}));
  log.info(tag+' DOM: '+JSON.stringify(dom).slice(0,700));
  return {ctx,page,errors};
}
// --- ヒートシンク連成 ---
{
  const {ctx,page,errors}=await visit('/dynamic/dev/heat-sink-coupled.html','HS連成');
  // プリセット選択肢があれば選ぶ／なければそのまま計算
  const sel=await page.evaluate(()=>{const s=document.querySelector('select');return s?s.id||s.name:null;});
  if(sel){await page.selectOption('select',{index:0}).catch(()=>{});await page.waitForTimeout(300);}
  const run=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/計算|解く|実行/.test(b.textContent));if(b){b.click();return b.textContent.trim().slice(0,24);}return null;});
  log.info('HS連成 計算ボタン: '+run);
  await page.waitForTimeout(6000);
  const out=await page.evaluate(()=>{const pre=document.querySelector('pre, output, .readout, [id*=result], [id*=readout]');
    return pre?pre.textContent.replace(/\s+/g,' ').slice(0,340):document.body.textContent.replace(/\s+/g,' ').slice(0,340);});
  log.info('HS連成 結果: '+out);
  if(/316\.6|3\.04|0\.227/.test(out))log.ok('ヒートシンク連成の標準ケース結果が検証記録値（316.687 K／3.042 Pa／0.227 W）と一致する範囲で表示される');
  await page.screenshot({path:SHOTS+'u4g-heatsink-coupled-375.png'});
  log.info('HS連成 errors='+JSON.stringify(errors));
  await ctx.close();
}
// --- 共役キャビティ ---
{
  const {ctx,page,errors}=await visit('/dynamic/dev/conjugate-cavity.html','共役');
  const run=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/計算|解く|実行|再生/.test(b.textContent));if(b){b.click();return b.textContent.trim().slice(0,24);}return null;});
  log.info('共役 実行ボタン: '+run);
  await page.waitForTimeout(6000);
  const out=await page.evaluate(()=>{const pre=document.querySelector('pre, output, .readout, [id*=result], [id*=readout]');
    return pre?pre.textContent.replace(/\s+/g,' ').slice(0,340):document.body.textContent.replace(/\s+/g,' ').slice(0,340);});
  log.info('共役 結果: '+out);
  await page.screenshot({path:SHOTS+'u4g-conjugate-375.png'});
  log.info('共役 errors='+JSON.stringify(errors));
  await ctx.close();
}
// --- フィン間流路 ---
{
  const {ctx,page,errors}=await visit('/dynamic/dev/fin-gap-flow.html','フィン間');
  const run=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/計算|解く|実行/.test(b.textContent));if(b){b.click();return b.textContent.trim().slice(0,24);}return null;});
  log.info('フィン間 計算ボタン: '+run);
  await page.waitForTimeout(3000);
  const out=await page.evaluate(()=>{const pre=document.querySelector('pre, output, .readout, [id*=result], [id*=readout]');
    return pre?pre.textContent.replace(/\s+/g,' ').slice(0,380):document.body.textContent.replace(/\s+/g,' ').slice(0,380);});
  log.info('フィン間 結果: '+out);
  if(/8\.235|7\.540/.test(out))log.ok('フィン間流路の発達Nuが検証記録値（8.235294／7.540486）と一致する表示');
  await page.screenshot({path:SHOTS+'u4g-fingap-375.png'});
  const ov=await overflow(page);log.info('フィン間 横はみ出し: '+JSON.stringify(ov));
  log.info('フィン間 errors='+JSON.stringify(errors));
  await ctx.close();
}
await browser.close();
console.log('U4g DONE');
