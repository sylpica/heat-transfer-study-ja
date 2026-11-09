// W1b 再測定：式(8.13b) の描画構造・例題8.3 の正しい段落・404 の URL 特定
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('W1b');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);
const failedUrls=[];
page.on('response',r=>{if(r.status()===404)failedUrls.push(r.url());});
page.on('requestfailed',r=>failedUrls.push('REQFAIL '+r.url()));

await page.goto(DIST+'/index.html#reader/8.3',{waitUntil:'load'});
await page.waitForFunction(()=>document.querySelectorAll('.formula-block').length>0,null,{timeout:60000}).catch(()=>{});
await page.waitForTimeout(900);

// (a) 式(8.13b) の描画構造
const loc=page.locator('.formula-block').filter({has:page.getByText('式（8.13b）',{exact:true})}).first();
const struct=await loc.evaluate(el=>{
  const expr=el.querySelector('.formula-expression, .expression, [class*=expression]')||el;
  return {text:el.textContent.replace(/\s+/g,' ').trim(), html:expr.innerHTML.slice(0,1200)};
});
log.info('8.13b text: '+struct.text.slice(0,160));
log.info('8.13b html: '+struct.html);
const t=struct.text;
if(t.includes('0.387·RaL')&&t.includes('/[1 + (0.492/Pr)')&&t.includes(']8/27')&&!t.includes('[0.387'))log.ok('C3-S01 描画構造：8/27乗は [1 + (0.492/Pr)^(9/16)] のみに付き、分子は括弧外（修正形）');
else log.fail('C3-S01 描画構造が修正形と一致しない');
await loc.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
await loc.screenshot({path:SHOTS+'w1b-eq813b-375.png'});

// (b) 例題8.3 の本文段落（δ/L = 3.936 を含むもの）
const exLoc=page.locator('#reader-article p').filter({hasText:'δ/L = 3.936'}).first();
const n=await exLoc.count();
log.info('例題8.3 本文段落の検出数: '+n);
if(n){
  const ex=(await exLoc.textContent()).replace(/\s+/g,' ').trim();
  log.info('例題8.3 本文: '+ex.slice(0,700));
  const MAC='\u0304';
  if(ex.includes('(RaL/Pr)^(−1/4)'))log.ok('C3-S05 例題8.3 に (RaL/Pr)^(−1/4) が表示'); else log.fail('C3-S05 (RaL/Pr) 形なし');
  if(ex.includes('(RaL·Pr)^(−1/4)'))log.fail('C3-S05 旧形 (RaL·Pr) が残っている');
  if(ex.includes('この差の原因は未確定である'))log.ok('C3-S07 新訳注（原因は未確定）が表示'); else log.fail('C3-S07 新訳注なし');
  if(ex.includes('中間値の丸めで約1%異なる'))log.fail('C3-S07 旧訳注（丸め断定）が残っている');
  if(ex.includes('平均の h'+MAC+'、q'+MAC))log.ok('C3-S06 問題文に「平均の h̄、q̄」が表示'); else log.fail('C3-S06 問題文の h̄/q̄ なし');
  if(ex.includes('Nu'+MAC+'L = 0.678'))log.ok('C3-S06 解に NūL = 0.678 が表示'); else log.fail('C3-S06 解の NūL なし');
  if(ex.includes('h'+MAC+' = 61.25(0.02623)/0.40')&&ex.includes('q'+MAC+' = h'+MAC+'ΔT'))log.ok('C3-S06 解に h̄・q̄ の上線が表示'); else log.fail('C3-S06 解の h̄/q̄ なし');
  await exLoc.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  await exLoc.screenshot({path:SHOTS+'w1b-example83-375.png'});
}else log.fail('例題8.3 本文段落が特定できない');

// (c) 404 の URL
await page.waitForTimeout(600);
log.info('404 URL: '+JSON.stringify(failedUrls));
log.info('errors(pageerror含む): '+JSON.stringify(errors));
await ctx.close();
await browser.close();
console.log('W1b DONE');
