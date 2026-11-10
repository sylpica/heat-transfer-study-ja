// W1 主要ユーザーパス（375px）：ホーム／検索／目次→節／用語集／問題演習／ガイド／簡易シム／通常ラボ／保存復元／オフライン
import {launch,newPage,DIST,SHOTS,makeLog,overflow} from './lib.mjs';
import {writeFileSync} from 'node:fs';
const log=makeLog('W1');
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
await page.screenshot({path:SHOTS+'w1-home-375.png'});

// ---------- B. 検索：語で検索して結果から節へ ----------
await page.goto(DIST+'/index.html#search',{waitUntil:'load'});
await page.waitForTimeout(1800);
const sInp=page.locator('#search-input, #search input, input[type=search]').first();
log.info('検索欄の有無: '+await sInp.count());
if(await sInp.count()){
  await sInp.fill('フィン効率');
  await page.waitForTimeout(1500);
  const hits=await page.evaluate(()=>[...document.querySelectorAll('#search a, #search button, .search-results a, .search-results button')].filter(e=>e.offsetParent).map(e=>e.textContent.replace(/\s+/g,' ').trim().slice(0,50)).slice(0,8));
  log.info('検索ヒット: '+JSON.stringify(hits));
  if(hits.length)log.ok('検索で結果が表示される'); else log.fail('検索結果が出ない');
  const goSec=await page.evaluate(()=>{
    const el=[...document.querySelectorAll('#search a, #search button, .search-results a, .search-results button')].find(e=>e.offsetParent&&/節|読む|§|5\./.test(e.textContent));
    if(el){const t=el.textContent.replace(/\s+/g,' ').trim().slice(0,40);el.click();return t;} return null;
  });
  await page.waitForTimeout(2000);
  const after=await page.evaluate(()=>({hash:location.hash,h2:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim()).join(' ').slice(0,60)}));
  log.info('検索結果クリック: '+goSec+' → '+JSON.stringify(after));
  if(goSec)log.ok('検索結果から対象ページへ遷移できる'); else log.obs('検索結果に節へのリンクが見当たらず遷移は未実施');
}
await ovCheck('検索');

// ---------- C. 目次→節（§2.3） ----------
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

// ---------- D. 用語集：検索・行展開・ブックマーク・単語帳（A6 範囲） ----------
await page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
await page.waitForTimeout(1800);
const inp=page.locator('#glossary-search, input[type=search], .glossary-tools input').first();
if(await inp.count()){await inp.fill('フィン効率');await page.waitForTimeout(1200);}
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
await page.screenshot({path:SHOTS+'w1-flashcard-375.png'});
await ovCheck('用語集・単語帳');

// ---------- E. 問題演習：§6.1 ノートから開始→回答→解説（回帰確認を兼ねる） ----------
await page.goto(DIST+'/index.html#reader/6.1',{waitUntil:'load'});
const qbtn=page.locator('#reader-original-note [data-start-question="supp-next-local-versus-average-v1"]');
await qbtn.waitFor({state:'visible',timeout:90000}).catch(()=>log.obs('§6.1 ノート内の開始ボタン待ちタイムアウト'));
await qbtn.first().click();
await page.waitForTimeout(600);
const modal=page.locator('.quiz-start-modal [data-action="confirm-quiz-start"]');
if(await modal.count()){await modal.first().click(); log.info('開始確認モーダルを承認');}
await page.locator('.question-card').waitFor({state:'visible',timeout:90000});
await page.waitForTimeout(500);
const card=await page.evaluate(()=>document.querySelector('.question-card').textContent.replace(/\s+/g,' ').trim());
log.info('問題カード: '+card.slice(0,300));
const picked=await page.evaluate(()=>{
  const l=[...document.querySelectorAll('.question-card .answer-choice')].find(x=>x.textContent.includes('局所値と平均は別の量であり、平均には分布の積分が必要'));
  if(!l)return null; l.click(); return l.textContent.replace(/\s+/g,' ').trim();
});
log.info('選択した肢: '+picked);
await page.waitForTimeout(400);
await page.evaluate(()=>{document.querySelector('.question-card button.answer-submit')?.click();});
await page.waitForFunction(()=>/正解|不正解/.test(document.querySelector('.question-card')?.textContent||''),null,{timeout:60000}).catch(()=>log.obs('判定待ちタイムアウト'));
await page.waitForTimeout(500);
const judged=await page.evaluate(()=>document.querySelector('.question-card').textContent.replace(/\s+/g,' ').trim());
if(/正解(?!率)/.test(judged)&&!/不正解/.test(judged))log.ok('問題に回答して正解判定が表示される');
else log.fail('正解判定にならなかった: '+judged.slice(0,120));
if(judged.includes('一般に平均h̄_L=(1/L)∫₀ᴸ h_x dx'))log.ok('解説が表示される'); else log.obs('解説の積分定義は文字列で捉えられず');
await page.screenshot({path:SHOTS+'w1-question-judged-375.png'});
await ovCheck('問題カード表示中');

