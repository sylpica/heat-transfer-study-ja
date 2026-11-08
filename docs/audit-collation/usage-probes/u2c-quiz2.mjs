// U2c 演習フロー確定版＋フィン問題のケース受け口ハンドオフ探索
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U2c');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#quiz',{waitUntil:'networkidle'});
await page.waitForTimeout(800);
await page.selectOption('select[name=count]',{index:0}); // 3問
await page.click('button[type=submit]');
await page.waitForTimeout(1100);
async function answerOne(tag){
  const q=await page.evaluate(()=>document.querySelector('.question-card')?.textContent.replace(/\s+/g,' ').slice(0,90));
  await page.click('label.answer-choice >> nth=0');
  await page.waitForTimeout(300);
  await page.click('.answer-submit');
  await page.waitForTimeout(800);
  const res=await page.evaluate(()=>{const c=document.querySelector('.question-card');
    const t=c?c.textContent.replace(/\s+/g,' '):'';
    return {verdict:(t.match(/正解|不正解/)||[])[0]||null, explLen:(t.match(/解説[\s\S]{0,400}/)||[''])[0].length,
      caseLinks:[...c.querySelectorAll('a')].filter(a=>/case=/.test(a.getAttribute('href')||'')).map(a=>a.getAttribute('href')),
      nextBtns:[...document.querySelectorAll('button')].map(b=>b.textContent.trim().slice(0,24)).filter(t=>/次|結果|終了/.test(t))};});
  log.info(tag+' Q: '+(q||'').slice(0,60)+' → '+JSON.stringify(res));
  return res;
}
let r=await answerOne('Q1');
if(r.verdict)log.ok('回答→判定（'+r.verdict+'）が表示される');else log.fail('判定が表示されない');
if(r.explLen>30)log.ok('解説が表示される（本文長 '+r.explLen+'）');else log.obs('解説の長さが短い: '+r.explLen);
await page.screenshot({path:SHOTS+'u2c-verdict-375.png'});
// 次へ進んで残り2問
for(let i=2;i<=3;i++){
  const moved=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/次の問題|次へ/.test(b.textContent));if(b){b.click();return true;}return false;});
  if(!moved){log.obs('「次の問題」ボタンが見つからない（結果画面か）');break;}
  await page.waitForTimeout(800);
  r=await answerOne('Q'+i);
}
const fin=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/結果を見る|終了/.test(b.textContent));if(b){b.click();return b.textContent.trim();}return null;});
if(fin){await page.waitForTimeout(900);
  const sum=await page.evaluate(()=>{const m=document.querySelector('main');return m?m.textContent.replace(/\s+/g,' ').slice(0,300):'';});
  log.info('結果画面: '+sum.slice(0,220));
  if(/正解|結果|スコア|問中/.test(sum))log.ok('演習の結果画面まで到達できる');
  await page.screenshot({path:SHOTS+'u2c-result-375.png'});
}
// ケース受け口探索：第4章（フィン）で問題を解き case= リンク出現を確認
await page.goto(DIST+'/index.html#quiz',{waitUntil:'networkidle'});
await page.waitForTimeout(800);
const chOpt=await page.evaluate(()=>{const s=document.querySelector('select[name=chapter]');return [...s.options].map((o,i)=>({i,t:o.textContent})).filter(o=>/第4章/.test(o.t));});
log.info('第4章option: '+JSON.stringify(chOpt));
if(chOpt.length){
  await page.selectOption('select[name=chapter]',{index:chOpt[0].i});
  await page.selectOption('select[name=count]',{index:2}); // すべて
  await page.click('button[type=submit]');
  await page.waitForTimeout(1100);
  let found=null,steps=0;
  while(steps<25&&!found){
    steps++;
    const pre=await page.evaluate(()=>{const c=document.querySelector('.question-card');if(!c)return null;
      return {links:[...c.querySelectorAll('a')].map(a=>a.getAttribute('href')).filter(h=>h&&/case=/.test(h))};});
    if(pre&&pre.links.length){found=pre.links;break;}
    // 答える
    const hasChoice=await page.evaluate(()=>!!document.querySelector('label.answer-choice'));
    if(!hasChoice)break;
    await page.click('label.answer-choice >> nth=0');
    await page.click('.answer-submit');
    await page.waitForTimeout(700);
    const post=await page.evaluate(()=>{const c=document.querySelector('.question-card');if(!c)return[];
      return [...c.querySelectorAll('a')].map(a=>a.getAttribute('href')).filter(h=>h&&/case=/.test(h));});
    if(post.length){found=post;break;}
    const moved=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/次の問題|次へ/.test(b.textContent));if(b){b.click();return true;}return false;});
    if(!moved)break;
    await page.waitForTimeout(700);
  }
  log.info('ケースリンク探索 steps='+steps+' found='+JSON.stringify(found));
  if(found){log.ok('問題からケース受け口リンク（'+found[0]+'）が現れる');
    const href=found[0];
    await page.evaluate((h)=>{location.hash=h;},href.replace(/^#/,'#'));
    await page.waitForTimeout(1300);
    const now=await page.evaluate(()=>({hash:location.hash,h:[...document.querySelectorAll('h2,h3')].map(x=>x.textContent.trim().slice(0,40)).slice(0,4),
      pre:[...document.querySelectorAll('input')].slice(0,4).map(i=>i.name+'='+i.value)}));
    log.info('ケース着地: '+JSON.stringify(now));
    await page.screenshot({path:SHOTS+'u2c-case-375.png'});
  } else log.obs('第4章の問題走査'+steps+'問で case= リンク未出現');
}
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U2c DONE');
