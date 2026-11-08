// U2 解く・検索：演習開始→回答→解説、ケース受け口遷移、本文検索・章末問題検索
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U2');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#quiz',{waitUntil:'networkidle'});
await page.waitForTimeout(900);
// 条件を付けて開始（第5章・3問）
await page.selectOption('select[name=chapter]',{index:5}).catch(e=>log.info('chapter select失敗 '+e.message));
await page.selectOption('select[name=count]',{index:0}).catch(()=>{});
await page.click('button[type=submit]');
await page.waitForTimeout(1200);
let st=await page.evaluate(()=>({
  q:document.querySelector('.question-text, .quiz-question, main h3')?.textContent.trim().slice(0,80),
  choices:[...document.querySelectorAll('button')].map(b=>b.textContent.trim().slice(0,40)).filter(t=>t.length>2).slice(0,14),
  progress:[...document.querySelectorAll('*')].map(e=>e.textContent).find(t=>/1\s*\/\s*3|問目/.test(t||''))?.slice(0,30)}));
log.info('演習開始後: '+JSON.stringify(st));
await page.screenshot({path:SHOTS+'u2-quiz-start-375.png'});
// 選択肢を1つ選んで回答
const answered=await page.evaluate(()=>{
  const btns=[...document.querySelectorAll('button')].filter(b=>/^[A-DＡ-Ｄ]|^選択肢|^\d+\./.test(b.textContent.trim())||b.classList.contains('choice'));
  const pool=btns.length?btns:[...document.querySelectorAll('.choice-button, [data-choice]')];
  if(!pool.length)return 'no-choice-buttons';
  pool[0].click();return pool[0].textContent.trim().slice(0,40);
});
log.info('選択肢クリック: '+answered);
await page.waitForTimeout(600);
// 回答ボタン or 即時判定か
const afterAns=await page.evaluate(()=>({
  judge:[...document.querySelectorAll('main *')].map(e=>e.textContent).find(t=>/正解|不正解|正しい|誤り/.test(t||'')&&t.length<60)?.slice(0,60),
  btns:[...document.querySelectorAll('button')].map(b=>b.textContent.trim().slice(0,30)).filter(t=>/回答|判定|次へ|解説/.test(t))}));
log.info('回答後: '+JSON.stringify(afterAns));
if(!afterAns.judge){
  const sub=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/回答する|判定/.test(b.textContent));if(b){b.click();return b.textContent.trim();}return null;});
  log.info('回答ボタン: '+sub);await page.waitForTimeout(700);
  const j2=await page.evaluate(()=>[...document.querySelectorAll('main *')].map(e=>e.textContent).find(t=>/正解|不正解/.test(t||'')&&t.length<80)?.slice(0,80));
  log.info('判定表示: '+j2);
  if(j2)log.ok('演習で回答→判定が表示される');else log.obs('判定表示を確認できず');
}else log.ok('演習で回答→判定が表示される');
// 解説の表示
const expl=await page.evaluate(()=>{const t=document.body.textContent.replace(/\s+/g,' ');const i=t.indexOf('解説');return i>=0?t.slice(i,i+140):'解説なし';});
log.info('解説: '+expl.slice(0,140));
if(/解説/.test(expl)&&expl.length>20)log.ok('解説が表示される');
await page.screenshot({path:SHOTS+'u2-quiz-explanation-375.png'});
// 次の問題へ進み、ケース連携リンク（シミュレーターへ）を探す
const caseLink=await page.evaluate(()=>{
  const as=[...document.querySelectorAll('a,button')].filter(e=>/シミュレーター|実験室|モデルで/.test(e.textContent));
  return as.map(a=>({text:a.textContent.trim().slice(0,44),href:a.getAttribute('href')})).slice(0,5);
});
log.info('問題画面のケース連携候補: '+JSON.stringify(caseLink));

