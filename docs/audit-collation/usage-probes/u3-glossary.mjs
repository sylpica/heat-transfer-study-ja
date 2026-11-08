// U3 用語集：行展開、単語帳（めくる/シャッフル/裏から/ソート/絞り込み/位置復元）、ブックマーク
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U3');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#glossary',{waitUntil:'networkidle'});
await page.waitForTimeout(1000);
// 行展開
const rows=await page.evaluate(()=>document.querySelectorAll('.glossary-row, .term-row, [data-term-row]').length);
log.info('用語行数(初期表示)='+rows);
const exp=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='詳しく見る');if(b){b.click();return true;}return false;});
await page.waitForTimeout(600);
const expState=await page.evaluate(()=>({expanded:[...document.querySelectorAll('[aria-expanded="true"]')].length,
  detail:document.querySelector('.term-detail, .glossary-detail')?.textContent.replace(/\s+/g,' ').slice(0,120)||''}));
log.info('行展開後: '+JSON.stringify(expState));
if(exp&&expState.expanded>0)log.ok('用語行を展開すると詳細が表示される');
// ブックマークを付ける（先頭行の ☆）
const bm=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='☆');if(b){b.click();return true;}return false;});
await page.waitForTimeout(400);
const bmState=await page.evaluate(()=>({stars:[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='★').length}));
log.info('ブックマーク後 ★数='+bmState.stars);
if(bm&&bmState.stars===1)log.ok('用語ブックマークを付けられる（☆→★）');
// 単語帳モードへ
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='単語帳');b?.click();});
await page.waitForTimeout(900);
let card=await page.evaluate(()=>{
  const c=document.querySelector('.flashcard, .fc-card, [data-flashcard]');
  const ctrls=[...document.querySelectorAll('main button, main select')].map(e=>e.textContent.trim().slice(0,26)).filter(Boolean);
  return {cardText:c?c.textContent.replace(/\s+/g,' ').slice(0,120):null, ctrls:ctrls.slice(0,26),
    progress:[...document.querySelectorAll('main *')].map(e=>e.textContent).find(t=>/^\s*\d+\s*\/\s*\d+\s*$/.test(t||''))||''};
});
log.info('単語帳モード: '+JSON.stringify(card));
await page.screenshot({path:SHOTS+'u3-flashcard-front-375.png'});
if(card.cardText)log.ok('単語帳モードでカードが表示される');else log.fail('単語帳カードが表示されない');
// めくる（カードクリック）
const frontText=card.cardText;
await page.evaluate(()=>{const c=document.querySelector('.flashcard, .fc-card, [data-flashcard]');c?.click();});
await page.waitForTimeout(700);
card=await page.evaluate(()=>{const c=document.querySelector('.flashcard, .fc-card, [data-flashcard]');return c?c.textContent.replace(/\s+/g,' ').slice(0,120):null;});
log.info('めくり後: '+card);
if(card&&card!==frontText)log.ok('カードをタップすると裏面（説明）が表示される');else log.obs('めくり後の変化を確認できず');
// 次へ進む
const nxt=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/次/.test(b.textContent)&&b.textContent.length<20);if(b){b.click();return b.textContent.trim();}return null;});
await page.waitForTimeout(500);
const pos2=await page.evaluate(()=>{const c=document.querySelector('.flashcard, .fc-card, [data-flashcard]');return c?c.textContent.replace(/\s+/g,' ').slice(0,60):null;});
log.info('次へ('+nxt+')後カード: '+pos2);
// シャッフル
const shufBtn=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/シャッフル/.test(b.textContent));if(b){b.click();return b.textContent.trim();}return null;});
await page.waitForTimeout(500);
const afterShuf=await page.evaluate(()=>{const c=document.querySelector('.flashcard, .fc-card, [data-flashcard]');return c?c.textContent.replace(/\s+/g,' ').slice(0,60):null;});
log.info('シャッフル('+shufBtn+')後先頭カード: '+afterShuf);
// 裏から表示トグル
const backFirst=await page.evaluate(()=>{
  const el=[...document.querySelectorAll('input[type=checkbox],button')].find(e=>/裏から|最初から裏/.test(e.textContent+(e.closest('label')?.textContent||'')));
  if(el){el.click();return (el.textContent||el.closest('label')?.textContent||'').trim().slice(0,30);}return null;});
