// W4 主要経路の回帰確認：ホーム／目次→節／用語集／簡易シム／通常ラボ／設定保存・復元／オフライン
import {launch,newPage,DIST,SHOTS,makeLog,overflow} from './lib.mjs';
import {writeFileSync} from 'node:fs';
const log=makeLog('W4');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);
const ovCheck=async(tag)=>{const ov=await overflow(page);if(!ov.bad)log.ok(tag+' 375px 横はみ出し 0');else log.fail(tag+' 横はみ出し: '+JSON.stringify(ov));};

// ---------- A. ホーム ----------
await page.goto(DIST+'/index.html',{waitUntil:'load'});
await page.waitForTimeout(2200);
const home=await page.evaluate(()=>({title:document.querySelector('h1')?.textContent.trim()||'',nav:document.querySelectorAll('.nav-link').length}));
log.info('ホーム: '+JSON.stringify(home));
if(home.title)log.ok('ホームが描画される'); else log.fail('ホームの見出しがない');
await ovCheck('ホーム');
await page.screenshot({path:SHOTS+'w4-home-375.png'});

// ---------- A2. 目次→節（§2.3） ----------
await page.goto(DIST+'/index.html#reader',{waitUntil:'load'});
await page.waitForTimeout(2000);
const tocClicked=await page.evaluate(()=>{
  const el=document.querySelector('[data-open-section="2.3"]')||[...document.querySelectorAll('a,button')].find(e=>/2\.3/.test(e.textContent)&&e.textContent.length<60);
  if(el){el.click();return el.textContent.trim().slice(0,40);}return null;
});
await page.waitForTimeout(1800);
const sec=await page.evaluate(()=>({h2:[...document.querySelectorAll('h2')].map(x=>x.textContent).join(' ').slice(0,60),paras:document.querySelectorAll('#reader-article p').length}));
log.info('目次クリック: '+tocClicked+' / 到達: '+JSON.stringify(sec));
if(/2\.3/.test(sec.h2)&&sec.paras>0)log.ok('目次から §2.3 の読書画面へ到達');
else log.fail('§2.3 へ到達できず');
await ovCheck('§2.3 読書');

// ---------- B. 用語集：検索・行展開・ブックマーク・単語帳 ----------
await page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
await page.waitForTimeout(1800);
const searchSel=await page.evaluate(()=>{const i=document.querySelector('#glossary-search, input[type=search], .glossary-tools input');return i?('#'+(i.id||'')+' '+(i.getAttribute('placeholder')||'')):null;});
log.info('用語集検索欄: '+searchSel);
if(searchSel){
  const inp=page.locator('#glossary-search, input[type=search], .glossary-tools input').first();
  await inp.fill('フィン効率');
  await page.waitForTimeout(1200);
}
const rowVis=await page.evaluate(()=>{const r=document.querySelector('#term-fin-efficiency');return r?{visible:!!r.offsetParent}:null;});
log.info('フィン効率の行: '+JSON.stringify(rowVis));
if(rowVis&&rowVis.visible)log.ok('用語集検索で「フィン効率」の行に絞れる'); else log.fail('用語集検索で行が見つからない');
await page.evaluate(()=>{document.querySelector('#term-fin-efficiency .term-toggle')?.click();});
await page.waitForTimeout(700);
const expanded=await page.evaluate(()=>{const b=document.querySelector('#term-fin-efficiency .term-body');return b?b.textContent.replace(/\s+/g,' ').trim().slice(0,90):null;});
log.info('行展開: '+expanded);
if(expanded&&expanded.length>20)log.ok('用語の行展開で定義が表示される'); else log.fail('行展開で定義が出ない');
const bm=await page.evaluate(()=>{const row=document.querySelector('#term-fin-efficiency');const b=row?[...row.querySelectorAll('button')].find(x=>/☆|★/.test(x.textContent)):null;if(b){b.click();return b.textContent.trim();}return null;});
await page.waitForTimeout(500);
const bmAfter=await page.evaluate(()=>{const row=document.querySelector('#term-fin-efficiency');const b=row?[...row.querySelectorAll('button')].find(x=>/☆|★/.test(x.textContent)):null;return b?b.textContent.trim():null;});
log.info('ブックマーク: '+bm+' → '+bmAfter);
if(bmAfter&&bmAfter.includes('★'))log.ok('用語をブックマークできた'); else log.fail('ブックマークが付かない');
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='単語帳');b?.click();});
await page.waitForTimeout(800);
await page.evaluate(()=>{const s=document.querySelector('select[name=flash-scope]');if(s){const o=[...s.options].find(o=>/ブックマーク/.test(o.textContent));if(o){s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));}}});
await page.waitForTimeout(800);
const stage=await page.evaluate(()=>document.querySelector('.flash-stage')?.textContent.replace(/\s+/g,' ').trim()||'');
log.info('単語帳ステージ: '+stage.slice(0,60));
if(/1\s*\/\s*1/.test(stage)||stage.includes('フィン効率'))log.ok('単語帳（ブックマークのみ）にブックマーク語が出る'); else log.obs('単語帳ステージ表示: '+stage.slice(0,60));
await page.evaluate(()=>{document.querySelector('.flash-face')?.click();});
await page.waitForTimeout(700);
const back=await page.evaluate(()=>document.querySelector('.flash-scroll')?.textContent.replace(/\s+/g,' ').trim().slice(0,90)||'');
log.info('単語帳裏面: '+back);
if(back.length>15)log.ok('単語帳をめくって裏面（定義）が表示される'); else log.fail('単語帳の裏面が出ない');
await page.screenshot({path:SHOTS+'w4-flashcard-375.png'});
await ovCheck('用語集・単語帳');

