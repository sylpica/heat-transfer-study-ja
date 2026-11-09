// W2 図 alt：§5.6／§10.1／§11.10 の img alt を実 DOM で確認（C3-A01〜A03）
import {launch,newPage,DIST,SHOTS,makeLog,overflow} from './lib.mjs';
const log=makeLog('W2');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);

async function checkAlt(sec,checks,name){
  await page.goto(DIST+'/index.html#reader/'+sec,{waitUntil:'load'});
  const img=page.locator('figure.lesson-diagram img').first();
  await img.waitFor({state:'attached',timeout:60000}).catch(()=>{});
  if(!await img.count()){log.fail('§'+sec+' の lesson-diagram img が見つからない');return;}
  await img.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const i=document.querySelector('figure.lesson-diagram img');return i&&i.complete&&i.naturalWidth>0;},null,{timeout:30000}).catch(()=>{});
  await page.waitForTimeout(300);
  const alt=await img.getAttribute('alt');
  log.info('§'+sec+' alt 先頭: '+(alt||'').slice(0,120));
  for(const [label,test] of checks){
    if(test(alt))log.ok('§'+sec+' '+label); else log.fail('§'+sec+' '+label+' — alt: '+(alt||'').slice(0,200));
  }
  await img.screenshot({path:SHOTS+name+'.png'});
  const ov=await overflow(page);
  if(!ov.bad)log.ok('§'+sec+' 375px 横はみ出し 0'); else log.fail('§'+sec+' 横はみ出し: '+JSON.stringify(ov));
}

await checkAlt('5.6',[
  ['C3-A01 alt に「t>0」が含まれ、リテラル &gt; がない',a=>a&&a.includes('t>0')&&!a.includes('&gt;')&&!a.includes('t&gt;0')],
],'w2-alt56-375');
await checkAlt('10.1',[
  ['C3-A02 alt に「四つの棒」が含まれる',a=>a&&a.includes('四つの棒は同じ線形尺度に従い')],
  ['C3-A02 旧表現「三つの棒」がない',a=>a&&!a.includes('三つの棒')],
],'w2-alt101-375');
await checkAlt('11.10',[
  ['C3-A03 alt に「イプシロンABをボルツマン定数kBで割った値が56.1ケルビン」が含まれる',a=>a&&a.includes('イプシロンABをボルツマン定数kBで割った値が56.1ケルビン')],
  ['C3-A03 旧表現「イプシロン56.1ケルビン」がない',a=>a&&!a.includes('イプシロン56.1ケルビン')],
],'w2-alt1110-375');

log.info('W2 errors: '+JSON.stringify(errors));
if(!errors.some(e=>e.startsWith('pageerror')))log.ok('W2 セッション pageerror 0');
else log.fail('W2 pageerror: '+errors.join(' | '));
await ctx.close();
await browser.close();
console.log('W2 DONE');
