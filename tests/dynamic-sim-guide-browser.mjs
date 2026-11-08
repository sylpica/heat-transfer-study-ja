// Browser verification for the popup simulation guide (dynamic/sim-guide.mjs).
// Serves the source tree, walks every step of the lab guide and one dev
// screen guide in Chromium, and checks anchoring, viewport clamping, focus
// handling, Escape/outside-click close, and the persisted on/off preference.
// Not part of `npm test` (matches the *-browser.mjs convention); run with:
//   node tests/dynamic-sim-guide-browser.mjs
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {startServer} from '../scripts/serve.mjs';

const engines=createRequire(import.meta.url)('playwright');
const engine=process.env.BROWSER_ENGINE||'chromium';
const browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.BROWSER_EXECUTABLE||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']}:{})});
const server=await startServer({port:0});
const base=`http://127.0.0.1:${server.address().port}`;
const results=[];

async function checkPopupInViewport(page,label){
  const box=await page.evaluate(()=>{
    const popup=document.querySelector('.sim-guide-popup');
    if(!popup||popup.hidden)return null;
    const r=popup.getBoundingClientRect();
    return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,vw:innerWidth,vh:innerHeight,
      docOverflow:document.documentElement.scrollWidth-innerWidth,
      textClipped:popup.scrollWidth>popup.clientWidth+1};
  });
  assert.ok(box,`${label}: popup visible`);
  assert.ok(box.left>=0&&box.top>=0&&box.right<=box.vw&&box.bottom<=box.vh,`${label}: popup inside viewport ${JSON.stringify(box)}`);
  assert.ok(box.docOverflow<=0,`${label}: no horizontal page overflow (${box.docOverflow})`);
  assert.equal(box.textClipped,false,`${label}: popup text not clipped`);
  return box;
}

async function walkGuide(page,{steps,label}){
  await page.locator('.sim-guide-toggle').click();
  await page.waitForFunction(()=>!document.querySelector('.sim-guide-popup').hidden);
  assert.equal(await page.locator('.sim-guide-toggle').getAttribute('aria-pressed'),'true',`${label}: toggle pressed`);
  assert.ok(await page.evaluate(()=>document.querySelector('.sim-guide-popup').contains(document.activeElement)),`${label}: focus moved into popup`);
  for(let i=0;i<steps;i++){
    const state=await page.evaluate(()=>{
      const popup=document.querySelector('.sim-guide-popup');
      return {count:popup.querySelector('.sim-guide-count').textContent,
        highlighted:document.querySelectorAll('.sim-guide-target').length,
        nextDisabled:popup.querySelectorAll('.sim-guide-nav button')[1].disabled};
    });
    assert.equal(state.count,`${i+1} / ${steps}`,`${label}: counter at step ${i+1}`);
    assert.equal(state.highlighted,1,`${label}: exactly one highlighted target at step ${i+1}`);
    await checkPopupInViewport(page,`${label} step ${i+1}`);
    if(i<steps-1)await page.locator('.sim-guide-nav button').nth(1).click();
    else assert.equal(state.nextDisabled,true,`${label}: next disabled on last step`);
  }
}

