// F4 §21 モデル説明書（15モデル×16項目=240）のアプリ内表示とチュートリアル、
//    R1-P2-04（古い状態記述）の再発チェック用に全説明書テキストを採取する
import {launch,newPage,DIST,SHOTS,makeLog,overflow,errorSummary} from './lib.mjs';
import {writeFileSync} from 'node:fs';
const log=makeLog('F4');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:1280,height:900});
page.setDefaultTimeout(60000);

await page.goto(DIST+'/dynamic/index.html',{waitUntil:'load'});
await page.waitForTimeout(3000);
await page.click('#manual-toggle');
await page.waitForTimeout(600);
const manualVisible=await page.evaluate(()=>!document.querySelector('#manual').hidden);
if(manualVisible)log.ok('「使い方と理論」で説明書セクションが開く');else log.fail('説明書セクションが開かない');
const modelIds=await page.evaluate(()=>[...document.querySelector('#manual-model').options].map(o=>({v:o.value,t:o.textContent.trim()})));
log.info('モデル選択肢: '+modelIds.length+'件 '+JSON.stringify(modelIds.map(m=>m.v)));
if(modelIds.length===15)log.ok('説明書のモデル選択肢は15件');else log.fail('モデル選択肢が15件でない');

const texts={};
let allCountsOk=true, allTutorialOk=true;
for(const m of modelIds){
  await page.selectOption('#manual-model',m.v);
  await page.waitForTimeout(350);
  const info=await page.evaluate(()=>{
    const box=document.querySelector('#model-manual');
    const details=[...box.querySelectorAll('details')];
    const tut=details.find(d=>/チュートリアル/.test(d.querySelector('summary')?.textContent||''));
    return {details:details.length, items:details.length-(tut?1:0), hasTutorial:!!tut,
      summaries:details.slice(0,3).map(d=>d.querySelector('summary')?.textContent.trim().slice(0,40)),
      text:box.textContent.replace(/\s+/g,' ').trim()};
  });
  texts[m.v]=info.text;
  if(info.items!==16){allCountsOk=false;log.fail(m.v+' の説明書項目が16でない: '+info.items+' (details '+info.details+')');}
  if(!info.hasTutorial){allTutorialOk=false;log.fail(m.v+' にチュートリアルがない');}
}
if(allCountsOk)log.ok('全15モデルの説明書が各16項目で開ける（合計240項目）');
if(allTutorialOk)log.ok('全15モデルに手順案内（チュートリアル）が付く');
writeFileSync(new URL('./manual-texts.json',import.meta.url),JSON.stringify(texts,null,1));
log.info('説明書テキスト採取: '+Object.keys(texts).length+'モデル、総文字数 '+Object.values(texts).reduce((a,t)=>a+t.length,0));

// チュートリアルを開いて中身が出るか（矩形モデル）
await page.selectOption('#manual-model','transient-rectangular');
await page.waitForTimeout(400);
await page.evaluate(()=>{const d=[...document.querySelectorAll('#model-manual details')].find(d=>/チュートリアル/.test(d.querySelector('summary')?.textContent||''));if(d)d.open=true;});
await page.waitForTimeout(400);
const tutBody=await page.evaluate(()=>{
  const d=[...document.querySelectorAll('#model-manual details')].find(d=>/チュートリアル/.test(d.querySelector('summary')?.textContent||''));
  return d?d.textContent.replace(/\s+/g,' ').trim():'';
});
log.info('チュートリアル本文（先頭）: '+tutBody.slice(0,150));
if(tutBody.length>150&&/触|操作|観察|確かめ/.test(tutBody))log.ok('チュートリアルを開くと手順（触る・観察・確かめる）が出る');else log.fail('チュートリアルの中身が出ない');
// 説明書の項目を1つ開く
await page.evaluate(()=>{const ds=[...document.querySelectorAll('#model-manual details')];const item=ds.find(d=>!/チュートリアル/.test(d.querySelector('summary')?.textContent||''));if(item)item.open=true;});
await page.waitForTimeout(400);
const itemBody=await page.evaluate(()=>{
  const ds=[...document.querySelectorAll('#model-manual details')];
  const item=ds.find(d=>d.open&&!/チュートリアル/.test(d.querySelector('summary')?.textContent||''));
  return item?item.textContent.replace(/\s+/g,' ').trim().slice(0,160):'';
});
log.info('説明書項目の本文: '+itemBody);
if(itemBody.length>60)log.ok('説明書の項目を開くと本文が表示される');else log.fail('説明書項目の本文が出ない');
const ov1=await overflow(page);
if(!ov1.bad)log.ok('ラボ＋説明書 1280px 横はみ出し 0');else log.fail('ラボ 1280px はみ出し: '+JSON.stringify(ov1));
await page.screenshot({path:SHOTS+'f4-manual-1280.png'});

// 375px ダーク：キャビティ説明書を開いて幅確認
const s2=await newPage(browser,{width:375,dark:true});
await s2.page.goto(DIST+'/dynamic/index.html',{waitUntil:'load'});
await s2.page.waitForTimeout(3000);
await s2.page.click('#manual-toggle');
await s2.page.waitForTimeout(500);
await s2.page.selectOption('#manual-model','natural-cavity');
await s2.page.waitForTimeout(400);
const cav=await s2.page.evaluate(()=>{
  const box=document.querySelector('#model-manual');
  const t=box.textContent.replace(/\s+/g,' ');
  return {details:box.querySelectorAll('details').length,
    hasScreenDefault:/1e-11/.test(t)&&/4000/.test(t), hasCore:/1e-10/.test(t),
    snippet:(t.match(/.{60}1e-11.{60}/)||[''])[0]};
});
log.info('キャビティ説明書: '+JSON.stringify(cav));
if(cav.hasScreenDefault)log.ok('キャビティ説明書は画面既定（1e-11／4000回）に言及する（R1-P2-04 の観点）');else log.obs('キャビティ説明書で画面既定の数値が見つからない');
const ov2=await overflow(s2.page);
if(!ov2.bad)log.ok('ラボ＋説明書 375px ダーク 横はみ出し 0');else log.fail('ラボ 375px はみ出し: '+JSON.stringify(ov2));
await s2.page.screenshot({path:SHOTS+'f4-manual-cavity-375-dark.png'});
errors.push(...s2.errors);
await s2.ctx.close();
errorSummary(log,errors,'F4');
await ctx.close();
await browser.close();
console.log('F4 DONE');
