import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as core from '../study-core.mjs';
import * as guide from '../guide.mjs';
import * as curriculum from '../chapter-curriculum.mjs';
import * as originalNotesModule from '../original-notes.mjs';
import * as deepNotesModule from '../original-deep-lessons.mjs';
import * as termModule from '../term-links.mjs';
import * as visualModule from '../sim-diagrams.mjs';
import * as dynamicNavigation from '../dynamic-navigation.mjs';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
const key='heat-study-ja:v1';
const question={id:'q1',prompt:'テスト用に作成した問題',choices:['答え','誤答1','誤答2','誤答3'],answer:0,field:'伝導',difficulty:'基礎',source:{section:'1.1'},explanation:'説明',distractors:['正解','理由1','理由2','理由3']};
function harness(initial) {
  const store=new Map(initial?[[key,initial]]:[]);let fail=false,failKey='',rendered=0,submitted=0,reloaded=0;
  const root={innerHTML:''},document={querySelector:s=>s==='#app'?root:s==='#quiz-answer-form'?{requestSubmit(){submitted++;}}:null,querySelectorAll:()=>Array.from({length:4},()=>({focus(){}})),documentElement:{dataset:{},style:{setProperty(){}}},body:{append(){}},createElement:()=>({setAttribute(){},remove(){}})};
  const context=vm.createContext({...core,...guide,...curriculum,...originalNotesModule,...deepNotesModule,...termModule,...visualModule,...dynamicNavigation,structuredClone,JSON,Date,Math,Intl,Map,Set,Number,String,Array,Boolean,RegExp,Blob,URL,crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},document,window:{matchMedia:()=>({matches:false}),scrollTo(){},confirm:()=>true,location:{reload(){reloaded++;}}},location:{hash:''},navigator:{onLine:true},setTimeout:()=>1,clearTimeout(){},localStorage:{getItem:k=>store.get(k)||null,setItem(k,v){if((fail&&k===key)||k===failKey)throw Error('quota');store.set(k,v);},removeItem(k){store.delete(k);}},FormData:class{constructor(v){this.values=v.values??v;}get(k){return this.values[k]??null;}}});
  vm.runInContext(source.replace(/^import .*?;\s*/gm,'').replace(/\nstartApp\(\);\s*$/,'')+`
    render=()=>{globalThis.renderCount=(globalThis.renderCount||0)+1;};showStatus=message=>{globalThis.statusMessage=message;};
    globalThis.api={get state(){return state;},set state(v){state=v;},get ui(){return ui;},set ui(v){ui={...ui,...v};},set questions(v){questionBank=v;},set book(v){book=v;},set terms(v){glossary=v;},set deepLessons(v){deepLessons=v;},submitQuizAnswer,reviewCandidates,validateImport,importData,exportData,exportBackup,saveState,savePlan,setReviewDate,onClick,onChange,formatHeatRate,buildSearchIndex,onKeyDown,renderBookBlock,renderQuestionFigure,renderGlossary,renderAnswerFeedback,renderDeepLesson,linkedQuizText,renderQuiz,openTermSheet,closeTermSheet,sourcePdfPage,sourcePdfLink,blockSourceLabel,figureZoomLink,renderSimulationSteps,simGraph,validBookBlocks,sectionIsTranslated,createProfile,get warning(){return storageIssue;},get status(){return globalThis.statusMessage;}};`,context);
  const api=context.api;api.questions=[question];api.book={pdfPageCount:810,chapters:[{id:'ch1',title:'章',sections:[{id:'1.1',title:'本文',bookStart:3,bookEnd:4,pdfStart:17,pdfEnd:18,blocks:[{id:'b1',type:'paragraph',text:'検索する語',bookPage:3,pdfPage:17}]}]}]};api.terms=[{id:'term',ja:'熱',en:'heat',meaning:'温度による移動',source:{section:'1.1'}}];
  return {api,store,context,setFail:v=>fail=v,setFailKey:v=>failKey=v,get submitted(){return submitted;},get reloaded(){return reloaded;}};
}
test('quiz links terms in stems, choices, detailed explanations and hints without changing stored answer',async()=>{
 const h=harness();
 h.api.terms=JSON.parse(await readFile(new URL('../data/glossary.json',import.meta.url),'utf8'));
 h.api.questions=[{...question,prompt:'熱流束と温度勾配の関係は？',choices:['熱流束','温度勾配','熱伝導率','ニュートンの冷却法則'],explanation:'温度勾配からフーリエの法則を選ぶ。',solutionSteps:['熱流束の単位はW/m²。'],distractors:['温度勾配との関係。','熱伝導率の意味。','熱流束を確認。','熱伝達率と違う。']}];
 h.api.ui={quiz:{id:'test',ids:['q1'],index:0,answers:[],selected:1,confidence:'medium',hintCount:1,mode:'single'}};
 const quiz=h.api.renderQuiz();
 for(const id of ['heat-flux','temperature-gradient','thermal-conductivity'])
  assert.ok(quiz.includes('data-term-id="'+id+'"'),id);
 assert.match(quiz,/class="inline-term"/);
 assert.match(quiz,/aria-haspopup="dialog"/);
 assert.match(h.api.linkedQuizText('<script>alert(1)<\/script>熱流束'),/&lt;script&gt;/);
 assert.equal(h.api.ui.quiz.selected,1,'opening a definition must not change the chosen answer');
 const answer=h.api.renderAnswerFeedback(h.api.questions?.[0]||{...question,prompt:'熱流束',explanation:'熱流束',distractors:['熱流束','熱流束','熱流束','熱流束']},{correct:true,confidence:'medium',at:'2026-10-28T10:00:00Z'},{},[0,1,2,3]);
 assert.match(answer,/data-term-id="heat-flux"/);
});
test('answer handling stores correctness, chosen text, confidence and next review exactly once',()=>{
  const h=harness();h.api.ui={quiz:{ids:['q1'],index:0,answers:[],selected:0,confidence:'low',mode:'single'}};
  h.api.submitQuizAnswer({});h.api.submitQuizAnswer({});
  assert.equal(h.api.state.attempts.length,1);assert.equal(h.api.state.attempts[0].correct,true);assert.equal(h.api.state.attempts[0].selectedText,'答え');assert.equal(h.api.state.reviews.q1.suggestedDays,1);assert.ok(h.api.reviewCandidates()[0].reasons.includes('正解したが自信が低い'));
});
test('a revised problem is due for re-answer and high-confidence streak restarts from zero',()=>{
  const h=harness();
  h.api.questions=[{...question,revision:'v2'}];
  h.api.state.attempts=[
    {id:'old-1',questionId:'q1',correct:true,confidence:'high',questionRevision:'v1',at:'2026-10-20T00:00:00Z'},
    {id:'old-2',questionId:'q1',correct:true,confidence:'high',questionRevision:'v1',at:'2026-10-21T00:00:00Z'}
  ];
  const candidates=h.api.reviewCandidates();
  assert.equal(candidates.length,1);
  assert.ok(candidates[0].reasons.includes('問題改訂後の再回答が必要'));
  h.api.ui={quiz:{ids:['q1'],index:0,answers:[],selected:0,confidence:'high',mode:'single'}};
  h.api.submitQuizAnswer({});
  const current=h.api.state.attempts.at(-1);
  assert.equal(current.questionRevision,'v2');
  assert.equal(h.api.state.attempts.length,3,'Old revision records are retained');
  assert.equal(h.api.state.reviews.q1.suggestedDays,7,'Revised question must start a new review streak');
  assert.equal(h.api.reviewCandidates().length,0,'A valid current-revision answer clears the stale-answer recommendation');
});
test('incorrect and invalid selections cannot become correct records',()=>{
  const h=harness();h.api.ui={quiz:{ids:['q1'],index:0,answers:[],selected:7,confidence:'high'}};h.api.submitQuizAnswer({});assert.equal(h.api.state.attempts.length,0);
  h.api.ui.quiz.selected=1;h.api.submitQuizAnswer({});assert.equal(h.api.state.attempts[0].correct,false);assert.ok(h.api.reviewCandidates()[0].reasons.includes('直近の誤答'));
});
test('one successful high-confidence answer is not called a weak area',()=>{
  const h=harness();h.api.state.attempts=[{questionId:'q1',correct:true,confidence:'high',at:new Date().toISOString()}];assert.equal(h.api.reviewCandidates().length,0);
});
test('review completion is compared by instant across time zones',()=>{
  const h=harness();
  h.api.state.attempts=[{questionId:'q1',correct:false,confidence:'low',at:'2026-10-21T09:00:00+09:00'}];
  h.api.state.reviews.q1={dueDate:'2099-10-21',lastReviewedAt:'2026-10-20T20:00:00-05:00'};
  assert.equal(h.api.reviewCandidates().length,0);
  h.api.state.attempts=[{questionId:'q1',correct:false,confidence:'low',at:'2026-10-20T23:00:00-05:00'}];
  h.api.state.reviews.q1.lastReviewedAt='2026-10-21T01:00:00Z';
  assert.ok(h.api.reviewCandidates()[0].reasons.includes('直近の誤答'));
});
test('numeric legacy timestamps retain the correct review day and completion order',()=>{
  const h=harness(),answeredAt=Date.UTC(2026,9,21,9),completedAt=answeredAt+3600000;
  h.api.state.attempts=[{questionId:'q1',correct:false,confidence:'low',at:answeredAt}];
  assert.equal(h.api.reviewCandidates()[0].due,core.localDay(new Date(answeredAt+86400000)));
  h.api.state.reviews.q1={dueDate:'2099-10-21',lastReviewedAt:completedAt};
  assert.equal(h.api.reviewCandidates().length,0);
  h.api.state.reviews.q1.lastReviewedAt=answeredAt-3600000;
  assert.ok(h.api.reviewCandidates()[0].reasons.includes('直近の誤答'));
});