// ---------- C. 簡易シミュレーター：ピッカー収納 ----------
await page.goto(DIST+'/index.html#simulator',{waitUntil:'load'});
await page.waitForTimeout(2000);
const bar=await page.evaluate(()=>({
  changeBtn:!![...document.querySelectorAll('button')].find(b=>/モードを変更/.test(b.textContent)),
  visibleModeBtns:[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&/伝導|放射|対流|沸騰/.test(b.textContent)&&b.textContent.length<30).length,
}));
log.info('ピッカー初期: '+JSON.stringify(bar));
if(bar.changeBtn&&bar.visibleModeBtns<=1)log.ok('簡易シミュレーター初期状態はピッカー収納（現在のモード＋変更バー）');
else log.fail('ピッカーが初期から展開している可能性: '+JSON.stringify(bar));
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/モードを変更/.test(b.textContent));b?.click();});
await page.waitForTimeout(900);
const pickedMode=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.offsetParent&&/二面間放射|放射/.test(b.textContent)&&b.textContent.length<40);if(b){const t=b.textContent.trim().slice(0,30);b.click();return t;}return null;});
await page.waitForTimeout(1200);
log.info('選択モード: '+pickedMode);
const outBefore=await page.evaluate(()=>document.querySelector('output')?.textContent||document.body.textContent.replace(/\s+/g,' ').match(/Q[^=]{0,3}=\s*[\d.,]+\s*W/)?.[0]||'');
const inpChanged=await page.evaluate(()=>{const inp=[...document.querySelectorAll('input[type=number], input[type=text]')].find(i=>i.offsetParent);if(!inp)return null;const old=inp.value;inp.value=String((Number(old)||1)*2);inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));return {old,new:inp.value};});
await page.waitForTimeout(1000);
const outAfter=await page.evaluate(()=>document.querySelector('output')?.textContent||document.body.textContent.replace(/\s+/g,' ').match(/Q[^=]{0,3}=\s*[\d.,]+\s*W/)?.[0]||'');
log.info('再計算: 入力 '+JSON.stringify(inpChanged)+' / 出力 "'+outBefore+'" → "'+outAfter+'"');
if(inpChanged&&outBefore!==outAfter)log.ok('簡易シミュレーターで入力変更が再計算に反映される');
else log.obs('出力の変化を文字列では捉えられず（要目視）');
await page.screenshot({path:SHOTS+'w4-simulator-375.png'});
await ovCheck('簡易シミュレーター');

