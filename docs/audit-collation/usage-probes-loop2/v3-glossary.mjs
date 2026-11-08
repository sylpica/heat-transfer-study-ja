// V3 用語集：C2-TERM-01（brief=meaning 重複解消）の実働確認＋単語帳操作一式
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
import {readFileSync} from 'node:fs';
const log=makeLog('V3');
const glossary=JSON.parse(readFileSync(new URL('../../../data/glossary.json',import.meta.url),'utf8'));
const byId=id=>glossary.find(t=>t.id===id);
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(180000);
const countOcc=(hay,needle)=>{let n=0,i=0;while((i=hay.indexOf(needle,i))>=0){n++;i+=needle.length;}return n;};

// --- 行展開：brief=meaning 完全一致語（フィン効率） ---
await page.goto(DIST+'/index.html#term-fin-efficiency',{waitUntil:'load'});
await page.waitForSelector('#term-fin-efficiency .term-toggle',{timeout:90000});
await page.evaluate(()=>{document.querySelector('#term-fin-efficiency .term-toggle')?.click();});
await page.waitForTimeout(1200);
const fin=byId('fin-efficiency');
const rowFin=await page.evaluate(()=>{
  const row=document.querySelector('#term-fin-efficiency');
  const body=row.querySelector('.term-body');
  return {rowText:row.textContent.replace(/\s+/g,' ').trim(),
          dupParas:body?[...body.querySelectorAll(':scope > p')].filter(p=>p.textContent.trim().length>0).map(p=>p.textContent.trim()):[]};
});
const finOcc=countOcc(rowFin.rowText,fin.brief);
log.info('フィン効率 行テキスト内の定義文出現回数: '+finOcc+' / body段落: '+JSON.stringify(rowFin.dupParas.map(s=>s.slice(0,40))));
if(finOcc===1)log.ok('brief=meaning 語（フィン効率）：行展開で定義文はちょうど1回だけ表示');
else log.fail('フィン効率で定義文が '+finOcc+' 回出現');
await page.locator('#term-fin-efficiency').screenshot({path:SHOTS+'v3-term-fin-efficiency-375.png'});

// --- 行展開：meaning が brief で始まる語（熱） ---
await page.goto(DIST+'/index.html#term-heat',{waitUntil:'load'});
await page.waitForSelector('#term-heat .term-toggle',{timeout:90000});
await page.evaluate(()=>{document.querySelector('#term-heat .term-toggle')?.click();});
await page.waitForTimeout(1200);
const heat=byId('heat');
const rowHeat=await page.evaluate(()=>{
  const row=document.querySelector('#term-heat');
  return {rowText:row.textContent.replace(/\s+/g,' ').trim()};
});
const heatOcc=countOcc(rowHeat.rowText,heat.brief);
const hasRest=rowHeat.rowText.includes('熱は物体に蓄えられた物質ではなく');
log.info('熱 行テキスト内の brief 出現回数: '+heatOcc+' / 続き文の表示: '+hasRest);
if(heatOcc===1&&hasRest)log.ok('前方一致語（熱）：brief は1回だけ＋続き文が表示される');
else log.fail('熱の表示が想定と異なる occ='+heatOcc+' rest='+hasRest);
await page.locator('#term-heat').screenshot({path:SHOTS+'v3-term-heat-375.png'});

