import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyState,validateLearningData,normalizeLearningData,mergeLearningData,calculateHeatTransfer,chapterKey,searchEntries,searchSnippet,nextReviewDays,shiftMonth,localDay,planMinutes,fieldProgress,isCurrentQuestionAnswer,DATA_FORMAT,speechChunks,quizChoiceOrder} from '../study-core.mjs';
const exported=()=>({...createEmptyState(),format:DATA_FORMAT});
const attempt=(extra={})=>({id:'a1',questionId:'q1',selected:0,correct:true,confidence:'high',at:'2026-10-19T15:15:00.000Z',...extra});

test('choice order is stable for a resumed set and varies the correct position across sets',()=>{
  const order=quizChoiceOrder('round-a','q1');
  assert.deepEqual([...order].sort(),[0,1,2,3]);
  assert.deepEqual(quizChoiceOrder('round-a','q1'),order);
  assert.deepEqual(quizChoiceOrder('', 'q1'),[0,1,2,3]);
  assert.ok(new Set(Array.from({length:40},(_,i)=>quizChoiceOrder(`round-${i}`,'q1').indexOf(0))).size>=3);
});

test('speech uses figure and formula alternatives, table cells, and bounded chunks',()=>{
  const chunks=speechChunks([{type:'formula',alt:'熱流束の式',expression:'q=-kΔT',text:'記号の意味'},{type:'table',caption:'物性',headers:['温度','熱伝導率'],rows:[['300 K','1.05']]},{type:'figure',alt:'円柱の後流'},{type:'supplement',text:'補足の本文。'.repeat(100)}]);
  assert.ok(chunks.includes('熱流束の式'));assert.ok(chunks.includes('円柱の後流'));assert.ok(chunks.includes('1.05'));assert.ok(chunks.includes('補足説明。'));assert.ok(chunks.every(s=>s.length<=240&&!s.includes('[object Object]')));assert.ok(!chunks.includes('q=-kΔT'));
  assert.deepEqual(speechChunks(null),[]);
});

