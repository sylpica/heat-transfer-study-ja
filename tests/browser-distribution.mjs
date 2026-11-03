// Checks the exact public Pages artifact, where book text and original figures are absent.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startServer} from '../scripts/serve.mjs';
import {GUIDE_SECTIONS} from '../guide.mjs';

const require=createRequire(import.meta.url);
const questionCount=JSON.parse(await readFile(new URL('../data/questions.json',import.meta.url),'utf8')).length;
const engines=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.BROWSER_ENGINE||'chromium';
assert.ok(['chromium','firefox','webkit'].includes(engine),`未対応ブラウザー: ${engine}`);
const root=join(dirname(fileURLToPath(import.meta.url)),'../dist');
const liveBase=process.env.PUBLIC_BASE_URL;
const ignoreCert=process.env.BROWSER_IGNORE_CERT_ERRORS==='1';
const server=liveBase?null:await startServer({root,port:0});
let browser;
try {
  browser=await engines[engine].launch({headless:true,
    ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:engine==='chromium'&&existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),
    args:engine==='chromium'?['--no-sandbox',...(ignoreCert?['--ignore-certificate-errors']:[])]:[]});
  const context=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:ignoreCert});
  const page=await context.newPage();
  const errors=[],external=[];
  const base=liveBase?new URL(liveBase).href:`http://127.0.0.1:${server.address().port}`;
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(!request.url().startsWith(base))external.push(request.url());});
  const nav=route=>page.locator(`.main-nav a[href="#${route}"]`).click();
  const readerContrast=()=>page.evaluate(()=>{
    const rgb=value=>(value.match(/\d+(?:\.\d+)?/g)||[]).slice(0,3).map(Number);
    const luminance=color=>rgb(color).map(channel=>{const x=channel/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
    const item=document.querySelector('.reader-toc .toc-item.selected'),background=luminance(getComputedStyle(item).backgroundColor);
    return [...item.querySelectorAll('.toc-number, span:nth-child(2), i')].map(element=>{const foreground=luminance(getComputedStyle(element).color);return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);});
  });
  // B-12 replaced the window.confirm shown when a new set replaces a
  // suspended one with an in-app dialog; confirm it like a learner would.
  const confirmQuizReplacement=async()=>{
    await page.waitForFunction(()=>document.querySelector('.question-card')||document.querySelector('.quiz-start-modal [data-action="confirm-quiz-start"]'));
    const replace=page.locator('.quiz-start-modal [data-action="confirm-quiz-start"]');
    if(await replace.count())await replace.click();
  };
  await page.goto(base);
  await page.locator('.app-shell').waitFor();
  if(!liveBase){
    const workerResponse=await page.request.get(base+'/sw.js');
    assert.equal(workerResponse.status(),200);
    const workerSource=await workerResponse.text();
    assert.match(workerSource,/const CACHE_NAME='heat-study-ja-app-[0-9a-f]{16}';/,
      'newly published text and questions must give existing offline users a new worker version');
    assert.match(workerSource,/const PDF_CACHE_NAME='heat-study-ja-pdf-[0-9a-f]{16}';/,
      'PDF cache name must derive from the shipped PDF hash: unchanged PDFs keep the learner-saved cache across app revisions, replaced PDFs get a fresh cache');
  }
  assert.match(await page.locator('.app-footer').innerText(),/76節に独自日本語ノート・発展教材・図解を収録/);
  await nav('reader');
  await page.locator('.reader-toc .toc-item.selected').waitFor({state:'attached'});
  assert.ok((await readerContrast()).every(value=>value>=4.5),'目次の選択行の文字コントラスト');
  await page.locator('#reader-article a[href="#guide/chapter1-energy-balance"]').first().waitFor({state:"attached"});
  await page.locator('#reader-original-note').waitFor({state:'visible'});
  assert.match(await page.locator('#reader-original-note').innerText(),/独立執筆・学術校閲前/);
  assert.match(await page.locator('#reader-original-note').innerText(),/原本の翻訳、節の全文掲載、図表の転載ではありません/);
  await page.locator('#reader-original-note summary').click();
  assert.match(await page.locator('#reader-original-note').innerText(),/WとJ/);
  await page.locator('#reader-original-note [data-start-question="supp-applied-1-1-v1"]').waitFor({state:'visible'});
  await page.locator('#reader-original-note [data-start-question="supp-applied-1-1-v1"]').click();
  await page.locator('.question-card').waitFor({state:'visible'});
  assert.match(await page.locator('.question-card').innerText(),/0\.08 m².*0\.02 m²/s);
  await page.locator('[data-action="exit-quiz"]').click();
  await page.locator('[data-action="discard-quiz"]').click();
  await nav('reader');
  await page.locator('#reader-original-note').waitFor({state:'visible'});


  assert.match(await page.locator('#reader-article').innerText(),/原本の翻訳・節本文ではありません/);
  assert.ok((await page.locator('.brand').getAttribute('aria-label')).includes('熱移動を学ぶ'));
  assert.ok((await page.locator('.not-translated a[href*="AHTTv600.pdf"]').getAttribute('aria-label')).includes('原本PDFを開く'));
  for(const action of ['reader-font-down','reader-font-up']){
    const button=page.locator(`[data-action="${action}"]`);
    assert.ok((await button.getAttribute('aria-label')).includes(await button.innerText()));
  }
  assert.equal(await page.locator('.reader-toc .toc-item:not(.not-ready)').count(),0);
  assert.match(await page.locator('.not-translated').innerText(),/公開していません/);
  assert.match(await page.locator('.not-translated a[href*="AHTTv600.pdf"]').getAttribute('href'),/AHTTv600\.pdf#page=17$/);
  assert.equal(await page.locator('.reader-toc .toc-item.selected').getAttribute('data-section'),'1.1');
  await page.locator('[data-action="toggle-read"]').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1'))?.readSections?.['1.1']===true);
  assert.match(await page.locator('[data-action="toggle-read"]').innerText(),/読了に記録済み/);
  await page.locator('#bookmark-note').fill('原本の対応箇所');
  await page.locator('#bookmark-form button[type="submit"]').click();
  await page.locator('#reader-note-form textarea').fill('原本を読んだ後に自分で確認する。');
  await page.locator('#reader-note-form button[type="submit"]').click();
  const readingRecord=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('heat-study-ja:v1'));return {read:s.readSections['1.1'],bookmark:s.bookmarks[0],note:s.notes[0]};});
  assert.equal(readingRecord.read,true,'read completion must survive subsequent bookmark and note writes: '+JSON.stringify(readingRecord));
  assert.equal(readingRecord.bookmark.bookPage,3);
  assert.equal(readingRecord.note.sectionId,'1.1');
  await page.locator('.reader-pager [data-section="1.2"]').click();
  assert.match(await page.locator('.not-translated a[href*="AHTTv600.pdf"]').getAttribute('href'),/AHTTv600\.pdf#page=20$/);
  await page.locator('.reader-toc [data-section="1.3"]').click();
  assert.match(await page.locator('.not-translated').innerText(),/旧PC.*下書き.*未移行/s);
  assert.match(await page.locator('.not-translated a[href*="AHTTv600.pdf"]').getAttribute('href'),/AHTTv600\.pdf#page=25$/);
  await page.waitForFunction(()=>document.querySelector('#pdf-cache-status')?.textContent.includes('未保存'));
  await nav('home');
  assert.match(await page.locator('.hero-side').innerText(),/1 \/ 76 節を読了/);
  await nav('plan');
  assert.match(await page.locator('.suggested-steps li').first().innerText(),/1\.2.*英語原本PDF/s);
  for(const path of ['data/sections/1-1-en.json','data/sections/1-1-ja.json','data/figures/fig1-1-021.png']){
    const status=await page.evaluate(async path=>(await fetch(path)).status,path);
    assert.equal(status,404,path);
  }
  await nav('guide');
  await page.locator('.guide-section').first().waitFor();
  assert.equal(await page.locator('.guide-section').count(),GUIDE_SECTIONS.length);
  const guideTerm=page.locator('#guide-sim-conduction .guide-body [data-term-id]').first();
  await guideTerm.click();await page.locator('#term-overlay [role="dialog"]').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await guideTerm.evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.locator('.guide-body a [data-term-id],.guide-body button [data-term-id],.guide-body summary [data-term-id]').count(),0);
  for(const id of ['learn-dimensionless-transient','learn-lumped-cooling','learn-convection-dimensionless','learn-heat-exchanger'])
    assert.equal(await page.locator('#guide-'+id).count(),1,'発展学習ガイド: '+id);
  for(let ch=1;ch<=11;ch++){
    const guideId=['chapter1-energy-balance','chapter2-cylindrical-conduction','chapter3-effectiveness-ntu','chapter4-fin-design','chapter5-semi-infinite','chapter6-flat-boundary','chapter7-internal-flow','chapter8-buoyancy','chapter9-latent-boiling','chapter10-view-factors','chapter11-fick-mass'][ch-1];
    assert.equal(await page.locator('#guide-'+guideId).count(),1,'章別独立ガイド: '+guideId);
  }
  await page.locator('#guide-query').fill('放射率');
  await page.locator('#guide-search-form button').click();
  assert.ok(await page.locator('#guide-sim-radiation').count());
  await nav('glossary');
  await page.locator('#term-biot-number [data-start-question="supp-expanded-bi-calc"]').waitFor({state:'attached'});
  await page.locator('#term-rayleigh-number [data-start-question="supp-chapter-ch8-ra"]').waitFor({state:'attached'});
  await page.locator('#term-fick-diffusive-flux [data-start-question="supp-chapter-ch11-fick"]').waitFor({state:'attached'});
  await page.locator('#term-log-mean-temperature-difference [data-start-question="supp-expanded-hx-lmtd-equal"]').waitFor({state:'attached'});
  assert.match(await page.locator('#term-heat .term-links a').getAttribute('href'),/AHTTv600\.pdf#page=17$/);
  assert.match(await page.locator('#term-heat-flux .term-links a').getAttribute('href'),/AHTTv600\.pdf#page=25$/);
  assert.match(await page.locator('#term-pool-boiling .term-links a').getAttribute('href'),/AHTTv600\.pdf#page=485$/);
  assert.match(await page.locator('#term-pool-boiling').innerText(),/外部から強制的に流していない液体/);
  assert.ok(await page.locator('#term-pool-boiling [data-start-question="book-9-1-wire-flux"]').count());
  assert.match(await page.locator('#term-electrical-resistance .term-links a').getAttribute('href'),/AHTTv600\.pdf#page=486$/);
  assert.ok(await page.locator('#term-electrical-resistance [data-start-question="book-9-1-wire-temperature"]').count());
  assert.match(await page.locator('#term-wall-superheat .term-links a').getAttribute('href'),/AHTTv600\.pdf#page=487$/);
  assert.match(await page.locator('#term-peak-heat-flux .term-links a').getAttribute('href'),/AHTTv600\.pdf#page=490$/);
  assert.match(await page.locator('#term-surface-tension .term-links a[href*="AHTTv600.pdf"]').getAttribute('href'),/AHTTv600\.pdf#page=492$/);
  assert.ok(await page.locator('#term-surface-tension [data-start-question="book-9-2-bubble-radius"]').count());
  assert.ok(await page.locator('#term-heat-flux [data-start-question="book-9-1-transition-flux"]').count());
  assert.ok(await page.locator('#term-heat-flux [data-start-question="book-9-1-film-flux"]').count());
  assert.ok(await page.locator('#term-heat-flux [data-start-question="book-9-1-peak-flux-risk"]').count());
  assert.ok(await page.locator('#term-power [data-start-question="book-9-1-wire-flux"]').count());
  assert.ok(await page.locator('#term-convection [data-start-question="book-9-1-before-inception"]').count());

  // Newly independently authored glossary entries must link to the exact public practice,
  // including long technical names, without requiring a separate login or paid API.
  for(const [term,question] of [
    ['fouling-thermal-resistance','supp-batch2-fouling-loss-v1'],
    ['lmtd-correction-factor','supp-batch2-f-area-ratio-v1'],
    ['hydrodynamic-entry-length','supp-batch2-hydraulic-entry-length-v1'],
    ['thermal-similarity','supp-batch2-similarity-condition-v1'],
    ['view-factor-summation','supp-batch2-closed-view-sum-v1'],
    ['graybody','supp-batch2-grey-surface-limit-v1']
  ]){
    const card=page.locator('#term-'+term);
    await card.waitFor({state:'attached'});
    assert.ok(await card.locator('[data-start-question="'+question+'"]').count(),term+' → '+question);
  }
  for(const id of ['heat-conduction','transient-conduction','boundary-condition','initial-condition',
    'characteristic-length','complementary-error-function','thermal-penetration','fin',
    'insulated-fin-tip','fin-tip-convection','hyperbolic-tangent','stefan-boltzmann',
    'fick-law','molar-fraction','schmidt-number','sherwood-number','mass-diffusivity']){
    const card=page.locator('#term-'+id);
    assert.ok((await card.locator('.term-example').innerText()).includes('独立作成の例'),id);
    assert.ok(await card.locator('[data-section]').count(),id+' section link');
  }
  await page.locator('#glossary-query').fill('5.0 s');
  await page.locator('#term-mass-diffusivity').waitFor({state:'visible'});
  assert.equal(await page.locator('.term-card').count(),1,'independent examples are searchable');
  await page.locator('#term-mass-diffusivity [data-section="11.3"]').click();
  await page.locator('#reader-deep-lesson').waitFor();
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/Fick/);
  await nav('glossary');
  await page.locator('#glossary-query').fill('');
  await page.locator('#term-thermal-conductivity').waitFor();
  await page.locator('#term-thermal-conductivity .term-links a').click();
  assert.match(page.url(),/#guide\/sim-conduction$/);
  await nav('glossary');
  await page.locator('#term-thermal-conductivity [data-start-question="supp-flat-thickness"]').click();
  assert.match(await page.locator('.question-card').innerText(),/厚さ L/);
  await page.locator('.question-card h2 [data-term-id="thermal-conductivity"]').click();
  await page.locator('#term-overlay [role="dialog"]').waitFor({state:'visible'});
  assert.match(await page.locator('#term-sheet-title').innerText(),/熱伝導率/);
  assert.match(await page.locator('.term-sheet').innerText(),/W\/\(m·K\)/);
  assert.equal(await page.locator('.answer-choice input:checked').count(),0,
    'dictionary lookup must not select an answer');
  await page.locator('#term-overlay [data-term-id="heat-flux"]').focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('#term-sheet-title').innerText(),/熱流束/);
  assert.equal(await page.locator('#term-overlay').count(),1);
  assert.equal(await page.locator('.answer-choice input:checked').count(),0);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#term-overlay').count(),0);
  assert.equal(await page.locator('.question-card h2 [data-term-id="thermal-conductivity"]').evaluate(el=>el===document.activeElement),true);
  await page.locator('.question-card h2 [data-term-id="thermal-conductivity"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#term-overlay [role="dialog"]').waitFor({state:'visible'});
  await page.locator('[data-term-detail="thermal-conductivity"]').click();
  assert.match(page.url(),/#glossary$/);
  await page.locator('#term-thermal-conductivity').waitFor({state:'visible'});
  await nav('quiz');

  await page.locator('[data-action="exit-quiz"]').click();
  await page.locator('[data-action="discard-quiz"]').click();
  await nav('map');
  await page.locator('[data-chapter-card="ch2"]').waitFor({state:'visible'});
  assert.match(await page.locator('[data-chapter-card="ch2"]').innerText(),/収録問題：46問/);
  assert.match(await page.locator('[data-chapter-card="ch1"]').innerText(),/原本の節を読了に記録：1\/5節/);
  assert.match(await page.locator('[data-chapter-card="ch9"]').innerText(),/収録問題：135問/);
  assert.match(await page.locator('[data-chapter-card="ch2"]').innerText(),/未回答：46問/);
  await page.locator('[data-chapter-card="ch2"] [data-chapter-practice-mode="priority"]').click();
  await page.locator('.question-card').waitFor({state:'visible'});
  assert.match(await page.locator('.page-heading h1').innerText(),/1 \/ 10 問/);
  const priorityIds=await page.evaluate(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1')).quizDraft.ids);
  assert.equal(priorityIds.length,10);
  const chapter2Ids=new Set(await page.evaluate(async()=>(await (await fetch('./data/questions.json')).json()).filter(q=>q.source?.chapterId==='ch2'||q.source?.sectionNoteId?.startsWith('2.')||(q.source?.type==='book'&&q.source?.section?.startsWith('2.'))).map(q=>q.id)));
  assert.ok(priorityIds.every(id=>chapter2Ids.has(id)),'priority practice contains only questions actually mapped to chapter 2');
  await page.locator('[data-action="exit-quiz"]').click();
  await page.locator('[data-action="discard-quiz"]').click();
  await nav('map');
  await page.locator('[data-chapter-card="ch2"] [data-chapter-practice="ch2"]:not([data-chapter-practice-mode])').click();
  await page.locator('.question-card').waitFor({state:'visible'});
  assert.match(await page.locator('.page-heading h1').innerText(),/1 \/ 46 問/);
  assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1')).quizDraft.ids)).every(id=>chapter2Ids.has(id)),true);
  await page.locator('[data-action="exit-quiz"]').click();
  await page.locator('[data-action="discard-quiz"]').click();
  await page.locator('#quiz-start-form select[name="chapter"]').selectOption('ch9');
  await page.locator('#quiz-start-form select[name="count"]').selectOption(String(questionCount));
  await page.locator('#quiz-start-form button[type="submit"]').click();
  await page.locator('.question-card').waitFor({state:'visible'});
  assert.match(await page.locator('.page-heading h1').innerText(),/1 \/ 135 問/);
  await page.locator('[data-action="exit-quiz"]').click();
  await page.locator('[data-action="discard-quiz"]').click();
  await nav('guide');
  await page.locator('#guide-chapter11-fick-mass [data-chapter-practice="ch11"]').click();
  await page.locator('.question-card').waitFor({state:'visible'});
  assert.match(await page.locator('.page-heading h1').innerText(),/1 \/ 93 問/);
  await page.locator('[data-action="exit-quiz"]').click();
  await page.locator('[data-action="discard-quiz"]').click();
  await nav('search');
  await page.locator('#search-query').fill('レイリー数');
  await page.locator('#search-form select[name="kind"]').selectOption('guide');
  await page.locator('#search-form select[name="chapter"]').selectOption('ch8');
  await page.locator('#search-form button[type="submit"]').click();
  assert.ok(await page.locator('.result-card').count()>=1);
  await page.locator('.result-card .result-link').first().click();
  assert.match(page.url(),/#guide\/chapter8-buoyancy$/);
  await nav('search');
  await page.locator('#search-query').fill('多成分混合物');
  await page.locator('#search-form select[name="kind"]').selectOption('original-note');
  await page.locator('#search-form select[name="chapter"]').selectOption('ch11');
  await page.locator('#search-form button[type="submit"]').click();
  assert.ok(await page.locator('.result-card').count()>=1);
  await page.locator('.result-card .result-link').first().click();
  await page.locator('#reader-original-note').waitFor({state:'visible'});
  assert.match(await page.locator('#reader-original-note').innerText(),/独立執筆・学術校閲前/);
  await page.locator('#reader-original-note [data-start-question="supp-section-11-11"]').click();
  await page.locator('.question-card').waitFor({state:'visible'});
  assert.match(await page.locator('.question-card').innerText(),/独立学習ノート/);
  await page.locator('[data-action="exit-quiz"]').click();
  await page.locator('[data-action="discard-quiz"]').click();
  await nav('search');
  await page.locator('#search-query').fill('Stefan流');
  await page.locator('#search-form select[name="kind"]').selectOption('deep-lesson');
  await page.locator('#search-form select[name="chapter"]').selectOption('ch11');
  await page.locator('#search-form button[type="submit"]').click();
  await page.locator('.result-card').first().waitFor({state:'visible'});
  assert.ok(await page.locator('.result-card').count()>=1);
  assert.match(await page.locator('.result-card').first().innerText(),/外部専門家校閲前/);
  await page.locator('.result-card .result-link').first().click();
  await page.locator('#reader-deep-lesson').waitFor({state:'visible'});
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/Fickの法則/);
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/Stefan流/);
  await page.locator('#reader-deep-lesson mark').first().waitFor({state:'visible'});
  assert.equal(await page.locator('#reader-deep-lesson mark').first().innerText(),'Stefan流');
  await nav('search');
  await page.locator('#search-query').fill('半無限固体');
  await page.locator('#search-form select[name="kind"]').selectOption('deep-lesson');
  await page.locator('#search-form select[name="chapter"]').selectOption('ch5');
  await page.locator('#search-form button[type="submit"]').click();
  await page.locator('.result-card .result-link').filter({hasText:'5.6'}).first().click();
  await page.locator('#reader-deep-lesson').waitFor({state:'visible'});
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/誤差関数/);
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/6.770×10³/);
  await page.locator('#reader-deep-lesson mark').first().waitFor({state:'visible'});
  await nav('search');
  await page.locator('#search-query').fill('射度');
  await page.locator('#search-form select[name="kind"]').selectOption('deep-lesson');
  await page.locator('#search-form select[name="chapter"]').selectOption('ch10');
  await page.locator('#search-form button[type="submit"]').click();
  await page.locator('.result-card .result-link').filter({hasText:'10.1'}).first().click();
  await page.locator('#reader-deep-lesson').waitFor({state:'visible'});
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/1253.153/);
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/専門家校閲前/);
  await page.locator('#reader-deep-lesson mark').first().waitFor({state:'visible'});
  await nav('search');
  await page.locator('#search-query').fill('459.300');
  await page.locator('#search-form select[name="kind"]').selectOption('deep-lesson');
  await page.locator('#search-form select[name="chapter"]').selectOption('ch10');
  await page.locator('#search-form button[type="submit"]').click();
  await page.locator('.result-card .result-link').first().click();
  await page.locator('[id="reader-block-10.1-deep-example"]').waitFor({state:'visible'});
  assert.match(await page.locator('[id="reader-block-10.1-deep-example"]').innerHTML(),/<mark>459\.300<\/mark>/);
  await nav('search');
  await page.locator('#search-query').fill('297.695');
  await page.locator('#search-form select[name="kind"]').selectOption('deep-lesson');
  await page.locator('#search-form select[name="chapter"]').selectOption('ch10');
  await page.locator('#search-form button[type="submit"]').click();
  await page.locator('.result-card .result-link').first().click();
  await page.locator('[id="reader-block-10.1-deep-6"]').waitFor({state:'visible'});
  assert.match(await page.locator('[id="reader-block-10.1-deep-6"]').innerHTML(),/<mark>297\.695<\/mark>/);
  await nav('search');
  await page.locator('#search-query').fill('気泡の成長・離脱');
  await page.locator('#search-form select[name="kind"]').selectOption('deep-lesson');
  await page.locator('#search-form select[name="chapter"]').selectOption('ch9');
  await page.locator('#search-form button[type="submit"]').click();
  await page.locator('.result-card .result-link').filter({hasText:'9.2'}).first().click();
  await page.locator('[id="reader-block-9.2-deep-0"]').waitFor({state:'visible'});
  assert.match(await page.locator('[id="reader-block-9.2-deep-0"]').innerHTML(),/<mark>気泡の成長・離脱<\/mark>/);
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/外部学術専門家校閲前/);
  await nav('search');
  await page.locator('#search-query').fill('フィン有効度');
  await page.locator('#search-form select[name="kind"]').selectOption('deep-lesson');
  await page.locator('#search-form select[name="chapter"]').selectOption('ch4');
  await page.locator('#search-form button[type="submit"]').click();
  await page.locator('.result-card .result-link').filter({hasText:'4.5'}).first().click();
  await page.locator('#reader-deep-lesson').waitFor({state:'visible'});
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/フィン有効度/);
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/5\.166/);
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/67\.60/);
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/専門家校閲前/);
  await nav('simulator');
  assert.match(await page.locator('.result-number').innerText(),/5,625/);
  assert.equal(await page.locator('.sim-physical-diagram').count(),1);
  assert.match(await page.locator('.sim-physical-diagram').getAttribute('role'),/img/);
  assert.match(await page.locator('.simulation-figure').innerText(),/アプリ作成の図/);
  assert.match(await page.locator('.sim-physical-diagram desc').textContent(),/左から右/);
  await page.locator('#sim-form input[name="hot"]').fill('10');
  assert.match(await page.locator('.sim-physical-diagram desc').textContent(),/右から左/);
  await page.locator('#sim-form input[name="hot"]').fill('80');
  assert.match(await page.locator('.sim-physical-diagram desc').textContent(),/左から右/);
  const explanation=page.locator('.simulation-steps details').first();
  await explanation.locator('summary').click();
  const calculationTerm=explanation.locator('[data-term-id]').first();
  await calculationTerm.click();await page.locator('#term-overlay [role="dialog"]').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#sim-form input[name="hot"]').inputValue(),'80');

  await page.locator('#sim-form input[name="k"]').fill('0.000001');
  assert.match(await page.locator('.result-number').innerText(),/3\.750×10⁻⁴/);
  await page.locator('#sim-form input[name="k"]').fill('15');
  assert.match(await page.locator('.related-reading a[href*="AHTTv600.pdf"]').getAttribute('href'),/AHTTv600\.pdf#page=\d+$/);
  await page.locator('[data-sim-mode="radiation"]').click();
  assert.match(await page.locator('.result-number').innerText(),/W/);
  await page.locator('#sim-form input[name="emissivity"]').fill('0');
  assert.match(await page.locator('.result-number').innerText(),/モデル計算結果は0 W/);
  assert.match(await page.locator('.sim-physical-diagram desc').textContent(),/正味の熱移動はゼロ/);

  await page.locator('#sim-form input[name="surface"]').fill('20');
  await page.locator('#sim-form input[name="surrounding"]').fill('80');
  assert.equal((await page.locator('.result-number strong').innerText()).replace(/\s/g,''),'0W');
  await page.locator('#sim-form input[name="surface"]').fill('150');
  await page.locator('#sim-form input[name="surrounding"]').fill('25');
  await page.locator('#sim-form input[name="emissivity"]').fill('0.85');
  await page.locator('#sim-form input[name="surface"]').fill('20.0000000000001');
  await page.locator('#sim-form input[name="surrounding"]').fill('20');
  assert.match(await page.locator('.result-number strong').innerText(),/×10⁻¹³/);
  await page.locator('#sim-form input[name="surface"]').fill('150');
  await page.locator('#sim-form input[name="surrounding"]').fill('25');
  // Full interactive time-dependent cooling, validity warning, heat-flow sign
  // and mobile chart are checked on the exact allowlisted public distribution.
  await page.locator('[data-sim-mode="transient"]').click();
  assert.equal(await page.locator('.sim-output-card .status-pill').innerText(),'非定常・Biを確認');
  assert.match(await page.locator('.sim-physical-diagram desc').textContent(),/2,000秒/);

  assert.match(await page.locator('.result-number strong').innerText(),/34\.715/);
  assert.match(await page.locator('.sim-output-card').innerText(),/Bi = 0\.02/);
  assert.match(await page.locator('.sim-chart').getAttribute('aria-label'),/横軸は秒/);
  assert.match(await page.locator('.sim-output-card').innerText(),/101,139/);
  await page.locator('#sim-form input[name="k"]').fill('1');
  assert.match(await page.locator('.sim-output-card').innerText(),/保証できません/);
  await page.locator('#sim-form input[name="k"]').fill('10');
  await page.locator('#sim-form input[name="time"]').fill('0');
  assert.match(await page.locator('.result-number strong').innerText(),/60/);
  await page.locator('#sim-form input[name="time"]').fill('2000');
  await page.locator('[data-action="save-comparison"]').click();
  await page.locator('#sim-form input[name="h"]').fill('40');
  assert.match(await page.locator('.sim-chart').getAttribute('aria-label'),/温度履歴/);
  assert.equal(await page.locator('.sim-chart .chart-baseline').count(),1);
  await page.locator('#sim-form input[name="h"]').fill('0');
  assert.match(await page.locator('.sim-error').innerText(),/0より大きく/);
  await page.locator('#sim-form input[name="h"]').fill('20');
  await page.locator('#sim-form input[name="initial"]').fill('-273.15');
  assert.match(await page.locator('.sim-error').innerText(),/絶対零度/);
  await page.locator('#sim-form input[name="initial"]').fill('60');
  await page.locator('.sim-intro a[href="#guide/sim-transient"]').click();
  assert.match(await page.locator('#guide-sim-transient').innerText(),/集中熱容量法/);
  await nav('simulator');
  await page.locator('[data-sim-mode="transient"]').click();
  await nav('quiz');
  assert.equal(Number(await page.locator('#quiz-start-form select[name="count"] option').last().getAttribute('value')),await page.locator('.bank-item').count());
  await page.locator('[data-start-question="book-9-1-transition-flux"]').click();
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.answer-source a[href*="AHTTv600.pdf"]').getAttribute('href'),/AHTTv600\.pdf#page=490$/);
  await page.locator('[data-action="next-question"]').click();
  await page.locator('[data-action="again-quiz"]').click();
  await page.locator('[data-start-question="book-9-1-peak-flux-risk"]').click();
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.answer-source a[href*="AHTTv600.pdf"]').getAttribute('href'),/AHTTv600\.pdf#page=490$/);
  await page.locator('[data-action="next-question"]').click();
  await page.locator('[data-action="again-quiz"]').click();
  await page.locator('[data-start-question="book-9-1-before-inception"]').click();
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.answer-source a[href*="AHTTv600.pdf"]').getAttribute('href'),/AHTTv600\.pdf#page=487$/);
  await page.locator('[data-action="next-question"]').click();
  await page.locator('[data-action="again-quiz"]').click();
  await page.locator('[data-start-question="book-9-1-film-flux"]').click();
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.answer-source a[href*="AHTTv600.pdf"]').getAttribute('href'),/AHTTv600\.pdf#page=490$/);
  await page.locator('[data-action="next-question"]').click();
  await page.locator('[data-action="again-quiz"]').click();
  await page.locator('[data-start-question="book-9-1-wire-flux"]').click();
  assert.equal(await page.locator('.question-figure img').count(),0);
  assert.match(await page.locator('.question-figure .figure-placeholder').innerText(),/原本PDF/);
  assert.match(await page.locator('.question-figure figcaption a[href*="AHTTv600.pdf"]').getAttribute('href'),/AHTTv600\.pdf#page=486$/);
  assert.ok(await page.locator('.question-figure figcaption span').first().evaluate(element=>parseFloat(getComputedStyle(element).fontSize)>=12));
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.answer-source a[href*="AHTTv600.pdf"]').getAttribute('href'),/AHTTv600\.pdf#page=486$/);
  await page.locator('[data-action="next-question"]').click();
  await page.locator('[data-action="again-quiz"]').click();
  await page.locator('[data-start-question="book-9-1-wire-temperature"]').click();
  assert.match(await page.locator('.question-card').innerText(),/2\.05 Ω|4\.10 V/);
  assert.match(await page.locator('.question-figure figcaption a[href*="AHTTv600.pdf"]').getAttribute('href'),/AHTTv600\.pdf#page=486$/);
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.answer-source a[href*="AHTTv600.pdf"]').getAttribute('href'),/AHTTv600\.pdf#page=486$/);
  await page.locator('[data-action="next-question"]').click();
  await page.locator('[data-action="again-quiz"]').click();
  await page.locator('[data-start-question="book-9-2-bubble-radius"]').click();
  assert.match(await page.locator('.question-card').innerText(),/3\.0 kPa.*有効数字2桁/s);
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.answer-source a[href*="AHTTv600.pdf"]').getAttribute('href'),/AHTTv600\.pdf#page=492$/);
  assert.match(await page.locator('.answer-source').innerText(),/式（9\.1）/);
  await page.locator('[data-action="next-question"]').click();
  await page.locator('[data-action="again-quiz"]').click();
  await page.locator('[data-start-question="book-1-2-closed-energy-rate"]').click();
  assert.match(await page.locator('.question-card').innerText(),/Q=120 W.*Wₖ=30 W/);
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.answer-source a[href*="AHTTv600.pdf"]').getAttribute('href'),/AHTTv600\.pdf#page=20$/);
  assert.match(await page.locator('.answer-source').innerText(),/式（1\.1）/);
  await page.locator('[data-action="next-question"]').click();
  await page.locator('[data-action="again-quiz"]').click();
  await page.locator('#quiz-start-form select[name="field"]').selectOption('定常熱伝導・熱抵抗');
  await page.locator('#quiz-start-form button[type="submit"]').click();
  await page.keyboard.press('1');
  assert.equal(await page.locator('.answer-choice input:checked').count(),1);
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1')).attempts.length),9);
  assert.ok(await page.locator('.solution-steps li').count()>=3);
  assert.match(await page.locator('.answer-source a').getAttribute('href'),/^#guide\//);
  await nav('settings');
  await page.locator('[data-action="export-preview"]').click();
  assert.equal(JSON.parse(await page.locator('#export-json').inputValue()).attempts.length,9);
  const beforeImport=await page.evaluate(()=>localStorage.getItem('heat-study-ja:v1'));
  const importPayload=JSON.parse(await page.locator('#export-json').inputValue());
  importPayload.plan={...importPayload.plan,goal:'取り込み動作の確認',active:true,updatedAt:new Date().toISOString()};
  await page.locator('#import-file').setInputFiles({name:'learning-data.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(importPayload))});
  await page.locator('[data-action="import-merge"]').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1')).plan.goal),'取り込み動作の確認');
  const importBackup=await page.evaluate(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1:before-import')));
  assert.equal(importBackup.plan.goal,JSON.parse(beforeImport).plan.goal);
  assert.equal(importBackup.attempts.length,9);
  await page.locator('.backup-controls summary').click();
  assert.match(await page.locator('.backup-controls').innerText(),/控えは一つだけ/);
  await page.evaluate(()=>{window.__originalCreateObjectURL=URL.createObjectURL;URL.createObjectURL=()=>{throw new Error('download-unavailable');};});
  await page.locator('[data-action="export-data"]').first().click();
  assert.match(await page.locator('.toast').innerText(),/ダウンロードを開始できませんでした/);
  assert.equal(JSON.parse(await page.locator('#export-json').inputValue()).plan.goal,'取り込み動作の確認');
  await page.evaluate(()=>{URL.createObjectURL=window.__originalCreateObjectURL;delete window.__originalCreateObjectURL;});
  await page.locator('input[name="theme"][value="dark"]').check();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
  await nav('reader');
  await page.locator('.reader-toc .toc-item.selected').waitFor({state:'attached'});
  assert.ok((await readerContrast()).every(value=>value>=4.5),'暗色目次の選択行の文字コントラスト');
  await nav('settings');
  await page.reload();
  await page.locator('.app-shell').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
  await page.locator('input[name="theme"][value="light"]').check();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
  await page.emulateMedia({colorScheme:'dark'});
  await page.locator('input[name="theme"][value="system"]').check();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
  await page.emulateMedia({colorScheme:'light'});
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='light',null,{timeout:3000});
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
  for(const width of [320,390,760,1365]){
    await page.setViewportSize({width,height:844});
    for(const route of ['home','reader','guide','glossary','quiz','simulator','settings']){
      await nav(route);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+2,`${route}@${width}`);
      if(route==='reader'){
        const status=page.locator('.reader-toc .toc-item i').filter({hasText:'翻訳下書き・未移行'}).first();
        assert.ok(await status.evaluate(element=>element.getBoundingClientRect().height<=20&&element.scrollWidth<=element.clientWidth+1&&parseFloat(getComputedStyle(element).fontSize)>=10),`目次の進捗表示@${width}`);
        assert.ok(await page.locator('.reader-toc .toc-item').first().evaluate(element=>element.getBoundingClientRect().height>=44),`目次のタップ領域@${width}`);
      }
    }
  }
  await nav('plan');
  const beforeFailedSave=await page.evaluate(()=>localStorage.getItem('heat-study-ja:v1'));
  await page.evaluate(()=>{
    window.__originalSetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==='heat-study-ja:v1')throw new DOMException('容量不足','QuotaExceededError');
      return window.__originalSetItem.call(this,key,value);
    };
  });
  await page.locator('#plan-form [name="goal"]').fill('保存失敗時の通知確認');
  await page.locator('#plan-form button[type="submit"]').click();
  assert.match(await page.locator('.toast').innerText(),/端末に保存できませんでした/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('heat-study-ja:v1')),beforeFailedSave);
  await page.reload();
  await page.locator('.app-shell').waitFor();
  assert.notEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1')).plan.goal),'保存失敗時の通知確認');
  await page.evaluate(()=>{
    window.__originalSetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==='heat-study-ja:v1')throw new DOMException('容量不足','QuotaExceededError');
      return window.__originalSetItem.call(this,key,value);
    };
  });
  await page.locator('#plan-form [name="goal"]').fill('保存回復を確認する');
  await page.locator('#plan-form button[type="submit"]').click();
  assert.ok(await page.locator('.storage-warning').count());
  await page.evaluate(()=>{Storage.prototype.setItem=window.__originalSetItem;delete window.__originalSetItem;});
  await page.locator('#plan-form button[type="submit"]').click();
  assert.match(await page.locator('.toast').innerText(),/学習計画を保存しました/);
  assert.equal(await page.locator('.storage-warning').count(),0);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1')).plan.goal),'保存回復を確認する');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await nav('reader');
  const pdfSaved=page.evaluate(()=>new Promise(resolve=>{const handler=event=>{if(event.data?.type!=='PDF_CACHE_RESULT')return;navigator.serviceWorker.removeEventListener('message',handler);resolve(event.data.ok);};navigator.serviceWorker.addEventListener('message',handler);}));
  await page.locator('[data-action="cache-pdf"]').click();
  assert.equal(await pdfSaved,true);
  assert.match(await page.locator('#pdf-cache-status').innerText(),/保存済み/);
  assert.ok(await page.evaluate(async()=>{const name=(await caches.keys()).find(k=>k.startsWith('heat-study-ja-pdf-'));return Boolean(name&&await (await caches.open(name)).match('./book/AHTTv600.pdf'));}));
  if(engine==='webkit'){
    const cachedRange=await page.evaluate(async()=>{const response=await fetch('./book/AHTTv600.pdf',{headers:{Range:'bytes=0-3'}});return {status:response.status,signature:await response.text()};});
    assert.deepEqual(cachedRange,{status:206,signature:'%PDF'});
    await nav('guide');
    await page.locator('#guide-sim-radiation').waitFor({state:'visible'});
    assert.match(await page.locator('#guide-sim-radiation').innerText(),/熱放射/);
  }else{
  await context.setOffline(true);
  await page.goto(new URL('./?offline-check=1#reader',base).href,{waitUntil:'domcontentloaded'});
  await page.locator('.app-shell').waitFor();
  await page.waitForFunction(()=>document.querySelector('#pdf-cache-status')?.textContent.includes('保存済み'));
  const pdfRange=await page.evaluate(async()=>{const response=await fetch('./book/AHTTv600.pdf',{headers:{Range:'bytes=0-3'}});return {status:response.status,range:response.headers.get('content-range'),signature:await response.text()};});
  assert.equal(pdfRange.status,206);
  assert.equal(pdfRange.range,'bytes 0-3/32472182');
  assert.equal(pdfRange.signature,'%PDF');
  const pdfEnd=await page.evaluate(async()=>{const tail=await fetch('./book/AHTTv600.pdf',{headers:{Range:'bytes=-4'}});const invalid=await fetch('./book/AHTTv600.pdf',{headers:{Range:'bytes=32472182-'}});return {tailStatus:tail.status,tailRange:tail.headers.get('content-range'),tailBytes:(await tail.arrayBuffer()).byteLength,invalidStatus:invalid.status};});
  assert.deepEqual(pdfEnd,{tailStatus:206,tailRange:'bytes 32472178-32472181/32472182',tailBytes:4,invalidStatus:416});
  // Glossary and its inline dialog must work without another network request.
  await nav('glossary');
  await page.locator('#term-fourier-law').waitFor({state:'visible'});
  // Earlier E2E steps can leave a suspended set; replacing it is confirmed
  // in the app's own start dialog (B-12 removed the native confirm).
  await page.locator('#term-thermal-conductivity [data-start-question="supp-flat-thickness"]').click();
  await confirmQuizReplacement();
  await page.locator('.question-card').waitFor({state:'visible'});
  await page.locator('.question-card h2 [data-term-id="thermal-conductivity"]').click();
  await page.locator('#term-overlay [role="dialog"]').waitFor({state:'visible'});
  assert.match(await page.locator('#term-sheet-title').innerText(),/熱伝導率/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#term-overlay').count(),0);
  await nav('guide');
  await page.locator('#guide-sim-radiation').waitFor({state:'visible'});
  assert.match(await page.locator('#guide-sim-radiation').innerText(),/熱放射/);
  await page.evaluate(async()=>{const name=(await caches.keys()).find(k=>k.startsWith('heat-study-ja-pdf-'));if(name)await (await caches.open(name)).delete('./book/AHTTv600.pdf');});
  await page.goto(new URL('./?offline-check=2#reader',base).href,{waitUntil:'domcontentloaded'});
  await page.locator('.app-shell').waitFor();
  await nav('reader');
  await page.waitForFunction(()=>document.querySelector('#pdf-cache-status')?.textContent.includes('未保存'));
  // Explicit Cache Storage was deleted. Chromium may still serve the PDF
  // from its separate HTTP cache offline; a 503 is not universally guaranteed.
  assert.equal(await page.evaluate(async()=>{const name=(await caches.keys()).find(k=>k.startsWith('heat-study-ja-pdf-'));return Boolean(name&&await (await caches.open(name)).match('./book/AHTTv600.pdf'));}),false);
  const missingPdf=await page.evaluate(async()=>{
    try{
      const response=await fetch('./book/AHTTv600.pdf',{headers:{Range:'bytes=0-3'},cache:'no-store'});
      if(response.status===200||response.status===206){
        const reader=response.body.getReader(),first=await reader.read();
        await reader.cancel();
        return {status:response.status,signature:String.fromCharCode(...(first.value||new Uint8Array()).slice(0,4))};
      }
      return {status:response.status,message:(await response.text()).slice(0,200)};
    }catch{return {status:'network-error'};}
  });
  assert.ok(missingPdf.status===503||[200,206].includes(missingPdf.status)||(engine==='firefox'&&missingPdf.status==='network-error'),'未保存PDFの応答: '+JSON.stringify(missingPdf));
  if(missingPdf.status===503)assert.match(missingPdf.message,/オフライン保存されていません/);
  if([200,206].includes(missingPdf.status))assert.equal(missingPdf.signature,'%PDF','別領域のHTTPキャッシュがPDFを返した場合も署名を確認する');
  }
  await nav('reader');
  const allLectures=await page.evaluate(async()=>(await (await fetch('./data/original-deep-lessons.json')).json()).lessons);
  assert.equal(allLectures.length,76);
  const lessonFor=id=>allLectures.find(lesson=>lesson.sectionId===id);
  // In-depth original Japanese lessons must be accessible on both fresh and
  // previously cached distributions, independently of copyrighted book text.
  // Verify newly added independent advanced lessons through the real reader UI.
  await page.locator('.reader-toc [data-section="2.1"]').evaluate(element=>{
    for(let n=element.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;
  });
  await page.locator('.reader-toc [data-section="2.1"]').click();
  await page.locator('#reader-deep-lesson').waitFor({state:'visible'});
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/熱伝導方程式を保存則から導く/);
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/30\.8 ℃/);
  assert.equal(await page.locator('#reader-deep-lesson .deep-lesson-block').count(),lessonFor('2.1').blocks.length);
  await page.locator('.reader-toc [data-section="11.3"]').evaluate(element=>{
    for(let n=element.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;
  });
  await page.locator('.reader-toc [data-section="11.3"]').click();
  await page.locator('#reader-deep-lesson').waitFor({state:'visible'});
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/Fickの法則/);
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/0\.01396/);
  assert.equal(await page.locator('#reader-deep-lesson .deep-lesson-block').count(),lessonFor('11.3').blocks.length);
  await page.locator('.reader-toc [data-section="3.2"]').evaluate(element=>{
    for(let n=element.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;
  });
  await page.locator('.reader-toc [data-section="3.2"]').click();
  await page.locator('#reader-deep-lesson').waitFor({state:'visible'});
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/対数平均温度差の導出/);
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/202\.73 W\/K/);
  assert.equal(await page.locator('#reader-deep-lesson .deep-lesson-block').count(),lessonFor('3.2').blocks.length);
  await page.locator('.reader-toc [data-section="5.2"]').evaluate(element=>{
    for(let n=element.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;
  });
  await page.locator('.reader-toc [data-section="5.2"]').click();
  await page.locator('#reader-deep-lesson').waitFor({state:'visible'});
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/集中熱容量法の支配方程式/);
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/49\.43/);
  await page.locator('.reader-toc [data-section="8.4"]').evaluate(element=>{
    for(let n=element.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;
  });
  await page.locator('.reader-toc [data-section="8.4"]').click();
  await page.locator('#reader-deep-lesson').waitFor({state:'visible'});
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/独立作成の発展学習教材/);
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/Ra≈7\.85×10⁶/);
  assert.equal(await page.locator('#reader-deep-lesson .deep-lesson-block').count(),lessonFor('8.4').blocks.length);
  await page.locator('.reader-toc [data-section="8.5"]').evaluate(element=>{
    for(let n=element.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;
  });
  await page.locator('.reader-toc [data-section="8.5"]').click();
  await page.locator('#reader-deep-lesson').waitFor({state:'visible'});
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/膜状凝縮の液膜抵抗/);
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/1\.724 kW/);
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/Re_f≈21\.9/);
  assert.equal(await page.locator('#reader-deep-lesson .deep-worked-example li').count(),lessonFor('8.5').workedExample.steps.length);
  // Check every formerly pending lecture in the actual reader. Chromium/Firefox
  // are still offline here; WebKit checks the same content online.
  for(const [sectionId,answer] of [
    ['9.5','瞬間の蓄熱率+100 W'],['9.6','1920→840 W'],['9.7','105 kPa'],
    ['9.8','0.963'],['9.9','41.4 ℃'],['9.10','1.13倍'],['9.11','1200 Pa']
  ]){
    const link=page.locator(`.reader-toc [data-section="${sectionId}"]`);
    await link.evaluate(element=>{for(let n=element.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;});
    await link.click();
    const text=await page.locator('#reader-deep-lesson').innerText();
    assert.ok(text.includes(answer),sectionId+' example result');
    assert.match(text,/AI内部/);assert.match(text,/外部学術専門家校閲前/);
  }
  // Render every detailed lecture in the built distribution, including its actual example.
  for(const lesson of allLectures){
    const link=page.locator(`.reader-toc [data-section="${lesson.sectionId}"]`);
    await link.evaluate(element=>{for(let n=element.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;});
    await link.click();
    await page.waitForFunction(title=>document.querySelector('#deep-lesson-heading')?.textContent.includes(title),lesson.title);
    assert.equal(await page.locator('#reader-deep-lesson .deep-lesson-block').count(),lesson.blocks.length);
    assert.equal(await page.locator('#reader-deep-lesson .deep-worked-example li').count(),lesson.workedExample.steps.length);
    const rendered=await page.locator('#reader-deep-lesson').textContent();
    assert.ok(rendered.includes(lesson.objective),lesson.sectionId+' learning objective');
    assert.match(rendered,/外部学術専門家校閲前/);
    for(const reference of lesson.references)assert.equal(await page.locator(`#reader-deep-lesson a[href="${reference.url}"]`).count(),1);
  }
  console.log(engine+': 全76詳細講義の目標・本文・例題・参照・未校閲表示を確認。');
  // Exercise all internally checked earlier additions and every new question authored here.
  // A vocabulary tap must leave the answer draft and persisted learning state intact.
  const pending=await page.evaluate(async()=>
    (await (await fetch('./data/questions.json')).json()).filter(q=>q.reportHistory?.some(r=>['internal_independent_check','authored_with_internal_check','internal_audit_followup'].includes(r.type))));
  assert.equal(pending.length,444);
  for(const q of pending){
    await nav('quiz');
    if(await page.locator('[data-action="exit-quiz"]').count()){
      await page.locator('[data-action="exit-quiz"]').click();
      await page.locator('[data-action="discard-quiz"]').click();
    }
    await page.locator(`.bank-item[data-start-question="${q.id}"]`).click();
    await confirmQuizReplacement();
    await page.locator('.question-card').waitFor({state:'visible'});
    assert.equal(await page.locator('.answer-options input').count(),4,q.id);
    const term=page.locator('.question-card h2 [data-term-id]').first();
    if(await term.count()){
      const before=await page.evaluate(()=>{
        const s=JSON.parse(localStorage.getItem('heat-study-ja:v1'));
        const {updatedAt,...draft}=s.quizDraft||{};
        return JSON.stringify({attempts:s.attempts,draft,reviews:s.reviews});
      });
      await term.click();await page.locator('#term-overlay [role="dialog"]').waitFor();
      await page.keyboard.press('Escape');
      const after=await page.evaluate(()=>{
        const s=JSON.parse(localStorage.getItem('heat-study-ja:v1'));
        const {updatedAt,...draft}=s.quizDraft||{};
        return JSON.stringify({attempts:s.attempts,draft,reviews:s.reviews});
      });
      assert.equal(after,before,q.id+' vocabulary preserves learning state');
    }
    await page.locator(`input[name="choice"][value="${q.answer}"]`).check();
    await page.locator('#quiz-answer-form button[type="submit"]').click();
    await page.locator('.feedback-correct').waitFor();
    const latest=await page.evaluate(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1')).attempts.at(-1));
    assert.equal(latest.questionId,q.id);assert.equal(latest.questionRevision,q.revision);
  }
  await nav('reader');
  await page.locator('.reader-toc [data-section="10.1"]').evaluate(element=>{
    for(let n=element.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;
  });
  await page.locator('.reader-toc [data-section="10.1"]').click();
  await page.locator('#reader-deep-lesson').waitFor({state:'visible'});
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/放射交換の基礎：黒体、放射率/);
  assert.match(await page.locator('#reader-deep-lesson').innerText(),/396\.926 W/);
  assert.equal(await page.locator('#reader-deep-lesson .deep-worked-example li').count(),lessonFor('10.1').workedExample.steps.length);
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  console.log(engine==='webkit'?'WebKitで公開配信物の主要画面・保存・PDFキャッシュのオンライン範囲取得を確認。Playwright WebKitのオフライン通信・再訪は内部エラーのため未検証。':`${engine}で公開配信物：原本PDFとオフラインの範囲取得、訳文・抽出原図なし、ガイド・演習・計算・保存・画面幅・数字キーとEnter・3種類の表示モードを確認。`);
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}
