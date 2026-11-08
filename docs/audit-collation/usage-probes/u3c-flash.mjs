// U3c 単語帳の確定検証（正しいセレクタ）
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U3c');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#glossary',{waitUntil:'networkidle'});
await page.waitForTimeout(900);
// ブックマークを1件付ける（行の☆）
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='☆');b?.click();});
await page.waitForTimeout(300);
const bmTerm=await page.evaluate(()=>{const star=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='★');if(!star)return null;const row=star.closest('li,article,div');return row?row.textContent.replace(/\s+/g,' ').slice(0,40):null;});
log.info('ブックマークした用語行: '+bmTerm);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='単語帳');b?.click();});
await page.waitForTimeout(800);
const face=()=>page.evaluate(()=>{const f=document.querySelector('.flash-face');return f?{cls:f.className,text:f.textContent.replace(/\s+/g,' ').slice(0,110)}:null;});
const stage=()=>page.evaluate(()=>document.querySelector('.flash-stage')?.textContent.replace(/\s+/g,' ').slice(0,60));
let f=await face();log.info('表面: '+JSON.stringify(f));
if(f&&/表/.test(await stage()))log.ok('単語帳カード表面が表示される（進捗 '+(await stage())+'）');
// めくる（裏返すボタン）
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='裏返す');b?.click();});
await page.waitForTimeout(600);
f=await face();log.info('裏面: '+JSON.stringify(f));
if(f&&/flash-back/.test(f.cls))log.ok('裏返すと裏面（説明）が表示される');
await page.screenshot({path:SHOTS+'u3c-flash-back-375.png'});
// 表に戻して次へ
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/表に/.test(b.textContent)||b.textContent.trim()==='裏返す');b?.click();});
await page.waitForTimeout(300);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/次へ/.test(b.textContent));b?.click();});
await page.waitForTimeout(400);
log.info('次へ後 stage: '+await stage());
// シャッフル：先頭カードが変わる＋並びが保存される
const before=(await face())?.text;
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/シャッフル/.test(b.textContent));b?.click();});
await page.waitForTimeout(500);
const after=(await face())?.text;
log.info('シャッフル前後の先頭: 「'+(before||'').slice(0,24)+'」→「'+(after||'').slice(0,24)+'」 stage='+(await stage()));
if(before!==after)log.ok('シャッフルでカード順が変わる');
// 裏から表示
const bfLabel=await page.evaluate(()=>{const l=[...document.querySelectorAll('.flash-check')].map(l=>l.textContent.trim());return l;});
log.info('flash-check ラベル: '+JSON.stringify(bfLabel));
await page.evaluate(()=>{const c=[...document.querySelectorAll('.flash-check input')].find(i=>/裏/.test(i.closest('label')?.textContent||''));c?.click();});
await page.waitForTimeout(500);
f=await face();log.info('裏から表示ON直後の面: '+JSON.stringify(f));
if(f&&/flash-back/.test(f.cls))log.ok('「最初から裏を表示」で現在のカードが即座に裏面になる');
// ソート五十音順
await page.selectOption('select[name=flash-sort]',{label:'五十音順'});
await page.waitForTimeout(500);
f=await face();log.info('五十音順の先頭面: '+JSON.stringify(f)+' stage='+(await stage()));
// 章フィルタ 第9章
await page.selectOption('select[name=flash-chapter]',{label:'第9章'});
await page.waitForTimeout(500);
log.info('第9章フィルタ stage: '+await stage());
// 状態の保存・復元：この状態でリロード
const preReload={stage:await stage(),face:(await face())?.text};
await page.reload({waitUntil:'networkidle'});
await page.waitForTimeout(1000);
const afterReload=await page.evaluate(()=>({flashBtn:[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='単語帳'),
  stage:document.querySelector('.flash-stage')?.textContent.replace(/\s+/g,' ').slice(0,60)||null,
  sort:document.querySelector('select[name=flash-sort]')?.value, ch:document.querySelector('select[name=flash-chapter]')?.value,
  scope:document.querySelector('select[name=flash-scope]')?.value}));
log.info('リロード直後: '+JSON.stringify(afterReload)+' （前: '+JSON.stringify(preReload)+'）');
if(!afterReload.stage){
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='単語帳');b?.click();});
  await page.waitForTimeout(700);
  const re={stage:await stage(),face:(await face())?.text,
    sort:await page.evaluate(()=>document.querySelector('select[name=flash-sort]')?.selectedOptions[0]?.textContent),
    ch:await page.evaluate(()=>document.querySelector('select[name=flash-chapter]')?.selectedOptions[0]?.textContent)};
  log.info('単語帳再入場後: '+JSON.stringify(re));
  if(re.stage===preReload.stage)log.ok('単語帳の位置・並び・絞り込みがリロード後も復元される');
  else log.obs('復元状態が異なる: 前='+preReload.stage+' 後='+re.stage);
}else{
  if(afterReload.stage===preReload.stage)log.ok('単語帳モード自体がリロードで復元される（位置も一致）');
  else log.obs('モードは復元、位置は相違: '+afterReload.stage);
}
// ブックマークのみデッキ（ブックマーク1件）
await page.selectOption('select[name=flash-chapter]',{label:'すべての章'});
await page.selectOption('select[name=flash-scope]',{label:'ブックマークのみ'});
await page.waitForTimeout(600);
log.info('ブックマークのみ stage: '+await stage()+' 面: '+JSON.stringify(await face()));
if(/1 \/ 1/.test(await stage()||''))log.ok('ブックマークのみデッキは1件になる');
// カード上の ★ を外す → 0件表示
await page.evaluate(()=>{const b=[...document.querySelectorAll('.flash-card button')].find(b=>b.textContent.trim()==='★');b?.click();});
await page.waitForTimeout(600);
const empty=await page.evaluate(()=>{const m=document.querySelector('main');return {stage:document.querySelector('.flash-stage')?.textContent.replace(/\s+/g,' ').slice(0,160)||'',
  text:m.textContent.replace(/\s+/g,' ').slice(0,400)};});
log.info('ブックマーク除去後: '+JSON.stringify(empty).slice(0,420));
if(/ブックマーク/.test(empty.stage+empty.text)&&(/ありませ|されてい|0件|付け/.test(empty.stage+empty.text)))log.ok('ブックマーク0件時の空表示が出る');
await page.screenshot({path:SHOTS+'u3c-bookmark-empty-375.png'});
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U3c DONE');