test('new learning data use Japanese and independent collections',()=>{
  const a=createEmptyState(),b=createEmptyState();a.attempts.push(attempt());
  assert.equal(a.settings.contentLanguage,'ja');assert.equal(b.attempts.length,0);assert.equal(validateLearningData(exported()),'');
});
test('restore rejects malformed optional records, dates, choices, settings, and dangerous keys',()=>{
  const cases=[{notes:null},{reviews:[]},{questionReports:{q1:null}},{readSections:{'1.1':'yes'}},{readerPositions:{'1.1':-1}},{settings:{theme:'unknown'}},{plan:{targetDate:'2026-02-30'}},{attempts:[attempt({selected:4})]},{attempts:[attempt({at:'not-a-date'})]},{bookmarks:[{id:'b',sectionId:'1.1',note:'x',createdAt:'bad'}]},{sessions:[{date:'2026-10-20',total:1,correct:2,startedAt:1}]}];
  for(const item of cases)assert.notEqual(validateLearningData({...exported(),...item}),'',JSON.stringify(item));
  assert.notEqual(validateLearningData(JSON.parse('{"schemaVersion":1,"format":"heat-study-ja-learning-data","__proto__":{}}')),'');
});
test('legacy optional fields receive defaults without deleting unknown question history',()=>{
  const data=exported();delete data.notes;delete data.questionReports;delete data.simComparisons;data.attempts=[attempt({questionId:'not-yet-loaded'})];
  assert.equal(validateLearningData(data),'');const n=normalizeLearningData(data);assert.deepEqual(n.notes,[]);assert.equal(n.attempts[0].questionId,'not-yet-loaded');assert.equal(n.format,undefined);
});
test('merge is idempotent, retains newer notes, combines reports, and preserves reading records',()=>{
  const a=createEmptyState(),b=exported();a.attempts=[attempt()];b.attempts=[attempt(),attempt({id:'a2',at:'2026-10-20T00:00:00Z'})];
  a.mistakeNotes.q1={reason:'new',updatedAt:'2026-10-20T00:00:00Z'};b.mistakeNotes.q1={reason:'old',updatedAt:'2026-10-19T00:00:00Z'};
  a.readSections['1.1']=true;b.readSections['1.2']=true;a.readerPositions['1.1']=200;b.readerPositions['1.2']=300;
  const r1={category:'other',message:'one',at:'2026-10-19T00:00:00Z'},r2={...r1,message:'two'};a.questionReports.q1=[r1];b.questionReports.q1=[r1,r2];
  const merged=mergeLearningData(a,b),again=mergeLearningData(merged,b);
  assert.equal(merged.attempts.length,2);assert.equal(merged.mistakeNotes.q1.reason,'new');assert.equal(merged.questionReports.q1.length,2);assert.deepEqual(merged.readSections,{'1.1':true,'1.2':true});assert.deepEqual(merged.readerPositions,{'1.1':200,'1.2':300});assert.deepEqual(again,merged);
});
test('numeric and ISO timestamps keep their actual order in restore, review records and field progress',()=>{
  const older='2026-10-20T00:00:00Z',later=Date.UTC(2026,9,21);
  const a=createEmptyState(),b=exported();
  a.attempts=[attempt({id:'later',at:later,correct:true})];
  b.attempts=[attempt({id:'older',at:older,correct:false})];
  a.completedReviews.q1=older;b.completedReviews.q1=later;
  assert.equal(validateLearningData(b),'');
  const merged=mergeLearningData(a,b);
  assert.deepEqual(merged.attempts.map(item=>item.id),['older','later']);
  assert.equal(merged.completedReviews.q1,later);
  assert.equal(fieldProgress([{id:'q1'}],merged.attempts).correct,1);
});
test('conduction and convection preserve units, zero temperature difference, and heat-flow sign',()=>{
  assert.equal(calculateHeatTransfer('conduction',{k:15,area:.5,thickness:.08,hot:80,cold:20}).watts,5625);
  assert.equal(calculateHeatTransfer('convection',{h:25,area:1,surface:20,fluid:80}).watts,-1500);
  assert.equal(calculateHeatTransfer('conduction',{k:1,area:1,thickness:1,hot:20,cold:20}).watts,0);
});
test('radiation uses kelvin to the fourth power and accepts emissivity zero',()=>{
  const r=calculateHeatTransfer('radiation',{emissivity:'0.85',area:'1',surface:'150',surrounding:'25'});
  assert.equal(r.surfaceK,423.15);assert.ok(Math.abs(r.watts-.85*5.670374419e-8*(423.15**4-298.15**4))<1e-9);
  assert.equal(calculateHeatTransfer('radiation',{emissivity:0,area:1,surface:150,surrounding:25}).watts,0);
  const surface=20.0000000000001,surrounding=20,delta=surface-surrounding;
  const tiny=calculateHeatTransfer('radiation',{emissivity:1,area:1,surface,surrounding});
  const linearLimit=4*5.670374419e-8*(surrounding+273.15)**3*delta;
  assert.ok(Math.abs(tiny.watts/linearLimit-1)<1e-10,'近接した温度では四乗差の桁落ちを避ける');
});
test('series thermal resistance conserves heat and returns interface temperatures and overall U',()=>{
  const v={area:1,hot:80,cold:20,hHot:10,hCold:20,k1:.5,k2:.1,L1:.1,L2:.05};
  const r=calculateHeatTransfer('resistance',v);
  assert.deepEqual(r.resistances,[.1,.2,.5,.05]);assert.ok(Math.abs(r.totalResistance-.85)<1e-12);assert.ok(Math.abs(r.watts-60/.85)<1e-10);
  assert.equal(r.temperatures[0],80);assert.ok(Math.abs(r.temperatures.at(-1)-20)<1e-12);assert.ok(Math.abs(r.overallU-1/.85)<1e-12);
  for(let i=0;i<4;i++)assert.ok(Math.abs((r.temperatures[i]-r.temperatures[i+1])/r.resistances[i]-r.watts)<1e-10);
  assert.equal(calculateHeatTransfer('resistance',{...v,hot:20,cold:80}).watts,-r.watts);
  assert.equal(calculateHeatTransfer('resistance',{...v,hot:20}).watts,0);
  for(const field of ['area','hHot','hCold','k1','k2','L1','L2'])assert.ok(calculateHeatTransfer('resistance',{...v,[field]:0}).error);
  assert.ok(calculateHeatTransfer('resistance',{...v,hot:-273.15}).error);
  assert.ok(calculateHeatTransfer('resistance',{...v,k1:1e-320}).error);
  const exportedData=exported();exportedData.simComparisons.resistance=v;assert.equal(validateLearningData(exportedData),'');
});
test('simulation rejects blanks, missing fields, nonnumbers, impossible temperatures, and overflow',()=>{
  const base={h:25,area:1,surface:80,fluid:20};
  for(const value of ['', '  ',null,true,undefined,NaN,Infinity])assert.ok(calculateHeatTransfer('convection',{...base,fluid:value}).error,String(value));
  assert.ok(calculateHeatTransfer('convection',{...base,fluid:-273.15}).error);
  assert.ok(calculateHeatTransfer('conduction',{k:1,area:1,thickness:0,hot:10,cold:0}).error);
  assert.ok(calculateHeatTransfer('radiation',{emissivity:1.01,area:1,surface:50,surrounding:20}).error);
  assert.ok(calculateHeatTransfer('convection',{...base,h:1e308,area:1e308}).error);
  assert.match(calculateHeatTransfer('conduction',{k:1e-323,area:.1,thickness:1,hot:40,cold:20}).error,/計算精度/);
  assert.match(calculateHeatTransfer('radiation',{emissivity:1e-323,area:1,surface:20.00000000000001,surrounding:20}).error,/計算精度/);
  assert.ok(calculateHeatTransfer('unknown',base).error);
});
test('search includes question titles, Japanese substrings, normalized numbers, and chapter filters',()=>{
  const entries=[{kind:'question',chapter:'7',title:'温度の問題',text:'流速１０ m/s',field:'対流'},{kind:'glossary',chapter:'ch7',title:'熱線風速計',text:'測定',field:'用語集'}];
  assert.equal(chapterKey('7.6'),'ch7');assert.equal(searchEntries(entries,{query:'温度',chapter:'ch7'}).length,1);
  assert.equal(searchEntries(entries,{query:'10',chapter:'ch7'}).length,1);assert.equal(searchEntries(entries,{query:'風速',chapter:'7'}).length,1);
  const snippet=searchSnippet('前'.repeat(500)+'熱抵抗'+'後'.repeat(500),'熱抵抗');assert.ok(snippet.includes('熱抵抗'));assert.ok(snippet.length<245);
  const longTerm='熱移動'.repeat(100),longSnippet=searchSnippet('前'.repeat(500)+longTerm+'後'.repeat(500),longTerm);
  assert.ok(longSnippet.includes(longTerm),'長い一致語も途中で切らずに表示する');
});
test('review spacing uses confidence and consecutive correct history',()=>{
  assert.equal(nextReviewDays([],attempt()),7);assert.equal(nextReviewDays([attempt()],attempt()),14);assert.equal(nextReviewDays([attempt(),attempt()],attempt()),30);
  assert.equal(nextReviewDays([attempt()],attempt({confidence:'low'})),1);assert.equal(nextReviewDays([attempt()],attempt({correct:false})),1);
});
test('calendar clamps month-end and learning dates use local calendar dates',()=>{
  assert.equal(shiftMonth('2026-01-31',1),'2026-02-28');assert.equal(shiftMonth('2028-01-31',1),'2028-02-29');assert.equal(shiftMonth('2026-03-31',-1),'2026-02-28');
  assert.equal(localDay(new Date(2026,9,20,0,15)),'2026-10-20');
});
test('a five-minute plan allocates exactly five minutes',()=>{
  for(const n of [5,10,15,30,60]){const parts=planMinutes(n);assert.equal(parts.reduce((a,b)=>a+b,0),n);assert.ok(parts.every(x=>x>0));}
});

