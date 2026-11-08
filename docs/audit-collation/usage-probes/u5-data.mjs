// U5 保存と復元：書き出し→取り込み（現行形式・旧形式）、設定保持、オフライン再読込
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
import {writeFileSync} from 'node:fs';
const log=makeLog('U5');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#glossary',{waitUntil:'networkidle'});
await page.waitForTimeout(900);
// 状態を作る：ブックマーク1件＋単語帳ソート五十音順
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='☆');b?.click();});
await page.waitForTimeout(300);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='単語帳');b?.click();});
await page.waitForTimeout(700);
await page.selectOption('select[name=flash-sort]',{label:'五十音順'});
await page.waitForTimeout(400);
// 設定画面へ
await page.goto(DIST+'/index.html#settings',{waitUntil:'networkidle'});
await page.waitForTimeout(800);
// 書き出し（ダウンロードを捕捉）
const [download]=await Promise.all([
  page.waitForEvent('download',{timeout:6000}).catch(()=>null),
  page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/JSONを書き出す/.test(b.textContent));b?.click();}),
]);
await page.waitForTimeout(800);
let exported=null;
if(download){
  const path='/tmp/heat-usage/export.json';
  await download.saveAs(path);
  const {readFileSync}=await import('node:fs');
  exported=readFileSync(path,'utf8');
  log.info('書き出しはダウンロード形式: '+exported.length+' bytes');
}else{
  const shown=await page.evaluate(()=>{const ta=document.querySelector('textarea');return ta?ta.value:null;});
  if(shown){exported=shown;log.info('書き出しはテキスト表示形式: '+shown.length+' bytes');}
  else log.obs('書き出しの取得方法が不明（ダウンロードもテキスト表示もなし）');
}
if(exported){
  const j=JSON.parse(exported);
  log.info('書き出しJSONキー: '+Object.keys(j).slice(0,14).join(','));
  writeFileSync('/tmp/heat-usage/export-current.json',exported);
  // 旧形式を作る：flashcards 関連を除去
  const legacy=JSON.parse(exported);
  const strip=(o)=>{if(o&&typeof o==='object'){for(const k of Object.keys(o)){if(/flash/i.test(k))delete o[k];else strip(o[k]);}}};
  strip(legacy);
  writeFileSync('/tmp/heat-usage/export-legacy.json',JSON.stringify(legacy));
  log.info('旧形式JSON（flash系キーを除去）を作成');
  // 現行形式の取り込み：ファイルをセット
  await page.setInputFiles('#import-file','/tmp/heat-usage/export-current.json');
  await page.waitForTimeout(1200);
  let st=await page.evaluate(()=>document.body.textContent.replace(/\s+/g,' ').slice(0,300));
  log.info('現行形式取り込み後の画面: '+st.slice(0,200));
  // 取り込み確認モーダルがあれば承認
  const confirmBtn=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/取り込む|適用|はい/.test(b.textContent)&&b.offsetParent);if(b){b.click();return b.textContent.trim().slice(0,24);}return null;});
  if(confirmBtn){log.info('取り込み確認ボタン: '+confirmBtn);await page.waitForTimeout(1000);}
  // 旧形式の取り込み（C1-02 の回帰確認：単語帳設定が既定値に戻らないこと）
  await page.setInputFiles('#import-file','/tmp/heat-usage/export-legacy.json');
  await page.waitForTimeout(1200);
  const confirm2=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/取り込む|適用|はい/.test(b.textContent)&&b.offsetParent);if(b){b.click();return b.textContent.trim().slice(0,24);}return null;});
  if(confirm2)await page.waitForTimeout(1000);
  log.info('旧形式取り込み確認: '+confirm2);
  // 用語集へ戻って単語帳ソートが五十音順のままか
  await page.goto(DIST+'/index.html#glossary',{waitUntil:'networkidle'});
  await page.waitForTimeout(900);
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='単語帳');b?.click();});
  await page.waitForTimeout(700);
  const sortNow=await page.evaluate(()=>document.querySelector('select[name=flash-sort]')?.selectedOptions[0]?.textContent);
  const stars=await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='★').length);
  log.info('旧形式取り込み後：単語帳ソート='+sortNow);
  if(sortNow==='五十音順')log.ok('旧形式JSON取り込みでも単語帳設定が保持される（C1-02修正の実測確認）');
  else log.fail('旧形式取り込みで単語帳ソートが変わった: '+sortNow);
}
// テーマ設定の保持：ダークにしてリロード
await page.goto(DIST+'/index.html#settings',{waitUntil:'networkidle'});
await page.waitForTimeout(700);
await page.evaluate(()=>{const r=document.querySelector('input[name=theme][value=dark]');r?.click();});
await page.waitForTimeout(400);
await page.reload({waitUntil:'networkidle'});
await page.waitForTimeout(700);
const themeNow=await page.evaluate(()=>({checked:document.querySelector('input[name=theme]:checked')?.value,
  scheme:getComputedStyle(document.documentElement).colorScheme||document.documentElement.dataset.theme||''}));
log.info('テーマ保持: '+JSON.stringify(themeNow));
if(themeNow.checked==='dark')log.ok('テーマ設定（ダーク）がリロード後も保持される');
await page.screenshot({path:SHOTS+'u5-settings-dark-375.png'});
// オフライン：SW登録を待ってからネットワーク遮断して再読込
await page.goto(DIST+'/index.html#home',{waitUntil:'networkidle'});
await page.waitForTimeout(1500);
const swState=await page.evaluate(async()=>{const r=await navigator.serviceWorker?.getRegistration();return r?('active:'+!!r.active):'no-sw';});
log.info('SW状態: '+swState);
await ctx.setOffline(true);
await page.reload({waitUntil:'domcontentloaded'}).catch(e=>log.info('オフラインreload例外: '+e.message.slice(0,80)));
await page.waitForTimeout(1500);
const off=await page.evaluate(()=>({title:document.title,h:document.querySelector('h1,h2')?.textContent.trim().slice(0,40)||'',nav:!!document.querySelector('.nav-link')}));
log.info('オフライン再読込後: '+JSON.stringify(off));
if(off.nav)log.ok('オフライン再読込でもアプリ画面が描画される');
await page.screenshot({path:SHOTS+'u5-offline-375.png'});
await ctx.setOffline(false);
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U5 DONE');
