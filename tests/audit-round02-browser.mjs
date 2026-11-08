import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startServer} from '../scripts/serve.mjs';
import {createEmptyState,localDay} from '../study-core.mjs';

const require=createRequire(import.meta.url),engine=process.env.BROWSER_ENGINE||'chromium';
const engines=require('playwright');
const server=await startServer({root:fileURLToPath(new URL('../dist',import.meta.url)),port:0});
let browser;
try{
  browser=await engines[engine].launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:engine==='chromium'?['--no-sandbox']:[]});
  const context=await browser.newContext({viewport:{width:375,height:844}}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=`http://127.0.0.1:${server.address().port}`;
  const terms=JSON.parse(await readFile(new URL('../data/glossary.json',import.meta.url),'utf8'));
  await page.goto(base+'/#term-fin-efficiency');
  await page.locator('#term-fin-efficiency .term-toggle').waitFor();
  const repeated=await page.evaluate(()=>[...document.querySelectorAll('.term-row')].flatMap(row=>{
    const brief=row.querySelector('.term-brief').textContent;
    return [...row.querySelectorAll('.term-body >p:not(.term-beginner):not(.term-unit):not(.term-formula)')]
      .filter(p=>p.textContent===brief).map(()=>row.id);
  }));
  assert.deepEqual(repeated,[],'equal definitions must not appear twice in expanded rows');
  assert.equal(await page.locator('.term-row').count(),terms.length);
  for(const term of terms.filter(t=>t.reviewStatus==='needs_review')){
    assert.match(await page.locator(`[id="term-body-${term.id}"]`).textContent(),/校閲前/,term.id);
  }
  const seed=createEmptyState();seed.flashcards={...seed.flashcards,mode:'cards',index:terms.findIndex(t=>t.id==='fin-efficiency'),flipped:true};
  await page.evaluate(seed=>localStorage.setItem('heat-study-ja:v1',JSON.stringify(seed)),seed);
  await page.goto(base+'/#glossary');await page.reload();await page.locator('.flash-back').waitFor();
  const duplicate=await page.locator('.flash-scroll').evaluate(el=>{
    const text=el.querySelector('.flash-brief').textContent;
    return [...el.querySelectorAll(':scope >p')].filter(p=>p.textContent===text).length;
  });
  assert.equal(duplicate,1,'the brief occurs once on a card back, not twice');

  await page.goto(base+'/#reader/8.4');
  const printedMean=page.locator('.formula-block').filter({has:page.getByText('式（8.44b）',{exact:true})});
  await printedMean.waitFor();
  assert.match(await printedMean.textContent(),/原典印刷式/);
  assert.match(await printedMean.textContent(),/独立導出/);

  const now=new Date(),stored=createEmptyState();
  stored.sessions=[{id:'audit-inconsistent',date:localDay(now),startedAt:now.toISOString(),total:99,correct:99,answers:[]}];
  await page.evaluate(stored=>localStorage.setItem('heat-study-ja:v1',JSON.stringify(stored)),stored);
  await page.goto(base+'/#calendar');await page.reload();await page.locator('.session-entry').waitFor();
  assert.match(await page.locator('.session-entry').innerText(),/保存時集計：99問/);
  assert.match(await page.locator('.session-entry').innerText(),/一致しません/);
  assert.match(await page.locator('.day-stats').innerText(),/^0\s+回答数\s+0\s+正解$/);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1')).sessions[0]),stored.sessions[0]);

  const manifest=await (await page.request.get(base+'/manifest.json')).json();
  for(const size of [192,512]){
    const icon=manifest.icons.find(icon=>icon.sizes===`${size}x${size}`&&icon.type==='image/png');
    assert.ok(icon,`raster PWA icon ${size}`);
    const response=await page.request.get(base+'/'+icon.src),png=await response.body();
    assert.equal(response.status(),200);assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
  }
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(async()=>Boolean(await caches.match('./assets/icon-192.png'))&&Boolean(await caches.match('./assets/icon-512.png')));
  await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  await context.setOffline(true);
  const iconStatuses=await page.evaluate(async()=>Promise.all(['./assets/icon-192.png','./assets/icon-512.png'].map(async path=>(await fetch(path)).status)));
  assert.deepEqual(iconStatuses,[200,200]);
  assert.deepEqual(errors,[]);
  console.log(`${engine}: glossary definitions/review labels, card back, truthful session snapshot and 192/512 offline PNG icons pass.`);
  await context.close();
}finally{
  await browser?.close();await new Promise(resolve=>server.close(resolve));
}