test('revised question answers never inflate field mastery while historical records remain untouched',()=>{
  const original={id:'q1'},revised={id:'q1',revision:'v2'},fresh={id:'q2',revision:'v1'};
  const previous=attempt({questionId:'q1',correct:true,questionRevision:'initial'});
  assert.equal(isCurrentQuestionAnswer(original,previous),true,'Old no-revision content accepts legacy initial answers');
  assert.equal(isCurrentQuestionAnswer(revised,previous),false);
  const historical=[previous,attempt({id:'a2',questionId:'q2',correct:true,questionRevision:'v1'})];
  const before=JSON.stringify(historical);
  const stale=fieldProgress([revised,fresh],historical);
  assert.equal(stale.answered,1);
  assert.equal(stale.correct,1);
  assert.equal(stale.outdated,1);
  assert.equal(stale.enough,false);
  const rerun=attempt({id:'a3',questionId:'q1',correct:false,questionRevision:'v2',at:'2026-10-28T10:00:00Z'});
  const current=fieldProgress([revised,fresh],[...historical,rerun]);
  assert.equal(current.answered,2);
  assert.equal(current.correct,1);
  assert.equal(current.outdated,0);
  assert.equal(current.ratio,0.5);
  assert.equal(JSON.stringify(historical),before,'Previous learning history is never edited');
  const bad=exported();
  bad.attempts=[attempt({questionRevision:{version:'v2'}})];
  assert.match(validateLearningData(bad),/回答履歴/,'Invalid imported revision metadata must be rejected');
  bad.attempts=[attempt({questionRevision:'initial'})];
  assert.equal(validateLearningData(bad),'','Valid imported revision data remains supported');
  bad.attempts=[attempt({questionRevision:undefined})];
  assert.equal(validateLearningData(bad),'','Older exports without revision are still accepted');

  assert.equal(isCurrentQuestionAnswer({id:'q3'},attempt({questionId:'q3',questionRevision:undefined})),true);
});