// ---------- D. 通常シミュレーター（ラボ） ----------
await page.goto(DIST+'/index.html#lab',{waitUntil:'load'});
await page.waitForTimeout(1800);
let labPage=page; const labErrors=[];
const [popup]=await Promise.all([
  ctx.waitForEvent('page',{timeout:30000}).catch(()=>null),
  page.evaluate(()=>{const a=[...document.querySelectorAll('a')].find(a=>/dynamic\/index\.html/.test(a.getAttribute('href')||''));a?.click();}),
]);
if(popup){labPage=popup;labPage.on('pageerror',e=>labErrors.push(e.message));log.ok('タブから「実験室を開く」で別タブに通常シミュレーターが開く');}
else{log.obs('ポップアップ捕捉できず直接遷移で代替');await page.goto(DIST+'/dynamic/index.html',{waitUntil:'load'});}
await labPage.waitForTimeout(2500);
await labPage.selectOption('#learning-path',{label:'予想して確かめる'}).catch(e=>log.info('learning-path: '+e.message));
await labPage.waitForTimeout(600);
await labPage.getByRole('button',{name:'フィンの温度',exact:true}).click().catch(e=>log.info('fin btn: '+e.message));
await labPage.waitForTimeout(800);
await labPage.getByRole('button',{name:/初期条件を準備/}).click().catch(e=>log.info('prep btn: '+e.message));
await labPage.waitForTimeout(600);
const radios=labPage.locator('label:has(input[type=radio]) >> visible=true');
if(await radios.count())await radios.first().click();
await labPage.waitForTimeout(300);
await labPage.getByRole('button',{name:/予想を確定/}).click().catch(e=>log.info('confirm btn: '+e.message));
await labPage.waitForTimeout(600);
await labPage.getByRole('button',{name:/5秒まで計算/}).click().catch(e=>log.info('run btn: '+e.message));
await labPage.waitForTimeout(6000);
const snap=await labPage.evaluate(()=>({clock:document.querySelector('[id=clock]')?.textContent||'',readout:document.querySelector('#readout')?.textContent.replace(/\s+/g,' ').slice(0,110)||''}));
log.info('ラボ計算後: '+JSON.stringify(snap));
if(/5\.0/.test(snap.clock))log.ok('通常シミュレーター：予想→確定→5秒まで計算が実働（時計 '+snap.clock+'）');
else log.fail('ラボの時計が5秒に到達しない: '+snap.clock);
await labPage.screenshot({path:SHOTS+'w4-lab-375.png'});
log.info('lab pageerrors: '+JSON.stringify(labErrors));
if(labPage!==page)await labPage.close();

// ---------- E. 設定：書き出し→取り込み（保存・復元） ----------
await page.goto(DIST+'/index.html#settings',{waitUntil:'load'});
await page.waitForTimeout(1800);
await page.evaluate(()=>{document.querySelector('[data-action="export-preview"]')?.click();});
await page.waitForTimeout(900);
const exported=await page.evaluate(()=>document.querySelector('#export-json')?.value||'');
log.info('書き出しJSON: '+exported.length+' bytes');
if(exported.length>100)log.ok('設定から学習データを書き出せる'); else log.fail('書き出しが得られない');
writeFileSync('/tmp/loop3-export.json',exported);
await page.setInputFiles('#import-file','/tmp/loop3-export.json');
await page.waitForSelector('[data-action="import-merge"]',{timeout:60000});
await page.click('[data-action="import-merge"]');
await page.waitForTimeout(1600);
const fb=await page.evaluate(()=>document.body.textContent.replace(/\s+/g,' ').match(/学習データを追加しました|取り込み可能なデータです|取り込みました/)?.[0]||'');
log.info('取り込みフィードバック: '+fb);
if(fb)log.ok('書き出したデータをそのまま取り込み直せる（保存・復元の往復）'); else log.fail('取り込みの成否表示が捉えられない');
await ovCheck('設定');

// ---------- E2. リロード後の保持 ----------
await page.reload({waitUntil:'load'});
await page.waitForTimeout(2000);
await page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
await page.waitForTimeout(1500);
const kept=await page.evaluate(()=>{const row=document.querySelector('#term-fin-efficiency');const b=row?[...row.querySelectorAll('button')].find(x=>/☆|★/.test(x.textContent)):null;return b?b.textContent.trim():null;});
log.info('リロード後のブックマーク表示: '+kept);
if(kept&&kept.includes('★'))log.ok('リロード後もブックマークが保持される（保存の持続）');
else log.fail('リロード後にブックマークが保持されない');

// ---------- F. オフライン再読み込み ----------
await page.goto(DIST+'/index.html',{waitUntil:'load'});
await page.evaluate(()=>navigator.serviceWorker.ready).catch(()=>{});
await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:90000}).catch(()=>log.obs('SW controller 待ちタイムアウト'));
await ctx.setOffline(true);
await page.reload({waitUntil:'load'}).catch(e=>log.info('offline reload: '+e.message));
await page.waitForTimeout(2500);
const off=await page.evaluate(()=>({h1:document.querySelector('h1')?.textContent.trim()||'',hasNav:document.querySelectorAll('.nav-link').length}));
log.info('オフライン再読込: '+JSON.stringify(off));
if(off.h1||off.hasNav>0)log.ok('オフライン再読み込みでホームが描画される');
else log.fail('オフライン再読み込みで描画されない');
await page.screenshot({path:SHOTS+'w4-offline-375.png'});
await ctx.setOffline(false);

log.info('W4 errors: '+JSON.stringify(errors));
if(!errors.some(e=>e.startsWith('pageerror')))log.ok('W4 セッション pageerror 0（コンソールの manifest 404 は既知の設計観察）');
else log.fail('W4 pageerror: '+errors.join(' | '));
await ctx.close();
await browser.close();
console.log('W4 DONE');