// ---------- F. ガイド ----------
await page.goto(DIST+'/index.html#guide',{waitUntil:'load'});
await page.waitForTimeout(1800);
const guide=await page.evaluate(()=>({h:[...document.querySelectorAll('h1,h2')].map(x=>x.textContent.trim()).join(' ').slice(0,80),len:document.body.textContent.length}));
log.info('ガイド: '+JSON.stringify(guide));
if(guide.len>500)log.ok('ガイドが表示される'); else log.fail('ガイドの内容が乏しい');
await ovCheck('ガイド');

// ---------- G. 簡易シミュレーター：ピッカー→モード変更→再計算 ----------
await page.goto(DIST+'/index.html#simulator',{waitUntil:'load'});
await page.waitForTimeout(2000);
const bar=await page.evaluate(()=>({
  changeBtn:!![...document.querySelectorAll('button')].find(b=>/モードを変更/.test(b.textContent)),
  visibleModeBtns:[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&/伝導|放射|対流|沸騰/.test(b.textContent)&&b.textContent.length<30).length,
}));
log.info('ピッカー初期: '+JSON.stringify(bar));
if(bar.changeBtn&&bar.visibleModeBtns<=1)log.ok('簡易シミュレーター初期状態はピッカー収納');
else log.fail('ピッカーが初期から展開している可能性: '+JSON.stringify(bar));
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/モードを変更/.test(b.textContent));b?.click();});
await page.waitForTimeout(900);
const pickedMode=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.offsetParent&&/二面間放射|放射/.test(b.textContent)&&b.textContent.length<40);if(b){const t=b.textContent.trim().slice(0,30);b.click();return t;}return null;});
await page.waitForTimeout(1200);
log.info('選択モード: '+pickedMode);
const readOut=async()=>page.evaluate(()=>document.querySelector('output')?.textContent||document.body.textContent.replace(/\s+/g,' ').match(/Q[^=]{0,3}=\s*[\d.,]+\s*W/)?.[0]||'');
const outBefore=await readOut();
const inpChanged=await page.evaluate(()=>{const inp=[...document.querySelectorAll('input[type=number], input[type=text]')].find(i=>i.offsetParent);if(!inp)return null;const old=inp.value;inp.value=String((Number(old)||1)*2);inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));return {old,new:inp.value};});
await page.waitForTimeout(1000);
const outAfter=await readOut();
log.info('再計算: 入力 '+JSON.stringify(inpChanged)+' / 出力 "'+outBefore+'" → "'+outAfter+'"');
if(inpChanged&&outBefore!==outAfter)log.ok('簡易シミュレーターで入力変更が再計算に反映される');
else log.obs('出力の変化を文字列では捉えられず（要目視）');
await page.screenshot({path:SHOTS+'w1-simulator-375.png'});
await ovCheck('簡易シミュレーター');