test('clearing a review date preserves valid saved data, and valid changes have a merge timestamp',()=>{
  const h=harness();h.api.state.reviews.q1={dueDate:'2026-10-22',suggestedDays:3};h.api.saveState();const before=JSON.stringify(h.api.state);
  h.api.setReviewDate('q1','');assert.equal(JSON.stringify(h.api.state),before);assert.equal(h.store.get(key),before);
  h.api.setReviewDate('q1','2026-10-30');assert.equal(h.api.state.reviews.q1.dueDate,'2026-10-30');assert.ok(h.api.state.reviews.q1.updatedAt);assert.equal(core.validateLearningData({...h.api.state,format:core.DATA_FORMAT}),'');
});
test('an impossible plan date cannot poison the saved learning record',()=>{
  const h=harness();h.api.state.plan.goal='以前の目標';h.api.saveState();const before=h.store.get(key);
  h.api.savePlan({values:{goal:'新しい目標',targetDate:'2099-02-30',minutesPerDay:'15'}});
  assert.equal(h.store.get(key),before);assert.equal(h.api.state.plan.goal,'以前の目標');
  assert.match(h.api.status,/実在する日付/);
  h.api.savePlan({values:{goal:'新しい目標',targetDate:'2099-02-28',minutesPerDay:'15'}});
  assert.equal(JSON.parse(h.store.get(key)).plan.targetDate,'2099-02-28');
  assert.equal(core.validateLearningData(JSON.parse(h.store.get(key)),{stored:true}),'');
});
test('a nonzero but small simulator result is not rounded to zero on screen',()=>{
  const h=harness();
  assert.equal(h.api.formatHeatRate(0),'0');
  assert.equal(h.api.formatHeatRate(-0),'0');
  assert.equal(h.api.formatHeatRate(0.0005),'5.000×10⁻⁴');
  assert.equal(h.api.formatHeatRate(-0.0005),'-5.000×10⁻⁴');
  assert.equal(h.api.formatHeatRate(1e9),'1.000×10⁹');
  assert.equal(h.api.formatHeatRate(0.125),'0.125');
});
test('restore is atomic when storage fails and malformed nested data are rejected again',()=>{
  const h=harness();h.api.state.mistakeNotes.q1={reason:'keep'};const before=JSON.stringify(h.api.state);h.api.saveState();
  h.api.ui.importDraft={data:{...core.createEmptyState(),format:core.DATA_FORMAT,notes:null}};h.api.importData(false);assert.equal(JSON.stringify(h.api.state),before);
  h.store.set(`${key}:before-import`,'previous-backup');
  h.api.ui.importDraft={data:{...core.createEmptyState(),format:core.DATA_FORMAT,mistakeNotes:{q1:{reason:'replace'}}}};h.setFail(true);h.api.importData(true);
  assert.equal(JSON.stringify(h.api.state),before);assert.equal(h.store.get(key),before);assert.ok(h.api.ui.importDraft.error.includes('中止'));
  assert.equal(h.store.get(`${key}:before-import`),'previous-backup');
  h.store.delete(`${key}:before-import`);h.api.ui.importDraft={data:{...core.createEmptyState(),format:core.DATA_FORMAT}};h.api.importData(true);
  assert.equal(h.store.has(`${key}:before-import`),false);
});
test('adding two valid backups cannot exceed the saved-record limit or alter the current record',()=>{
  const h=harness(),at='2026-10-20T00:00:00Z';
  const bookmarks=(prefix)=>Array.from({length:10001},(_,i)=>({id:`${prefix}-${i}`,sectionId:'1.1',note:'',createdAt:at}));
  h.api.state.bookmarks=bookmarks('existing');h.api.saveState();
  const before=h.store.get(key),backup='older-backup';h.store.set(`${key}:before-import`,backup);
  const incoming={...core.createEmptyState(),format:core.DATA_FORMAT,bookmarks:bookmarks('incoming')};
  assert.equal(core.validateLearningData(incoming),'');
  h.api.ui.importDraft={data:incoming};h.api.importData(false);
  assert.match(h.api.ui.importDraft.error,/件数の範囲を超える/);
  assert.equal(h.api.state.bookmarks.length,10001);
  assert.equal(h.store.get(key),before);
  assert.equal(h.store.get(`${key}:before-import`),backup);
});
test('failed JSON download offers the current record or saved recovery text for copying',()=>{
  const h=harness();h.context.URL={createObjectURL(){throw Error('download-unavailable');}};
  h.api.state.plan.goal='手動で保管する計画';
  h.api.exportData();
  assert.equal(JSON.parse(h.api.ui.exportJSON).plan.goal,'手動で保管する計画');
  assert.match(h.api.status,/ダウンロードを開始できませんでした/);
  h.store.set(`${key}:recovery`,'{damaged-json');
  h.api.exportBackup('recovery');
  assert.equal(h.api.ui.exportJSON,'{damaged-json');
  assert.match(h.api.status,/コピーして保管/);
});
test('corrupt original data also has a manual-copy path when its download is blocked',()=>{
  const h=harness('{damaged-original');h.context.URL={createObjectURL(){throw Error('download-unavailable');}};
  h.api.onClick({target:{closest:selector=>selector==='[data-action]'?{dataset:{action:'export-recovery'}}:null}});
  assert.equal(h.api.ui.exportJSON,'{damaged-original');
  assert.match(h.api.status,/コピーして保管/);
  assert.equal(h.store.get(key),'{damaged-original');
});
test('a failed bookmark-note save cannot claim the note was stored',()=>{
  const h=harness();h.api.state.bookmarks=[{id:'b1',sectionId:'1.1',note:'以前のメモ',createdAt:'2026-10-20T00:00:00Z'}];h.api.saveState();
  const before=h.store.get(key);h.setFail(true);
  h.api.onChange({target:{dataset:{bookmarkNote:'b1'},value:'新しいメモ'}});
  assert.match(h.api.status,/保存できませんでした/);assert.equal(h.store.get(key),before);
});
test('a stale tab cannot overwrite another tab through normal saving or JSON restore',()=>{
  const h=harness();
  h.api.state.notes=[{id:'local',text:'このタブのメモ',sectionId:'1.1',createdAt:new Date().toISOString()}];
  const remote={...core.createEmptyState(),readSections:{'1.1':true}};
  const remoteRaw=JSON.stringify(remote);
  h.store.set(key,remoteRaw);
  assert.equal(h.api.saveState(),false);
  assert.equal(h.store.get(key),remoteRaw);
  assert.match(h.api.warning,/別のタブ/);
  h.api.ui.importDraft={data:{...core.createEmptyState(),format:core.DATA_FORMAT}};
  h.api.importData(true);
  assert.equal(h.store.get(key),remoteRaw);
  assert.match(h.api.ui.importDraft.error,/別のタブ/);
  assert.equal(h.api.state.notes[0].text,'このタブのメモ');
});
test('corrupt persisted data are retained for recovery rather than silently discarded',()=>{
  const h=harness('{bad-json');assert.equal(h.store.get(`${key}:recovery`),'{bad-json');assert.equal(h.store.get(key),'{bad-json');assert.ok(h.api.warning.includes('元データ'));
});
test('failed profile activation keeps the legacy learning record and rolls back the profile list',()=>{
  const h=harness();h.api.state.notes=[{id:'n1',text:'元のメモ',sectionId:'1.1',createdAt:new Date().toISOString()}];
  h.setFailKey('heat-study-ja:active-profile:v1');
  h.api.createProfile({values:{profileName:'別の学習者'}});
  assert.equal(JSON.parse(h.store.get(key)).notes[0].text,'元のメモ');
  assert.equal(h.store.has('heat-study-ja:profiles:v1'),false);
  assert.equal(h.reloaded,0);
});
test('search index gives book blocks, terms, questions and notes consistent chapter keys',()=>{
  const h=harness();h.api.state.notes=[{id:'n',sectionId:'1.1',text:'熱のメモ',title:'メモ',createdAt:new Date().toISOString()}];const entries=h.api.buildSearchIndex();
  const found=core.searchEntries(entries,{query:'熱',chapter:'ch1'});assert.ok(found.some(e=>e.kind==='glossary'));assert.ok(found.some(e=>e.kind==='memo'));
  assert.equal(entries.find(e=>e.text==='検索する語').target.blockId,'b1');
});
test('search indexes published advanced Japanese physics lessons including derivations, units and limits, but does not claim translation',async()=>{
 const h=harness();
 const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
 h.api.book=await read('data/book.json');
 const deepLessons=await read('data/original-deep-lessons.json');
 h.api.deepLessons=deepLessons;
 const entries=h.api.buildSearchIndex().filter(x=>x.kind==='deep-lesson');
 assert.equal(entries.length,deepLessons.lessons.reduce((sum,lesson)=>sum+1+lesson.blocks.length+lesson.equations.length+2,0));
 const diffusion=core.searchEntries(entries,{query:'Stefan流',kind:'deep-lesson',chapter:'ch11'});
 assert.ok(diffusion.some(entry=>entry.target.section==='11.3'));
 assert.ok(diffusion.some(entry=>entry.target.section==='11.5'),'the new stationary-medium lecture remains searchable alongside Fick law');
 assert.ok(diffusion.every(entry=>deepLessons.lessons.some(l=>l.sectionId===entry.target.section&&l.sectionId.startsWith('11.'))&&entry.target.route==='reader'&&entry.target.language==='ja'&&entry.target.blockId));
 assert.ok(diffusion.every(entry=>entry.source.includes('外部専門家校閲前')));
 assert.ok(entries.some(entry=>entry.target.section==='11.3'&&entry.text.includes('N_A=')));
 const conduction=core.searchEntries(entries,{query:'Dirichlet',kind:'deep-lesson',chapter:'ch2'});
 assert.ok(conduction.length>=1);
 assert.ok(conduction.every(entry=>entry.target.section==='2.1'));
 assert.equal(core.searchEntries(entries,{query:'Dirichlet',kind:'book'}).length,0,
   'independent instruction must not be represented as a translated source chapter');
});
test('reader highlights the exact independent lesson search match without treating it as book text',async()=>{
 const h=harness();
 const lessons=JSON.parse(await readFile(new URL('../data/original-deep-lessons.json',import.meta.url),'utf8'));
 const target=lessons.lessons.find(l=>l.sectionId==='11.3');
 assert.ok(target);
 h.api.ui={readerQuery:'Stefan流'};
 const rendered=h.api.renderDeepLesson(target);
 assert.match(rendered,/<mark>Stefan流<\/mark>/);
 assert.match(rendered,/原本の全文翻訳ではありません。外部専門家校閲前。/);
 assert.match(rendered,/href="https:\/\//);
 assert.ok(!rendered.includes('<script'),'No input can insert executable code into lesson');
 h.api.ui={readerQuery:'<script>alert(1)</script>'};
 const safe=h.api.renderDeepLesson(target);
 assert.ok(!safe.includes('<script>'));
});
test('formula meanings and Japanese figure descriptions appear in the reader',()=>{
  const h=harness();assert.match(h.api.renderBookBlock({type:'formula',expression:'Q=kAΔT/L',text:'厚さと熱伝導率の説明'}),/厚さと熱伝導率/);
  assert.match(h.api.renderBookBlock({type:'figure',src:'local.png',caption:'図',text:'日本語の図の説明'}),/日本語の図の説明/);
});
test('source ranges distinguish book and PDF pages, and figure links reject external or unsafe paths',()=>{
  const h=harness();assert.equal(h.api.blockSourceLabel({bookPage:418,endBookPage:419,pdfPage:432,endPdfPage:433}),'書籍 p.418–419 · PDF p.432–433');
  assert.match(h.api.figureZoomLink('data/local/figures/fig8-4-439.png'),/noopener noreferrer/);
  assert.match(h.api.figureZoomLink('./data/figures/fig1-1-021.png'),/href="\.\/data\/figures\/fig1-1-021\.png"/);
  for(const src of ['https://example.com/a.png','javascript:alert(1)','data/local/figures/../../a.png','data/local/figures/a.png" onload="x'])assert.equal(h.api.figureZoomLink(src),'');
});
test('book source links open the cited public PDF page even when translated text is unavailable',()=>{
  const h=harness();h.api.terms=[{id:'term',ja:'熱',en:'heat',meaning:'温度による移動',availableInApp:false,source:{section:'1.1',bookPages:'3–6',pdfPages:'17–20'}}];
  const glossary=h.api.renderGlossary();
  assert.match(glossary,/原書の翻訳本文は読書画面に収録しています/);
  assert.doesNotMatch(glossary,/原書の翻訳本文は未収録です/);
  assert.match(glossary,/アプリ内の日本語訳は未収録/);
  assert.match(glossary,/href="\.\/book\/AHTTv600\.pdf#page=17"/);
  h.api.state.settings.contentLanguage='en';
  const englishGlossary=h.api.renderGlossary();
  assert.match(englishGlossary,/id="term-term" lang="ja"><div class="term-heading"><h2 lang="en">heat<\/h2>/);
  assert.match(englishGlossary,/<p lang="ja">温度による移動<\/p>/);
  assert.equal(h.api.sourcePdfPage({pdfPages:'21'}, {pdfStart:17}),21);
  assert.equal(h.api.sourcePdfPage({pdfPages:'9999'},null),null);
  assert.equal(h.api.sourcePdfPage({pdfPages:'invalid'}, {pdfStart:17}),null);
  const bookQuestion={...question,source:{type:'book',section:'1.1',bookPages:'4',pdfPages:'18',equation:'1.8'}};
  const feedback=h.api.renderAnswerFeedback(bookQuestion,{correct:true,confidence:'high',at:'2026-10-21T00:00:00Z'},{},[0,1,2,3]);
  assert.match(feedback,/式（1\.8）/);
  assert.match(feedback,/href="\.\/book\/AHTTv600\.pdf#page=18"/);
});
test('figure dimensions from content files cannot inject image attributes',()=>{
  const h=harness(),figure={src:'./data/figures/fig1-1-021.png',alt:'図',caption:'図1.1',width:'50" onerror="alert(1)',height:30};
  for(const html of [h.api.renderBookBlock({type:'figure',...figure}),h.api.renderQuestionFigure({kind:'book',...figure})])assert.doesNotMatch(html,/\sonerror=/);
  const sized=h.api.renderBookBlock({type:'figure',...figure,width:'640',height:'480'});
  assert.match(sized,/width="640" height="480"/);
});
test('an empty, unknown or malformed section cannot be counted as readable content',()=>{
  const h=harness();
  assert.equal(h.api.sectionIsTranslated({blocks:[]}),false);
  for(const blocks of [[],[null],[{type:'unknown',text:'本文'}],[{type:'paragraph',id:'same',text:'一'},{type:'paragraph',id:'same',text:'二'}],[{type:'table',headers:['列'],rows:[null]}],[{type:'figure',src:'./data/figures/a.png',alt:''}],[{type:'figure',src:'https://example.com/a.png',alt:'図'}],[{type:'problem',text:'問題',figure:{src:'./data/figures/a.png'}}]])assert.equal(h.api.validBookBlocks(blocks),false);
  assert.equal(h.api.validBookBlocks([{type:'paragraph',text:'本文'},{type:'table',headers:['列'],rows:[['値']]}]),true);
  assert.match(core.validateQuestion({...question,figure:{kind:'book',src:'https://example.com/a.png',alt:'図'}}),/端末内/);
  assert.doesNotMatch(h.api.renderQuestionFigure({kind:'book',src:'https://example.com/a.png',alt:'図',caption:'図'}),/<img/);
});
test('all simulator step displays retain finite values, units and supplemental labels',()=>{
  const h=harness(),inputs={conduction:{k:15,area:.5,thickness:.08,hot:80,cold:20},convection:{h:25,area:1,surface:80,fluid:20},radiation:{emissivity:.85,area:1,surface:150,surrounding:25},resistance:{area:1,hot:80,cold:20,hHot:10,hCold:20,k1:.5,k2:.1,L1:.1,L2:.05}};
  for(const [mode,values] of Object.entries(inputs)){const html=h.api.renderSimulationSteps(mode,core.calculateHeatTransfer(mode,values));assert.match(html,/補足説明/);assert.match(html,/W/);assert.doesNotMatch(html,/NaN|Infinity|undefined/);}
});
test('radiation comparison keeps both physical curves and the current point in view near absolute zero',()=>{
  const h=harness();
  const current=core.calculateHeatTransfer('radiation',{emissivity:.8,area:1,surface:0,surrounding:100});
  const nearZero={emissivity:.8,area:1,surface:-273.13,surrounding:-273.14};
  const html=h.api.simGraph('radiation',current,nearZero);
  const cx=Number(html.match(/<circle cx="([^"]+)"/)[1]);
  const baseline=html.match(/<path d="([^"]*)" class="chart-baseline"/)[1];
  assert.ok(cx>=66&&cx<=540,`current point x=${cx}`);
  assert.ok((baseline.match(/L/g)||[]).length>=30);
  assert.doesNotMatch(html,/NaN|Infinity/);
});
test('formula presentation retains source strings while typesetting simple indices, powers and mean bars safely',()=>{
  const h=harness(),block={type:'formula',expression:'N̅u̅_L = 0.678 Ra_L^(1/4) [Pr/(0.952+Pr)]^(−4/9)',alt:'平均ヌセルト数'};
  const original=block.expression,html=h.api.renderBookBlock(block);assert.match(html,/<span class="math-overline">Nu<\/span><sub>L<\/sub>/);assert.match(html,/<sup>1\/4<\/sup>/);assert.match(html,/<sup>−4\/9<\/sup>/);assert.equal(block.expression,original);
  assert.ok(!h.api.renderBookBlock({type:'formula',expression:'<img src=x onerror="x()">'}).includes('<img'));
});
test('quiz number keys work after focusing a choice and do not capture text editing',()=>{
  const h=harness();h.api.ui={route:'quiz',quiz:{ids:['q1'],index:0,answers:[],selected:0}};let prevented=0;
  const event={key:'3',target:{matches:s=>s.includes('choice')||s==='input,textarea,select,[contenteditable="true"]'},preventDefault(){prevented++;}};
  h.api.onKeyDown(event);assert.equal(h.api.ui.quiz.selected,2);assert.equal(prevented,1);
  h.api.onKeyDown({...event,key:'1',target:{matches:s=>s==='input,textarea,select,[contenteditable="true"]'}});assert.equal(h.api.ui.quiz.selected,2);
  h.api.onKeyDown({...event,key:'Enter',target:{matches:()=>false,closest:()=>null}});assert.equal(h.submitted,1);
});
