// V2 解く：演習フルラン＋結果、カレンダーのセッション表示（C2-SESSION-01）
// 手順注記（実物確認済み）：
// - 選択肢は <label class="answer-choice">（ラジオ）。選んで「回答する」(button.answer-submit)。
// - 取り込みは書き出し形式 {schemaVersion:1, format:'heat-study-ja-learning-data', ...} が必要。
//   形式違いは「対応する学習データ形式ではありません。現在の記録は変更していません。」で拒否される。
// - 取り込みはプレビュー→「すべて置き換える」(data-action=import-replace) が正規手順。
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
import {createEmptyState,localDay} from '../../../study-core.mjs';
import {writeFileSync} from 'node:fs';
const log=makeLog('V2');
const browser=await launch();
const exportShape=(state)=>({...state,schemaVersion:1,exportedAt:new Date().toISOString(),format:'heat-study-ja-learning-data'});

// ---------- Part A: 実操作で演習を完走し、その日のセッション表示を見る ----------
{
  const {ctx,page,errors}=await newPage(browser,{width:375});
  page.setDefaultTimeout(180000);
  await page.goto(DIST+'/index.html#quiz',{waitUntil:'load'});
  await page.waitForFunction(()=>!!document.querySelector('select[name=count]'),null,{timeout:90000}).catch(()=>log.obs('count select 出現待ちタイムアウト'));
  await page.selectOption('select[name=count]',{index:0}).catch(e=>log.info('count select: '+e.message));
  await page.evaluate(()=>{document.querySelector('button[type=submit]')?.click();});
  const started=await page.waitForFunction(()=>!!document.querySelector('.question-card .answer-choice'),null,{timeout:150000}).then(()=>true).catch(()=>false);
  log.info('演習開始（選択肢出現）: '+started);
  let finished=false,answeredCount=0;
  for(let i=0;i<8&&started&&!finished;i++){
    const isResult=await page.evaluate(()=>{const t=document.body.textContent.replace(/\s+/g,' ');return /正答率/.test(t)&&/分野別|復習/.test(t);});
    if(isResult){finished=true;break;}
    const picked=await page.evaluate(()=>{
      const l=document.querySelector('.question-card .answer-choice');
      if(!l)return null; l.click(); return l.textContent.replace(/\s+/g,' ').trim().slice(0,30);
    });
    if(!picked){log.obs('選択肢ラベルなし（反復'+i+'）');break;}
    await page.waitForTimeout(400);
    await page.evaluate(()=>{document.querySelector('.question-card button.answer-submit')?.click();});
    const judged=await page.waitForFunction(()=>/正解|不正解/.test(document.querySelector('.question-card')?.textContent||''),null,{timeout:90000}).then(()=>true).catch(()=>false);
    if(!judged){log.obs('判定表示なし（反復'+i+'）');break;}
    answeredCount++;
    if(i===0){
      const expl=await page.evaluate(()=>{const t=document.querySelector('.question-card').textContent.replace(/\s+/g,' ');const x=t.indexOf('考え方');return x>=0?t.slice(x,x+80):t.slice(0,120);});
      log.info('判定＋解説: '+expl);
      await page.screenshot({path:SHOTS+'v2-quiz-judged-375.png'});
    }
    const nextText=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/次の問題|結果を見る|結果へ/.test(b.textContent));if(b){b.click();return b.textContent.trim();}return null;});
    if(!nextText)log.obs('次へボタンなし（反復'+i+'）');
    await page.waitForTimeout(800);
  }
  const finalResult=finished||await page.evaluate(()=>/正答率/.test(document.body.textContent)).catch(()=>false);
  log.info('回答した問題数: '+answeredCount+' / 結果画面到達: '+finalResult);
  if(finalResult&&answeredCount>0)log.ok('演習を開始→回答→判定→解説→結果まで完走');
  else log.fail('演習を完走できず');
  await page.screenshot({path:SHOTS+'v2-quiz-result-375.png'});
  await page.goto(DIST+'/index.html#calendar',{waitUntil:'load'});
  await page.waitForTimeout(2500);
  const cal=await page.evaluate(()=>({
    entries:[...document.querySelectorAll('.session-entry')].map(e=>e.textContent.replace(/\s+/g,' ').trim()),
    stats:document.querySelector('.day-stats')?.textContent.replace(/\s+/g,' ').trim()||null,
  }));
  log.info('実セッション表示: '+JSON.stringify(cal));
  if(cal.entries.length&&cal.entries.every(t=>t.includes('保存時集計：')))log.ok('実セッションにも「保存時集計：」標識が付く');
  if(cal.entries.some(t=>t.includes('一致しません')))log.fail('整合した実セッションに不一致注記が出ている');
  await page.screenshot({path:SHOTS+'v2-calendar-real-375.png'});
  log.info('PartA errors: '+JSON.stringify(errors.filter(e=>!/404/.test(e))));
  await ctx.close();
}

