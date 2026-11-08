// U2e ケース受け口ハンドオフ探索（第4章フィン問題）＋結果画面
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U2e');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#quiz',{waitUntil:'networkidle'});
await page.waitForTimeout(900);
const chIdx=await page.evaluate(()=>{const s=document.querySelector('select[name=chapter]');const o=[...s.options].findIndex(o=>/第4章/.test(o.textContent));return o;});
await page.selectOption('select[name=chapter]',{index:chIdx});
await page.selectOption('select[name=count]',{index:2});
await page.click('button[type=submit]');
await page.waitForTimeout(1100);
async function scanCase(){return page.evaluate(()=>[...document.querySelectorAll('main a')].map(a=>a.getAttribute('href')).filter(h=>h&&/case=/.test(h)));}
let found=null,steps=0;
while(steps<30){
  steps++;
  let links=await scanCase();
  if(links.length){found=links[0];log.info('回答前にケースリンク出現 step='+steps);break;}
  const has=await page.evaluate(()=>!!document.querySelector('label.answer-choice'));
  if(!has){log.info('選択肢なしで停止 step='+steps);break;}
  await page.click('label.answer-choice >> nth=0');
  await page.click('.answer-submit');
  await page.waitForTimeout(650);
  links=await scanCase();
  if(links.length){found=links[0];log.info('回答後にケースリンク出現 step='+steps);break;}
  const moved=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/次の問題へ/.test(b.textContent));if(b){b.click();return true;}return false;});
  if(!moved){log.info('次へボタンなしで停止 step='+steps);break;}
  await page.waitForTimeout(650);
}
log.info('case探索結果 steps='+steps+' found='+found);
if(found){
  log.ok('問題画面にケース受け口リンクが現れる: '+found);
  await page.evaluate((h)=>{location.hash=h;},found);
  await page.waitForTimeout(1400);
  const now=await page.evaluate(()=>({hash:location.hash,
    h:[...document.querySelectorAll('h2,h3')].map(x=>x.textContent.trim().slice(0,40)).slice(0,4),
    inputs:[...document.querySelectorAll('input[name]')].slice(0,6).map(i=>i.name+'='+i.value),
    body:document.body.textContent.replace(/\s+/g,' ').slice(0,200)}));
  log.info('ケース着地: '+JSON.stringify(now));
  await page.screenshot({path:SHOTS+'u2e-case-landing-375.png'});
}
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U2e DONE');