test('import rejects duplicate ids and normalize heals them without double counting (R1-P2-06/R1-P2-07)',()=>{
  const activity=(id,seconds)=>({id,date:'2026-10-19',kind:'reading',seconds,sectionId:'1.1',updatedAt:'2026-10-19T15:15:00.000Z'});
  const dupActivities=exported();dupActivities.activities=[activity('t1',600),activity('t1',600)];
  assert.match(validateLearningData(dupActivities),/学習時間の記録に重複/);
  const healed=normalizeLearningData(dupActivities);
  assert.equal(healed.activities.length,1);assert.equal(healed.activities[0].seconds,600);
  const dupAttempts=exported();dupAttempts.attempts=[attempt(),attempt({questionId:'q2'})];
  assert.match(validateLearningData(dupAttempts),/回答履歴に重複/);
  const session=(id)=>({id,date:'2026-10-19',total:1,correct:1,startedAt:'2026-10-19T15:00:00.000Z',answers:[]});
  const dupSessions=exported();dupSessions.sessions=[session('s1'),session('s1')];
  assert.match(validateLearningData(dupSessions),/学習セッションに重複/);
  assert.equal(normalizeLearningData(dupSessions).sessions.length,1);
  const note=(id)=>({id,text:'メモ',sectionId:'1.1',createdAt:'2026-10-19T15:15:00.000Z'});
  const dupNotes=exported();dupNotes.notes=[note('n1'),note('n1')];
  assert.match(validateLearningData(dupNotes),/学習メモに重複/);
  assert.equal(normalizeLearningData(dupNotes).notes.length,1);
  const ok=exported();ok.activities=[activity('t1',600),activity('t2',300)];ok.sessions=[session('s1')];ok.notes=[note('n1')];
  assert.equal(validateLearningData(ok),'');
});