// --- ブックマーク2件 → 単語帳（ブックマークのみデッキ） ---
for(const id of ['fin-efficiency','heat']){
  const starred=await page.evaluate((i)=>{
    const row=document.querySelector('#term-'+i);
    const b=row?[...row.querySelectorAll('button')].find(x=>/☆|★/.test(x.textContent)):null;
    if(!b)return 'no-button';
    if(b.textContent.includes('★'))return 'already';
    b.click();return 'clicked';
  },id);
  log.info('ブックマーク '+id+': '+starred);
  await page.waitForTimeout(400);
}
// 用語集画面へ戻り単語帳モード
await page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
await page.waitForTimeout(1500);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='単語帳');b?.click();});
await page.waitForTimeout(1200);
await page.evaluate(()=>{const s=document.querySelector('select[name=flash-scope]');if(s){s.value=[...s.options].find(o=>/ブックマーク/.test(o.textContent))?.value??s.value;s.dispatchEvent(new Event('change',{bubbles:true}));}});
await page.waitForTimeout(1000);
const stage1=await page.evaluate(()=>document.querySelector('.flash-stage')?.textContent.replace(/\s+/g,' ').trim());
log.info('ブックマークのみデッキ進捗: '+stage1);
// カードをめくる
await page.evaluate(()=>{document.querySelector('.flash-face')?.click();});
await page.waitForTimeout(900);
const back1=await page.evaluate(()=>{
  const f=document.querySelector('.flash-face');
  const scroll=document.querySelector('.flash-scroll');
  return {cls:f?.className||'', text:(scroll||f)?.textContent.replace(/\s+/g,' ').trim()||''};
});
log.info('裏面1: cls='+back1.cls+' text='+back1.text.slice(0,110));
const back1Brief=[fin.brief,heat.brief].find(b=>back1.text.includes(b));
const back1Occ=back1Brief?countOcc(back1.text,back1Brief):0;
if(/flash-back/.test(back1.cls)&&back1Occ===1)log.ok('単語帳裏面でも定義文はちょうど1回（'+(back1Brief===fin.brief?'フィン効率':'熱')+'）');
else log.fail('裏面の重複確認が想定と異なる: occ='+back1Occ+' cls='+back1.cls);
await page.screenshot({path:SHOTS+'v3-flash-back-375.png'});
// 次のカードへ
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/次へ|次の/.test(b.textContent));b?.click();});
await page.waitForTimeout(900);
const stage2=await page.evaluate(()=>document.querySelector('.flash-stage')?.textContent.replace(/\s+/g,' ').trim());
log.info('次へ後の進捗: '+stage2);
await page.evaluate(()=>{document.querySelector('.flash-face')?.click();});
await page.waitForTimeout(900);
const back2=await page.evaluate(()=>{const scroll=document.querySelector('.flash-scroll');return (scroll?.textContent||'').replace(/\s+/g,' ').trim();});
const otherBrief=back1Brief===fin.brief?heat.brief:fin.brief;
const back2Occ=countOcc(back2,otherBrief);
log.info('裏面2 occ: '+back2Occ+' text='+back2.slice(0,80));
if(back2Occ===1)log.ok('もう一方のカード裏面でも定義文は1回だけ');
else log.fail('裏面2の出現回数: '+back2Occ);
// 操作系：裏から表示トグル、ソート、リロード復元
await page.evaluate(()=>{const c=document.querySelector('input[name=flash-back-first]');if(c&&!c.checked)c.click();});
await page.waitForTimeout(700);
const backFirst=await page.evaluate(()=>document.querySelector('.flash-face')?.className||'');
log.info('裏から表示ON直後の面: '+backFirst);
if(/flash-back/.test(backFirst))log.ok('「裏から表示」が現在のカードへ即時反映');
await page.evaluate(()=>{const s=document.querySelector('select[name=flash-sort]');if(s){const o=[...s.options].find(o=>o.textContent.includes('五十音'));if(o){s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));}}});
await page.waitForTimeout(700);
const beforeReload=await page.evaluate(()=>({stage:document.querySelector('.flash-stage')?.textContent.replace(/\s+/g,' ').trim(),face:document.querySelector('.flash-face')?.textContent.replace(/\s+/g,' ').trim().slice(0,50)}));
await page.reload({waitUntil:'load'});
await page.waitForTimeout(1800);
const afterReload=await page.evaluate(()=>({stage:document.querySelector('.flash-stage')?.textContent.replace(/\s+/g,' ').trim()||null,face:document.querySelector('.flash-face')?.textContent.replace(/\s+/g,' ').trim().slice(0,50)||null}));
log.info('リロード前: '+JSON.stringify(beforeReload)+' / 後: '+JSON.stringify(afterReload));
if(afterReload.stage&&afterReload.stage===beforeReload.stage)log.ok('単語帳のモード・位置がリロードで復元される');
else log.obs('リロード復元が完全ではない（記録のみ）');
log.info('errors: '+JSON.stringify(errors.filter(e=>!/404/.test(e))));
await ctx.close();
await browser.close();
console.log('V3 DONE');