try{
  for(const [width,height] of [[375,667],[390,844],[1280,800],[1920,1080]]){
    for(const theme of ['light','dark']){
      const context=await browser.newContext({viewport:{width,height}});
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(String(e)));
      await page.goto(`${base}/dynamic/index.html`);
      await page.waitForSelector('.sim-guide-toggle',{timeout:30000});
      await page.selectOption('#theme',theme);
      assert.equal(await page.evaluate(()=>document.querySelector('.sim-guide-popup').hidden),true,`lab ${width}/${theme}: guide off by default`);
      assert.equal(await page.evaluate(()=>localStorage.getItem('heat-sim-guide:lab')),null,`lab ${width}/${theme}: no stored preference yet`);
      await walkGuide(page,{steps:8,label:`lab ${width}/${theme}`});
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>document.querySelector('.sim-guide-popup').hidden);
      assert.equal(await page.locator('.sim-guide-toggle').getAttribute('aria-pressed'),'false',`lab ${width}/${theme}: Escape switches the toggle off`);
      assert.equal(await page.evaluate(()=>localStorage.getItem('heat-sim-guide:lab')),'off',`lab ${width}/${theme}: off persisted`);
      assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('sim-guide-toggle')),true,`lab ${width}/${theme}: focus returned to the toggle`);
      assert.deepEqual(errors,[],`lab ${width}/${theme}: no pageerror`);
      results.push(`lab ${width}x${height} ${theme}: 8 steps walked, popup clamped, Esc close, focus restored`);
      await context.close();
    }
  }
  // Persistence: turn on, reload, guide auto-opens; close with 閉じる.
  {
    const context=await browser.newContext({viewport:{width:1280,height:800}});
    const page=await context.newPage();
    await page.goto(`${base}/dynamic/index.html`);
    await page.waitForSelector('.sim-guide-toggle',{timeout:30000});
    await page.locator('.sim-guide-toggle').click();
    await page.waitForFunction(()=>!document.querySelector('.sim-guide-popup').hidden);
    assert.equal(await page.evaluate(()=>localStorage.getItem('heat-sim-guide:lab')),'on','lab: on persisted');
    await page.reload();
    await page.waitForFunction(()=>!document.querySelector('.sim-guide-popup').hidden,null,{timeout:30000});
    results.push('lab: preference on -> guide auto-opens after reload');
    // term link: navigate to step 3 and follow a term into a new tab
    await page.locator('.sim-guide-nav button').nth(1).click();
    await page.locator('.sim-guide-nav button').nth(1).click();
    await page.waitForFunction(()=>document.querySelectorAll('.sim-guide-popup .inline-term').length>0,null,{timeout:15000});
    const termId=await page.evaluate(()=>document.querySelector('.sim-guide-popup .inline-term').dataset.termId);
    const [tab]=await Promise.all([context.waitForEvent('page',{timeout:15000}),page.locator('.sim-guide-popup .inline-term').first().click()]);
    await tab.waitForLoadState('domcontentloaded');
    assert.ok(tab.url().includes(`#term-${termId}`),`lab: term opens glossary entry ${termId} in a new tab (${tab.url()})`);
    results.push(`lab: term link opens ../index.html#term-${termId} in a new tab`);
    await tab.close();
    await page.locator('.sim-guide-nav button').nth(2).click();
    await page.waitForFunction(()=>document.querySelector('.sim-guide-popup').hidden);
    assert.equal(await page.evaluate(()=>localStorage.getItem('heat-sim-guide:lab')),'off','lab: close persists off');
    // outside click also closes
    await page.locator('.sim-guide-toggle').click();
    await page.waitForFunction(()=>!document.querySelector('.sim-guide-popup').hidden);
    await page.mouse.click(20,500);
    await page.waitForFunction(()=>document.querySelector('.sim-guide-popup').hidden);
    results.push('lab: outside click closes the guide');
    await context.close();
  }
  // One dev screen (natural convection cavity), small and large widths.
  for(const [width,height,theme] of [[375,667,'light'],[1280,800,'dark']]){
    const context=await browser.newContext({viewport:{width,height},colorScheme:theme});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(`${base}/dynamic/dev/cavity.html`);
    await page.waitForSelector('.sim-guide-toggle',{timeout:30000});
    await walkGuide(page,{steps:5,label:`dev-cavity ${width}/${theme}`});
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('.sim-guide-popup').hidden);
    assert.equal(await page.evaluate(()=>localStorage.getItem('heat-sim-guide:dev-cavity')),'off','dev-cavity: off persisted under its own key');
    assert.deepEqual(errors,[],`dev-cavity ${width}/${theme}: no pageerror`);
    results.push(`dev-cavity ${width}x${height} ${theme}: 5 steps walked, popup clamped, Esc close`);
    await context.close();
  }
  console.log(JSON.stringify({engine,passed:true,results},null,2));
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
