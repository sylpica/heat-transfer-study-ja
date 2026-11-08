// Real-browser regression suite. Uses its own disposable browser profile, never the user's learning storage.
// Modernized 2026-11-07: targets the current app (all 76 sections built in, dynamic lab,
// 504-term glossary, tabbed shell). See docs/BROWSER_TEST_MODERNIZE_20261107.md for the
// assertion-by-assertion mapping from the local-pack-era version.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../scripts/serve.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=resolve('test-results');await mkdir(output,{recursive:true});
await mkdir(resolve(output,'browser-temp'),{recursive:true});process.env.TEMP=resolve(output,'browser-temp');process.env.TMP=process.env.TEMP;
const server=await startServer({port:0}),base=`http://127.0.0.1:${server.address().port}`;
console.log('確認用サーバーを開始しました。');
const browser=await chromium.launch({headless:true,timeout:20000,downloadsPath:resolve(output,'downloads'),...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
console.log('確認専用のブラウザーを開始しました。');
const context=await browser.newContext({viewport:{width:1365,height:900},colorScheme:'light',timezoneId:'Asia/Tokyo',acceptDownloads:true});
const page=await context.newPage(),errors=[],passed=[],limitations=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);
const nav=async route=>{await page.locator(`.main-nav a[href="#${route}"]`).click();};
const pickMode=async mode=>{const toggle=page.locator('[data-action="toggle-sim-picker"]');if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();await page.locator(`[data-sim-mode="${mode}"]`).click();};
const store=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1')||'{}'));
const check=(name)=>{passed.push(name);console.log(`確認済み: ${name}`);};
const shot=async name=>page.screenshot({path:resolve(output,`${name}.png`),fullPage:false});
try {
  await page.goto(base);await page.locator('.app-shell').waitFor();assert.equal((await store()).settings?.contentLanguage||'ja','ja');check('日本語初期表示と教材読み込み');
  await shot('desktop-light-home');
  await nav('reader');await page.locator('.reader-toc details').filter({has:page.locator('[data-section="7.6"]')}).locator('summary').click();
  await page.locator('.reader-toc [data-section="7.6"]').click();await page.locator('#reader-block-7\\.6-b5').waitFor();
  assert.match(await page.locator('.reader-title').innerText(),/7\.6/);assert.equal(await page.locator('[data-block-id="7.6-b3"]').getAttribute('data-book-page'),'388');
  let formulaText='';for(let i=0;i<60&&!formulaText.includes('ストロハル');i++){formulaText=await page.locator('.formula-block').first().innerText().catch(()=> '');if(!formulaText.includes('ストロハル'))await page.waitForTimeout(500);}assert.ok(formulaText.includes('ストロハル'));
  assert.equal(await page.locator('.book-figure').count(),8);
  for(const caption of await page.locator('.book-figure figcaption').all()){assert.match(await caption.innerText(),/書籍 p\.\d+/);}
  assert.equal(await page.locator('.book-figure .figure-placeholder').count(),8);
  for(const img of await page.locator('.lesson-diagram img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(img=>img.decode());assert.ok(await img.evaluate(img=>img.naturalWidth>0));}
  check('§7.6の8図、式の説明、原本ページ');
  await page.locator('[data-block-id="7.6-b30"]').scrollIntoViewIfNeeded();await page.waitForTimeout(400);
  await page.locator('[data-action="prepare-bookmark"]').click();await page.locator('#bookmark-note').fill('自動確認用の管群メモ');await page.locator('#bookmark-form button').click();
  let saved=await store();assert.equal(saved.bookmarks.length,1);assert.ok(saved.bookmarks[0].blockId);const bookmark=saved.bookmarks[0];
  await page.locator(`[data-bookmark-note="${bookmark.id}"]`).fill('更新したしおり');await page.locator(`[data-bookmark-note="${bookmark.id}"]`).press('Tab');
  assert.equal((await store()).bookmarks[0].note,'更新したしおり');
  await page.locator(`.bookmark-list [data-bookmark="${bookmark.id}"]`).click();await page.waitForTimeout(400);assert.ok(await page.evaluate(()=>window.scrollY>200));
  await page.reload();await page.locator('.reader-title').waitFor();await page.waitForTimeout(450);assert.match(await page.locator('.reader-title').innerText(),/7\.6/);assert.ok(await page.evaluate(()=>window.scrollY>200));check('本文のしおり、メモ編集、読書位置の再読込');
  await page.locator('#reader-note-form [name="title"]').fill('温度差の学習');await page.locator('#reader-note-form [name="text"]').fill('元のメモ');await page.locator('#reader-note-form button[type="submit"]').click();
  const noteId=(await store()).notes[0].id;await page.locator(`[data-edit-note="${noteId}"]`).click();await page.locator('#reader-note-form [name="text"]').fill('編集後も同じメモ');await page.locator('#reader-note-form button[type="submit"]').click();
  assert.equal((await store()).notes.length,1);assert.equal((await store()).notes[0].text,'編集後も同じメモ');assert.equal((await store()).notes[0].id,noteId);
  assert.match(await page.locator('.figure-zoom').first().getAttribute('href'),/assets\/lesson-diagrams\/.+\.svg/);check('本文メモの編集と図解の拡大リンク');
  await nav('search');await page.locator('#search-query').fill('Re_D=UD/ν');await page.locator('[name="kind"]').selectOption('question');await page.locator('[name="chapter"]').selectOption('ch7');await page.locator('#search-form button[type="submit"]').click();
  assert.equal(await page.locator('.result-card').count(),1);await page.locator('.result-link').click();
  assert.match(await page.locator('.question-card h2').innerText(),/0\.020/);check('章を指定した問題検索と該当問題への移動');
  const questions=JSON.parse(await readFile(resolve('data/questions.json'),'utf8')),q=questions.find(q=>q.id==='supp-geometry-correlation-crossflow-reynolds-v1'),wrong=(q.answer+1)%4;
  const wrongPosition=await page.locator('.answer-options input').evaluateAll((inputs,w)=>inputs.findIndex(input=>Number(input.value)===w),wrong);await page.locator('.answer-options input').first().focus();await page.keyboard.press(String(wrongPosition+1));await page.locator('input[name="confidence"][value="low"]').check();await page.locator('[data-action="reveal-hint"]').click();
  await page.reload();await page.locator('[data-action="resume-quiz"]').click();assert.equal(await page.locator(`input[name="choice"][value="${wrong}"]`).isChecked(),true);assert.equal(await page.locator('input[name="confidence"][value="low"]').isChecked(),true);assert.equal(await page.locator('.hint-box li').count(),1);
  await page.locator('#quiz-answer-form button[type="submit"]').click();
  await page.reload();await page.locator('[data-action="resume-quiz"]').click();assert.equal((await store()).attempts.length,1);check('再読込後の演習再開、選択・自信・ヒント・回答の重複防止');
  assert.match(await page.locator('.feedback-title').innerText(),/不正解/);assert.equal((await store()).attempts.at(-1).correct,false);
  assert.equal(await page.locator('.distractor-details li').count(),4);
  await page.locator('[data-question-bookmark]').click();await page.locator('#mistake-note-form [name="reason"]').fill('直径を取り違えた');await page.locator('#mistake-note-form [name="memory"]').fill('fD/u を先に書く');await page.locator('#mistake-note-form button[type="submit"]').click();
  await page.locator('[data-action="open-report"]').click();assert.equal(await page.locator('.modal-close').evaluate(el=>document.activeElement===el),true);await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#report-form button').evaluate(el=>document.activeElement===el),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.report-modal').count(),0);
  await page.locator('[data-action="open-report"]').click();await page.locator('#report-form [name="message"]').fill('自動確認用の報告');await page.locator('#report-form button[type="submit"]').click();
  saved=await store();assert.equal(saved.questionBookmarks.length,1);assert.equal(saved.mistakeNotes[q.id].reason,'直径を取り違えた');assert.equal(saved.questionReports[q.id].length,1);
  await page.locator('[data-action="next-question"]').click();assert.equal((await store()).sessions.length,1);assert.match(await page.locator('.main-content').innerText(),/ふり返|振り返/);
  await nav('review');assert.match(await page.locator('.review-list').innerText(),/直近の誤答/);check('回答・4択理由・自信度・ブックマーク・間違いノート・報告・振り返り・復習');
  await nav('settings');const downloadPromise=page.waitForEvent('download');await page.locator('[data-action="export-data"]').click();const download=await downloadPromise;
  let exported;const failure=await download.failure();
  if(failure){limitations.push(`この実行環境でファイルダウンロードが中止された：${failure}。最小の独立したBlobダウンロードも同様。JSON表示経由で内容と復元を確認。`);await page.locator('[data-action="export-preview"]').click();exported=JSON.parse(await page.locator('#export-json').inputValue());}
  else exported=JSON.parse(await readFile(await download.path(),'utf8'));
  await page.locator('[data-action="export-preview"]').click();assert.equal(JSON.parse(await page.locator('#export-json').inputValue()).attempts.length,1);
  assert.equal(exported.attempts.length,1);const before=await store();await page.locator('#import-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...exported,notes:null}))});await page.locator('.import-feedback').getByText(/形式/).waitFor();assert.deepEqual(await store(),before);
  await page.locator('#import-file').setInputFiles({name:'learning.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.locator('[data-action="import-merge"]').click();assert.equal((await store()).attempts.length,1);check('JSON書き出し、不正な復元の拒否、重複しない追加復元');
  await page.locator('.backup-controls summary').click();const savedBeforePreview=await store();await page.locator('[data-action="preview-backup"]').click();assert.deepEqual(await store(),savedBeforePreview);assert.equal(await page.locator('[data-action="import-replace"]').count(),1);
  await page.locator('.backup-controls summary').click();const backupDownload=page.waitForEvent('download');await page.locator('[data-action="export-before-import"]').click();const backup=await backupDownload;assert.equal(await backup.failure(),null);assert.equal(JSON.parse(await readFile(await backup.path(),'utf8')).attempts.length,1);check('復元前の控えを確認・書き出し、確認だけでは現在のデータを変更しない');
  await nav('plan');await page.locator('#plan-form [name="goal"]').fill('熱の移動を説明する');await page.locator('#plan-form [name="minutesPerDay"]').selectOption('5');await page.locator('#plan-form button[type="submit"]').click();assert.equal((await store()).plan.active,true);assert.match(await page.locator('.suggested-steps').innerText(),/目安 2 分/);await page.locator('[data-action="stop-plan"]').click();assert.equal((await store()).plan.active,false);
  await nav('calendar');assert.match(await page.locator('.day-detail').innerText(),/円柱横流れ/);assert.equal(await page.locator('.calendar-day').count(),42);
  await nav('map');assert.match(await page.locator('.map-grid').first().innerText(),/記録不足/);
  await nav('glossary');await page.locator('#glossary-query').fill('ストローハル');assert.match(await page.locator('.glossary-grid').innerText(),/ストローハル/);check('学習計画の保存・停止、カレンダー、記録不足の分野表示、用語検索');
  await nav('simulator');assert.match(await page.locator('.sim-output-card').innerText(),/5,625|5625|5\.625/);
  await pickMode('resistance');assert.match(await page.locator('.result-number strong').innerText(),/70\.588/);await page.locator('.simulation-steps summary').nth(1).click();await page.locator('.simulation-steps summary').nth(2).click();assert.equal(await page.locator('.simulation-steps tbody tr').count(),4);assert.match(await page.locator('.simulation-steps').innerText(),/0\.85/);
  await page.setViewportSize({width:320,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.locator('.simulation-steps').scrollIntoViewIfNeeded();await shot('mobile-light-resistance-steps');await page.setViewportSize({width:1365,height:900});
  await page.locator('#sim-form [name="k1"]').fill('0');assert.match(await page.locator('.sim-error').innerText(),/0より大きい/);await page.locator('#sim-form [name="k1"]').fill('0.5');await page.locator('[data-action="save-comparison"]').click();assert.ok((await store()).simComparisons.resistance);
  await pickMode('convection');assert.match(await page.locator('.result-number strong').innerText(),/1,500|1500/);await pickMode('conduction');check('二層平板と両側対流の熱抵抗、界面温度、入力制限と比較条件の保存');
  await page.locator('#sim-form [name="thickness"]').fill('');assert.match(await page.locator('.sim-output-card').innerText(),/空欄/);await page.locator('#sim-form [name="thickness"]').fill('0.08');
  await pickMode('radiation');await page.locator('[data-action="save-comparison"]').click();await page.locator('#sim-form [name="surface"]').fill('10');
  assert.match(await page.locator('.sim-chart').getAttribute('aria-label'),/負の値/);assert.ok(!(await page.locator('.sim-chart').innerHTML()).match(/NaN|Infinity/));check('伝導・放射計算、空欄拒否、負方向と保存条件のグラフ');
  await page.locator('[data-action="toggle-theme"]').click();await shot('desktop-dark-simulator');
  for(const width of [320,390,760,1365]) {
    await page.setViewportSize({width,height:844});
    for(const route of ['home','reader','search','quiz','review','simulator','lab','glossary','map','plan','calendar','settings','guide']) {
      await nav(route);const overflow=await page.evaluate(()=>({body:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(overflow.body<=overflow.width+2,`${route}@${width}: ${JSON.stringify(overflow)}`);
      if(width===390&&['reader','quiz','simulator'].includes(route))await shot(`mobile-dark-${route}`);
    }
  }
  check('320・390・760・1365pxで全13画面の横はみ出し');
  await nav('review');await page.locator(`[data-start-question="${q.id}"]`).first().click();assert.match(await page.locator('.question-card h2').innerText(),/0\.020/);await page.setViewportSize({width:390,height:844});await shot('mobile-dark-active-question');
  await page.setViewportSize({width:390,height:844});await page.locator('[data-action="toggle-theme"]').click();await nav('reader');await shot('mobile-light-reader');
  assert.equal(await page.locator('[data-language="en"]').isDisabled(),true);assert.match(await page.locator('.language-note').first().innerText(),/原本PDF/);assert.equal((await store()).settings.contentLanguage,'ja');await page.locator('[data-block-id="7.6-b5"]').scrollIntoViewIfNeeded();await page.waitForTimeout(350);await shot('mobile-light-reader-formula');check('英語未収録の節では英語切替が無効で日本語設定が保持されること、本文中の式表示');
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(async()=>Boolean(await caches.match('./data/sections/7-6-ja.json')));
  await context.setOffline(true);await page.reload();await page.locator('.reader-title').waitFor();assert.match(await page.locator('.reader-title').innerText(),/7\.6/);assert.equal((await store()).attempts.length,1);await nav('quiz');check('オフラインでの教材・演習再読込と履歴保持');await context.setOffline(false);
  assert.deepEqual(errors,[]);check('ブラウザー実行時エラーなし');
  const publicContext=await browser.newContext({serviceWorkers:'block'}),publicPage=await publicContext.newPage();publicPage.setDefaultTimeout(60000);await publicPage.route('**/data/local-content-manifest.json',route=>route.fulfill({status:404,body:''}));await publicPage.goto(base);await publicPage.locator('.app-shell').waitFor();assert.match(await publicPage.locator('.app-footer').innerText(),/全76節に収録/);await publicContext.close();check('ローカル教材がなくても収録済み教材（全76節）で起動');
  const timeContext=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',timezoneId:'Asia/Tokyo'}),timePage=await timeContext.newPage();timePage.setDefaultTimeout(60000);timePage.setDefaultNavigationTimeout(60000);timePage.on('pageerror',error=>errors.push(error.message));
  await timePage.clock.install({time:new Date('2026-10-20T03:00:00Z')});await timePage.goto(`${base}/#reader`);await timePage.locator('.reader-title').waitFor();
  await timePage.locator('.reader-toc details').filter({has:timePage.locator('[data-section="8.2"]')}).locator('summary').click();await timePage.locator('.reader-toc [data-section="8.2"]').click();
  await timePage.locator('.reader-title').waitFor();assert.match(await timePage.locator('.reader-title').innerText(),/8\.2/);assert.equal(await timePage.locator('.formula-block').count(),7);assert.equal(await timePage.locator('.footnote').count(),1);
  await timePage.clock.runFor(10000);const timeStore=()=>timePage.evaluate(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1')));let timed=await timeStore();assert.ok(timed.activities.some(a=>a.kind==='reading'&&a.sectionId==='8.2'&&a.seconds>=9));
  await timePage.clock.runFor(120000);timed=await timeStore();const idleSeconds=timed.activities.filter(a=>a.sectionId==='8.2').reduce((n,a)=>n+a.seconds,0);assert.ok(idleSeconds>=89&&idleSeconds<=92,`idle time: ${idleSeconds}`);
  await timePage.clock.runFor(15000);assert.ok(Math.abs((await timeStore()).activities.filter(a=>a.sectionId==='8.2').reduce((n,a)=>n+a.seconds,0)-idleSeconds)<1);
  assert.equal(await timePage.locator('[data-language="en"]').isDisabled(),true);
  await timePage.locator('.main-nav a[href="#calendar"]').click();assert.match(await timePage.locator('.day-detail').innerText(),/計測した学習時間|学習時間/);await timePage.screenshot({path:resolve(output,'mobile-dark-calendar-time.png')});
  await timePage.locator('.main-nav a[href="#quiz"]').click();if(await timePage.locator('#question-bank-panel').isHidden())await timePage.locator('[data-action="toggle-question-bank"]').click();await timePage.locator('[data-start-question="supp-flat-thickness"]').click();assert.equal(await timePage.locator('.question-figure .wall-diagram').count(),1);await timePage.screenshot({path:resolve(output,'mobile-dark-ch8-question.png')});
  await timePage.locator('[data-action="exit-quiz"]').click();await timePage.locator('[data-action="discard-quiz"]').click();await timePage.locator('.main-nav a[href="#reader"]').click();await timePage.locator('.reader-toc [data-section="8.3"]').click();assert.equal(await timePage.locator('.book-figure').count(),4);
  for(const img of await timePage.locator('.lesson-diagram img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(img=>img.decode());assert.ok(await img.evaluate(img=>img.naturalWidth>0));}
  assert.equal(await timePage.locator('.footnote').count(),4);await timePage.locator('.formula-block').filter({has:timePage.getByText('式（8.27）',{exact:true})}).scrollIntoViewIfNeeded();await timePage.screenshot({path:resolve(output,'mobile-dark-ch8-mean-formula.png')});
  await timePage.locator('.main-nav a[href="#simulator"]').click();assert.ok(await timePage.evaluate(()=>window.scrollY<10));await timePage.locator('[data-sim-practice]').click();assert.equal(await timePage.locator('#quiz-start-form').count(),1);assert.ok(await timePage.evaluate(()=>window.scrollY<10));check('§8.3の4図・脚注・平均値の式と、画面移動時の先頭表示・関連演習');
  await timeContext.close();assert.deepEqual(errors,[]);check('第8章の式・脚注・図つき問題・英語切替の無効表示と、時計を進めた読書時間・90秒無操作除外・カレンダー保存');
  const report={date:'2026-10-20',browser:await browser.version(),passed,limitations,screenshots:['desktop-light-home','desktop-dark-simulator','mobile-dark-reader','mobile-dark-quiz','mobile-dark-active-question','mobile-dark-simulator','mobile-light-reader','mobile-light-reader-formula'],externalExpertReview:false};
  await writeFile(resolve(output,'browser-report.json'),JSON.stringify(report,null,2));
}catch(error){await shot('failure').catch(()=>{});await writeFile(resolve(output,'browser-failure.txt'),`${error.stack}\n\n${await page.locator('body').innerText().catch(()=> '')}`);console.error(error);process.exitCode=1;}
finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
