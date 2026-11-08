// V4c ポップアップガイド全操作（正しいセレクタ .sim-guide-popup で再測定）
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('V4C');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);
await page.goto(DIST+'/dynamic/index.html',{waitUntil:'load'});
await page.waitForTimeout(2500);
const pop=()=>page.evaluate(()=>{
  const p=document.querySelector('.sim-guide-popup');
  if(!p)return {exists:false};
  const r=p.getBoundingClientRect(),cs=getComputedStyle(p);
  return {exists:true,visible:r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden',
          count:document.querySelector('.sim-guide-count')?.textContent.trim()||'',
          title:document.querySelector('.sim-guide-title')?.textContent.trim()||'',
          pressed:document.querySelector('.sim-guide-toggle')?.getAttribute('aria-pressed')};
});
log.info('初期: '+JSON.stringify(await pop()));
await page.evaluate(()=>{document.querySelector('.sim-guide-toggle')?.click();});
await page.waitForTimeout(900);
let s=await pop();
log.info('ON後: '+JSON.stringify(s));
if(s.visible&&s.count.includes('1 /'))log.ok('ガイド表示（ステップ '+s.count+'）');
await page.screenshot({path:SHOTS+'v4c-guide-step1-375.png'});
// 次へ
await page.evaluate(()=>{const b=[...document.querySelectorAll('.sim-guide-nav button')].find(b=>b.textContent.trim()==='次へ');b?.click();});
await page.waitForTimeout(800);
s=await pop();
log.info('次へ後: '+JSON.stringify(s));
if(s.visible&&/2 \//.test(s.count))log.ok('次へでステップが進む');
// 戻る
await page.evaluate(()=>{const b=[...document.querySelectorAll('.sim-guide-nav button')].find(b=>b.textContent.trim()==='戻る');b?.click();});
await page.waitForTimeout(800);
s=await pop();
if(/1 \//.test(s.count))log.ok('戻るでステップが戻る');
// Esc
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
s=await pop();
log.info('Esc後: '+JSON.stringify(s));
if(!s.visible)log.ok('Esc で閉じる');
// 再表示→外側クリック
await page.evaluate(()=>{document.querySelector('.sim-guide-toggle')?.click();});
await page.waitForTimeout(800);
await page.mouse.click(30,700);
await page.waitForTimeout(700);
s=await pop();
log.info('外側クリック後: '+JSON.stringify(s));
if(!s.visible)log.ok('外側クリックで閉じる');
// 再表示→閉じるボタン
await page.evaluate(()=>{document.querySelector('.sim-guide-toggle')?.click();});
await page.waitForTimeout(800);
await page.evaluate(()=>{const b=[...document.querySelectorAll('.sim-guide-nav button')].find(b=>b.textContent.trim()==='閉じる');b?.click();});
await page.waitForTimeout(700);
s=await pop();
log.info('閉じるボタン後: '+JSON.stringify(s)+' pressed='+s.pressed);
if(!s.visible)log.ok('閉じるボタンで閉じる');
// OFF の保持（リロード）
await page.reload({waitUntil:'load'});
await page.waitForTimeout(2500);
s=await pop();
log.info('リロード後: '+JSON.stringify(s));
if(!s.visible&&s.pressed==='false')log.ok('OFF 状態がリロード後も保持される');
log.info('errors: '+JSON.stringify(errors.filter(e=>!/404/.test(e))));
await ctx.close();
await browser.close();
console.log('V4C DONE');