// 節→シミュレーター連携：§2.3（熱抵抗）本文のケース導線
await page.goto(DIST+'/index.html#reader/2.3',{waitUntil:'networkidle'});
await page.waitForTimeout(1100);
const secCase=await page.evaluate(()=>{
  const as=[...document.querySelectorAll('article a, article button')].filter(e=>/シミュレーター|ケース|計算/.test(e.textContent));
  return as.map(a=>({text:a.textContent.trim().slice(0,44),href:a.getAttribute('href')})).slice(0,8);
});
log.info('§2.3本文の連携候補: '+JSON.stringify(secCase));
const goCase=await page.evaluate(()=>{
  const a=[...document.querySelectorAll('article a')].find(a=>/simulator|lab/.test(a.getAttribute('href')||'')&&/case=/.test(a.getAttribute('href')||''));
  if(a){const h=a.getAttribute('href');a.click();return h;}
  const b=[...document.querySelectorAll('article a')].find(a=>/simulator/.test(a.getAttribute('href')||''));
  if(b){const h=b.getAttribute('href');b.click();return h;}
  return null;
});
if(goCase){await page.waitForTimeout(1200);
  const now=await page.evaluate(()=>({hash:location.hash,url:location.href.slice(-60),h:[...document.querySelectorAll('h2,h3')].map(x=>x.textContent.trim().slice(0,36)).slice(0,4)}));
  log.info('ケース遷移先: '+JSON.stringify(now));
  log.ok('節からシミュレーター受け口へ遷移した');
  await page.screenshot({path:SHOTS+'u2-case-landing-375.png'});
}else log.obs('節本文から case= 付きシミュレーター導線が見つからない');

// 検索：本文検索
await page.goto(DIST+'/index.html#search',{waitUntil:'networkidle'});
await page.waitForTimeout(700);
await page.fill('#search-query','熱抵抗');
await page.click('button[type=submit]');
await page.waitForTimeout(1300);
let sr=await page.evaluate(()=>({
  count:document.querySelectorAll('.search-result, .result-card, [data-result]').length,
  items:[...document.querySelectorAll('main a, main button')].filter(e=>/熱抵抗/.test(e.textContent)).slice(0,5).map(e=>e.textContent.trim().slice(0,44)),
  head:[...document.querySelectorAll('h2,h3')].map(x=>x.textContent.trim().slice(0,36)).slice(0,5)}));
log.info('本文検索「熱抵抗」: '+JSON.stringify(sr));
if(sr.items.length)log.ok('本文検索で結果が表示される');
// 結果をクリックして到達
const reach=await page.evaluate(()=>{
  const a=[...document.querySelectorAll('main a, main button')].find(e=>/熱抵抗/.test(e.textContent)&&e.textContent.length<80);
  if(a){a.click();return a.textContent.trim().slice(0,40);}return null;});
if(reach){await page.waitForTimeout(1100);
  const now=await page.evaluate(()=>({hash:location.hash,h:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim().slice(0,30)).slice(0,3)}));
  log.info('検索結果クリック→ '+JSON.stringify(now));
  if(/#reader|#glossary/.test(now.hash))log.ok('検索結果から該当箇所へ到達できる');else log.obs('到達先: '+now.hash);
}
// 章末問題検索：種別=章末問題 で「木星」
await page.goto(DIST+'/index.html#search',{waitUntil:'networkidle'});
await page.waitForTimeout(700);
const kinds=await page.evaluate(()=>{const s=document.querySelector('select[name=kind]');return s?[...s.options].map(o=>({v:o.value,t:o.textContent})):[];});
log.info('検索種別: '+JSON.stringify(kinds));
const probKind=kinds.find(k=>/章末問題/.test(k.t));
if(probKind){
  await page.selectOption('select[name=kind]',probKind.v);
  await page.fill('#search-query','木星の大気');
  await page.click('button[type=submit]');
  await page.waitForTimeout(1500);
  sr=await page.evaluate(()=>({body:document.body.textContent.replace(/\s+/g,' ').slice(0,400),
    items:[...document.querySelectorAll('main a, main button, main li')].filter(e=>/木星|11\.3/.test(e.textContent)).slice(0,4).map(e=>e.textContent.trim().slice(0,60))}));
  log.info('章末問題検索「木星の大気」: '+JSON.stringify(sr).slice(0,500));
  if(/11\.3|木星/.test(JSON.stringify(sr)))log.ok('章末問題検索で第11章問題11.3に到達できる');else log.obs('章末問題検索の結果を要確認');
  const hit=await page.evaluate(()=>{const a=[...document.querySelectorAll('main a, main button')].find(e=>/木星|11\.3/.test(e.textContent));if(a){a.click();return true;}return false;});
  if(hit){await page.waitForTimeout(1300);
    const now=await page.evaluate(()=>({hash:location.hash,bodyHas:/11\.3/.test(document.body.textContent)}));
    log.info('章末問題ヒット遷移→ '+JSON.stringify(now));
  }
  await page.screenshot({path:SHOTS+'u2-search-problem-375.png'});
}
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U2 DONE');
