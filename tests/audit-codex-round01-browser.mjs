// Independent regressions for term navigation, including a saved empty deck.
// Run after build:public with BROWSER_ENGINE=chromium or webkit.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startServer} from '../scripts/serve.mjs';
import {createEmptyState} from '../study-core.mjs';

const require = createRequire(import.meta.url);
const engine = process.env.BROWSER_ENGINE || 'chromium';
const engines = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
assert.ok(['chromium','webkit','firefox'].includes(engine));
const terms = JSON.parse(await readFile(new URL('../data/glossary.json',import.meta.url),'utf8'));
const server = await startServer({root:fileURLToPath(new URL('../dist',import.meta.url)),port:0});
const browser = await engines[engine].launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {}),
  args:engine==='chromium'?['--no-sandbox']:[]});
const errors=[];
try {
  const context = await browser.newContext({viewport:{width:375,height:812},serviceWorkers:'block'});
  const page = await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  const base=`http://127.0.0.1:${server.address().port}`;
  await page.goto(base);
  await page.locator('.app-shell').waitFor();
  const seed=createEmptyState();
  seed.flashcards={...seed.flashcards,mode:'cards',scope:'bookmarks',index:7,
    order:terms.slice(0,10).reverse().map(t=>t.id)};
  const key='heat-study-ja:v1';
  await page.evaluate(({key,seed})=>localStorage.setItem(key,JSON.stringify(seed)),{key,seed});
  const target=terms[20].id;
  await page.goto(`${base}/#term-${target}`);
  await page.reload();
  const row=page.locator(`[id="term-${target}"]`);
  await row.waitFor();
  assert.equal(await row.locator('[data-term-toggle]').getAttribute('aria-expanded'),'true');
  assert.equal(await row.locator('.term-body').isVisible(),true);
  await page.waitForFunction(id=>document.activeElement?.getAttribute('data-term-toggle')===id,target);
  const restored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  assert.equal(restored.flashcards.mode,'list');
  assert.deepEqual(restored.flashcards.order,seed.flashcards.order);
  assert.equal(restored.flashcards.index,7);
  assert.equal(await page.evaluate(()=>location.hash),`#term-${target}`);
  // A different anchor in the same route must expand the newly requested row.
  const second=terms[21].id;
  await page.evaluate(id=>{location.hash=`#term-${id}`;},second);
  await page.waitForFunction(id=>document.querySelector(`[data-term-toggle="${id}"]`)?.getAttribute('aria-expanded')==='true',second);
  // Direct modal-to-dictionary navigation must also escape an empty card deck.
  await page.locator('[data-mode="cards"]').click();
  await page.goto(base+'/#guide');
  await page.locator('[data-term-id]').first().click();
  const detail=page.locator('#term-overlay [data-term-detail]');
  const modalTarget=await detail.getAttribute('data-term-detail');
  await detail.click();
  await page.waitForFunction(id=>document.querySelector(`[data-term-toggle="${id}"]`)?.getAttribute('aria-expanded')==='true',modalTarget);
  assert.equal(await page.locator('#term-overlay').count(),0);
  assert.doesNotMatch(await page.locator('.notice-card').innerText(),/翻訳本文は未収録/);
  assert.match(await page.locator('.notice-card').innerText(),/専門家校閲は未実施/);
  // Page-level scrollWidth does not detect clipping inside a scrollable
  // figure. Check the actual diagram viewport at both narrow phone widths.
  for (const width of [320,375]) {
    await page.setViewportSize({width,height:812});
    await page.goto(base+'/#simulator');
    for (const mode of ['conduction','convection','radiation','resistance','transient']) {
      const picker=page.locator('[data-action="toggle-sim-picker"]');
      if(await picker.getAttribute('aria-expanded')!=='true')await picker.click();
      await page.locator(`[data-sim-mode="${mode}"]`).click();
      const geometry=await page.locator('.simulation-figure').evaluate(figure=>{
        const svg=figure.querySelector('svg'),box=svg.viewBox.baseVal;
        return {width:figure.clientWidth,scrollWidth:figure.scrollWidth,
          labels:[...svg.querySelectorAll('text')].map(text=>{
            const r=text.getBBox();return {text:text.textContent,fits:r.x>=box.x&&r.y>=box.y&&r.x+r.width<=box.x+box.width&&r.y+r.height<=box.y+box.height};
          })};
      });
      assert.ok(geometry.scrollWidth<=geometry.width,`${mode} at ${width}px: figure must not require horizontal scrolling`);
      assert.ok(geometry.labels.every(label=>label.fits),`${mode} at ${width}px: labels inside the viewBox ${JSON.stringify(geometry.labels)}`);
    }
  }
  assert.deepEqual(errors,[]);
  console.log(`${engine}: direct/same-route/modal term navigation preserves the saved deck and reveals the expanded dictionary row.`);
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
