import {launch,newPage,DIST,makeLog} from './lib.mjs';
const log=makeLog('U10');
const browser=await launch();
const {ctx,page}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#simulator',{waitUntil:'networkidle'});
await page.waitForTimeout(1000);
// ピッカーから全モード名を取得
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/モードを変更/.test(b.textContent));b?.click();});
await page.waitForTimeout(500);
const modes=await page.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>t.length>2&&t.length<30&&!/閉じる|保存|選ぶ/.test(t)));
log.info('モード候補: '+JSON.stringify(modes));
await page.keyboard.press('Escape');
const results=[];
for(const m of modes){
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/モードを変更/.test(b.textContent));b?.click();});
  await page.waitForTimeout(250);
  const clicked=await page.evaluate((m)=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===m);if(b){b.click();return true;}return false;},m);
  if(!clicked){results.push(m+':選択できず');continue;}
  await page.waitForTimeout(450);
  const r=await page.evaluate(()=>{
    const figs=[...document.querySelectorAll('figure, .sim-physical-diagram, svg')];
    let worst=0,info='';
    for(const f of figs){const d=f.scrollWidth-f.clientWidth;if(d>worst){worst=d;info=(f.className||f.tagName);}}
    return {worst,info,docOv:document.documentElement.scrollWidth>innerWidth+1};});
  results.push(m+': 内部スクロール超過='+r.worst+'px'+(r.worst>1?' ('+r.info+')':'')+(r.docOv?' ページはみ出しあり':''));
}
for(const r of results)log.info(r);
const bad=results.filter(r=>/超過=[1-9]/.test(r));
log.info(bad.length?('内部スクロールあり: '+bad.length+'モード'):'全モードで図の内部横スクロールなし（C1-06修正の実働確認）');
await ctx.close();await browser.close();