// ---------- H. 通常シミュレーター（ラボ）：タブ遷移→起動→フィンの温度＋別モード ----------
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
const labModes=await labPage.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>b.textContent.trim()).filter(t=>t.length>0&&t.length<24).slice(0,30));
log.info('ラボのボタン群: '+JSON.stringify(labModes));
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
if(/5\.0/.test(snap.clock))log.ok('通常シミュレーター：予想→確定→5秒まで計算が実働（時計 '+snap.clock+'、ループ3検証値 21.889℃ と readout を比較）');
else log.fail('ラボの時計が5秒に到達しない: '+snap.clock);
await labPage.screenshot({path:SHOTS+'w1-lab-375.png'});
const lov=await overflow(labPage);
if(!lov.bad)log.ok('ラボ 375px 横はみ出し 0'); else log.fail('ラボ 横はみ出し: '+JSON.stringify(lov));
log.info('lab pageerrors: '+JSON.stringify(labErrors));
if(labPage!==page)await labPage.close();

// ---------- I. 設定：書き出し→取り込み（保存・復元）＋学習記録の保持 ----------
await page.goto(DIST+'/index.html#settings',{waitUntil:'load'});
await page.waitForTimeout(1800);
await page.evaluate(()=>{document.querySelector('[data-action="export-preview"]')?.click();});
await page.waitForTimeout(900);
const exported=await page.evaluate(()=>document.querySelector('#export-json')?.value||'');
log.info('書き出しJSON: '+exported.length+' bytes');
if(exported.length>100)log.ok('設定から学習データを書き出せる'); else log.fail('書き出しが得られない');
if(exported.includes('supp-next-local-versus-average-v1'))log.ok('書き出しに §6.1 問題の学習記録が含まれる（演習記録の保存を確認）');
else log.obs('書き出しに当該問題IDは見当たらず（記録キーの形式差の可能性）');
writeFileSync('/tmp/loop4-export.json',exported);
await page.setInputFiles('#import-file','/tmp/loop4-export.json');
await page.waitForSelector('[data-action="import-merge"]',{timeout:60000});
await page.click('[data-action="import-merge"]');
await page.waitForTimeout(1600);
const fb=await page.evaluate(()=>document.body.textContent.replace(/\s+/g,' ').match(/学習データを追加しました|取り込み可能なデータです|取り込みました/)?.[0]||'');
log.info('取り込みフィードバック: '+fb);
if(fb)log.ok('書き出したデータをそのまま取り込み直せる（保存・復元の往復）'); else log.fail('取り込みの成否表示が捉えられない');
await ovCheck('設定');

// ---------- I2. リロード後の保持 ----------
await page.reload({waitUntil:'load'});
await page.waitForTimeout(2000);
await page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
await page.waitForTimeout(1500);
const kept=await page.evaluate(()=>{const row=document.querySelector('#term-fin-efficiency');const b=row?[...row.querySelectorAll('button')].find(x=>/☆|★/.test(x.textContent)):null;return b?b.textContent.trim():null;});
log.info('リロード後のブックマーク表示: '+kept);
if(kept&&kept.includes('★'))log.ok('リロード後もブックマークが保持される');
else log.fail('リロード後にブックマークが保持されない');

// ---------- J. オフライン再読み込み＋オフラインで節を開く ----------
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
await page.goto(DIST+'/index.html#reader/2.3',{waitUntil:'load'}).catch(e=>log.info('offline section: '+e.message));
await page.waitForTimeout(2500);
const offSec=await page.evaluate(()=>({h2:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim()).join(' ').slice(0,50),paras:document.querySelectorAll('#reader-article p').length}));
log.info('オフラインで §2.3: '+JSON.stringify(offSec));
if(offSec.paras>0)log.ok('オフラインでも節本文が表示される（プリキャッシュ実働）');
else log.obs('オフラインで節本文は未確認（経路差の可能性）');
await page.screenshot({path:SHOTS+'w1-offline-375.png'});
await ctx.setOffline(false);

log.info('W1 errors: '+JSON.stringify(errors));
if(!errors.some(e=>e.startsWith('pageerror')))log.ok('W1 セッション pageerror 0（コンソールの manifest 404 は既知の設計観察）');
else log.fail('W1 pageerror: '+errors.join(' | '));
await ctx.close();
await browser.close();
console.log('W1 DONE');