// ---------- Part B: 不整合セッションを取り込み（置き換え）、カレンダー表示を確認 ----------
{
  const {ctx,page,errors}=await newPage(browser,{width:375});
  page.setDefaultTimeout(180000);
  const now=new Date(),day=localDay(now);
  const payload=createEmptyState();
  const att=(qid,correct,at)=>({questionId:qid,correct,at});
  payload.sessions=[
    {id:'v2-inconsistent-empty',date:day,startedAt:new Date(now.getTime()-3600e3).toISOString(),total:99,correct:99,answers:[]},
    {id:'v2-inconsistent-detail',date:day,startedAt:new Date(now.getTime()-1800e3).toISOString(),total:2,correct:2,answers:[att('v2-q1',true,new Date(now.getTime()-1700e3).toISOString()),att('v2-q2',false,new Date(now.getTime()-1600e3).toISOString())]},
    {id:'v2-consistent',date:day,startedAt:now.toISOString(),total:2,correct:1,answers:[att('v2-q3',true,new Date(now.getTime()-600e3).toISOString()),att('v2-q4',false,new Date(now.getTime()-500e3).toISOString())]},
  ];
  writeFileSync('/tmp/v2-import.json',JSON.stringify(exportShape(payload)));
  await page.goto(DIST+'/index.html#settings',{waitUntil:'load'});
  await page.waitForFunction(()=>!!document.querySelector('#import-file'),null,{timeout:90000}).catch(()=>log.obs('import-file 出現待ちタイムアウト'));
  await page.setInputFiles('#import-file','/tmp/v2-import.json');
  const preview=await page.waitForSelector('[data-action="import-replace"]',{timeout:90000}).then(()=>true).catch(()=>false);
  log.info('取り込みプレビュー表示: '+preview);
  if(preview){
    await page.click('[data-action="import-replace"]');
    await page.waitForTimeout(2500);
  }
  const storedCount=await page.evaluate(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1')).sessions.length);
  log.info('取り込み後の保存セッション数: '+storedCount);
  await page.goto(DIST+'/index.html#calendar',{waitUntil:'load'});
  await page.waitForTimeout(2500);
  let entries=await page.evaluate(()=>[...document.querySelectorAll('.session-entry')].map(e=>e.textContent.replace(/\s+/g,' ').trim()));
  if(!entries.length){
    const clicked=await page.evaluate((d)=>{
      const cell=document.querySelector(`[data-date="${d}"]`)||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes(d));
      if(cell){cell.click();return true;}return false;
    },day);
    log.info('当日セルクリック: '+clicked);
    await page.waitForTimeout(1500);
    entries=await page.evaluate(()=>[...document.querySelectorAll('.session-entry')].map(e=>e.textContent.replace(/\s+/g,' ').trim()));
  }
  log.info('セッションエントリ数: '+entries.length);
  entries.forEach((t,i)=>log.info('entry'+i+': '+t));
  const stats=await page.evaluate(()=>document.querySelector('.day-stats')?.textContent.replace(/\s+/g,' ').trim()||null);
  log.info('day-stats（回答履歴由来）: '+stats);
  const withLabel=entries.filter(t=>t.includes('保存時集計：')).length;
  const withNote=entries.filter(t=>t.includes('一致しません')).length;
  if(entries.length===3&&withLabel===3)log.ok('全セッションに「保存時集計：」標識');
  else log.fail('標識の付き方が想定と異なる: entries='+entries.length+' label='+withLabel);
  if(withNote===2)log.ok('不一致注記は不整合2件のみに表示、整合1件には出ない');
  else log.fail('不一致注記の件数が想定と異なる: '+withNote);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1')).sessions.map(s=>({total:s.total,correct:s.correct,n:(s.answers||[]).length})));
  log.info('保存値（不変確認）: '+JSON.stringify(stored));
  await page.screenshot({path:SHOTS+'v2-calendar-inconsistent-375.png'});
  log.info('PartB errors: '+JSON.stringify(errors.filter(e=>!/404/.test(e))));
  await ctx.close();
}
await browser.close();
console.log('V2 DONE');
