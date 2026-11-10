// R7-W4b ブックマーク保持の診断：localStorage と行表示の両方で確認（ループ4 W1b の手続き）
import {launch,newPage,DIST,makeLog} from './lib.mjs';
const log=makeLog('R7-W4b');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);
await page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
await page.waitForTimeout(2000);
await page.evaluate(()=>{const row=document.querySelector('#term-fin-efficiency');const b=row?[...row.querySelectorAll('button')].find(x=>/☆|★/.test(x.textContent)):null;b?.click();});
await page.waitForTimeout(800);
const before=await page.evaluate(()=>{
  const ls=localStorage.getItem('heat-study-ja:v1')||'';
  const row=document.querySelector('#term-fin-efficiency');
  const b=row?[...row.querySelectorAll('button')].find(x=>/☆|★/.test(x.textContent)):null;
  return {lsHas:ls.includes('fin-efficiency'),btn:b?b.textContent.trim():null};
});
log.info('ブックマーク直後: '+JSON.stringify(before));
await page.reload({waitUntil:'load'});
// 描画完了までポーリング（最大15秒）
let kept=null;
for(let i=0;i<15;i++){
  await page.waitForTimeout(1000);
  kept=await page.evaluate(()=>{
    const row=document.querySelector('#term-fin-efficiency');
    if(!row)return {stage:'no-row'};
    const b=[...row.querySelectorAll('button')].find(x=>/☆|★/.test(x.textContent));
    return {stage:'row',btn:b?b.textContent.trim():null,lsHas:(localStorage.getItem('heat-study-ja:v1')||'').includes('fin-efficiency')};
  });
  if(kept.stage==='row'&&kept.btn)break;
}
log.info('リロード後（ポーリング）: '+JSON.stringify(kept));
if(kept&&kept.btn&&kept.btn.includes('★')&&kept.lsHas)log.ok('リロード後もブックマークが保持される（localStorage と ★ 表示の両方で確認）。W4 本体の FAIL は描画途中の誤測');
else log.fail('リロード後にブックマークが保持されない（診断でも再現）: '+JSON.stringify(kept));
log.info('pageerror: '+JSON.stringify(errors.filter(e=>e.startsWith('pageerror'))));
await ctx.close();
await browser.close();
console.log('DONE R7-W4b');