await page.waitForTimeout(500);
const backState=await page.evaluate(()=>{const c=document.querySelector('.flashcard, .fc-card, [data-flashcard]');return c?c.textContent.replace(/\s+/g,' ').slice(0,90):null;});
log.info('裏から表示('+backFirst+')後: '+backState);
await page.screenshot({path:SHOTS+'u3-flashcard-back-375.png'});
// ソート変更
const sorts=await page.evaluate(()=>{const s=[...document.querySelectorAll('select')].map(s=>({name:s.name,opts:[...s.options].map(o=>o.textContent)}));return s;});
log.info('単語帳select: '+JSON.stringify(sorts));
const sortSel=sorts.find(s=>s.opts.some(o=>/五十音|章/.test(o)));
if(sortSel){
  const target=sortSel.opts.find(o=>/五十音/.test(o));
  await page.selectOption('select[name="'+sortSel.name+'"]',{label:target}).catch(async()=>{await page.evaluate((n)=>{const s=document.querySelector('select[name="'+n+'"]');},sortSel.name);});
  await page.waitForTimeout(500);
  const c=await page.evaluate(()=>{const c=document.querySelector('.flashcard, .fc-card, [data-flashcard]');return c?c.textContent.replace(/\s+/g,' ').slice(0,60):null;});
  log.info('五十音順ソート後先頭: '+c);
}
// 絞り込み（章フィルタ）
const chSel=sorts.find(s=>s.opts.some(o=>/第1章|第11章/.test(o)));
if(chSel){
  await page.selectOption('select[name="'+chSel.name+'"]',{index:1}).catch(e=>log.info('章フィルタ失敗 '+e.message));
  await page.waitForTimeout(500);
  const prog=await page.evaluate(()=>[...document.querySelectorAll('main *')].map(e=>e.textContent).find(t=>/\d+\s*\/\s*\d+/.test(t||'')&&t.length<20)||'');
  log.info('章フィルタ後 進捗表示: '+prog);
}
// 位置の保存・復元：現在のカードを記録してリロード
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/次/.test(b.textContent)&&b.textContent.length<20);b?.click();});
await page.waitForTimeout(400);
const beforeReload=await page.evaluate(()=>{const c=document.querySelector('.flashcard, .fc-card, [data-flashcard]');return c?c.textContent.replace(/\s+/g,' ').slice(0,60):null;});
await page.reload({waitUntil:'networkidle'});
await page.waitForTimeout(1000);
const modeAfter=await page.evaluate(()=>({hash:location.hash,card:!!document.querySelector('.flashcard, .fc-card, [data-flashcard]'),
  cardText:document.querySelector('.flashcard, .fc-card, [data-flashcard]')?.textContent.replace(/\s+/g,' ').slice(0,60)||null}));
log.info('リロード後: '+JSON.stringify(modeAfter)+' (リロード前カード: '+beforeReload+')');
if(modeAfter.cardText&&beforeReload&&modeAfter.cardText===beforeReload)log.ok('単語帳の位置とモードがリロードで復元される');
else if(modeAfter.card)log.obs('モードは復元されたが位置は要確認（前:'+beforeReload+' / 後:'+modeAfter.cardText+'）');
else log.obs('リロード後に単語帳モードへは自動復帰しない（仕様確認）');
// ブックマークのみデッキ
await page.evaluate(()=>{if(!document.querySelector('.flashcard, .fc-card, [data-flashcard]')){const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='単語帳');b?.click();}});
await page.waitForTimeout(700);
const bmOnly=await page.evaluate(()=>{
  const el=[...document.querySelectorAll('input[type=checkbox],button')].find(e=>/ブックマークのみ|ブックマークだけ/.test(e.textContent+(e.closest('label')?.textContent||'')));
  if(el){el.click();return (el.textContent||'').trim().slice(0,30);}return null;});
await page.waitForTimeout(600);
const deckState=await page.evaluate(()=>({card:document.querySelector('.flashcard, .fc-card, [data-flashcard]')?.textContent.replace(/\s+/g,' ').slice(0,80)||null,
  prog:[...document.querySelectorAll('main *')].map(e=>e.textContent).find(t=>/\d+\s*\/\s*\d+/.test(t||'')&&t.length<20)||''}));
log.info('ブックマークのみ('+bmOnly+'): '+JSON.stringify(deckState));
if(deckState.prog&&/\/\s*1/.test(deckState.prog))log.ok('ブックマークのみデッキは1件（付けた用語だけ）になる');
// ブックマークを外す→0件表示
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='★');b?.click();});
await page.waitForTimeout(600);
const emptyState=await page.evaluate(()=>({body:document.querySelector('main').textContent.replace(/\s+/g,' ').slice(0,300)}));
log.info('ブックマーク0件時: '+emptyState.body.slice(0,200));
if(/ブックマーク.*(ありませ|0|ない)/.test(emptyState.body))log.ok('ブックマーク0件時の空表示が出る');
await page.screenshot({path:SHOTS+'u3-bookmark-empty-375.png'});
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U3 DONE');
