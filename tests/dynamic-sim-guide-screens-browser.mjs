// Sweep for the popup guide on every applied dev screen: at 375px the
// toggle exists, the guide opens, exactly one target is highlighted, the
// popup stays inside the viewport, and Escape closes it. The full step walk
// is covered for the lab and cavity screens in
// tests/dynamic-sim-guide-browser.mjs. Run with:
//   node tests/dynamic-sim-guide-screens-browser.mjs
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {startServer} from '../scripts/serve.mjs';

const SCREENS=['cavity','natural-convection-wall','annular-fin','fin-convective-tip','heat-sink','box-radiation-3d','long-duct','transient-brick-3d','radial-multilayer'];
const engines=createRequire(import.meta.url)('playwright');
const engine=process.env.BROWSER_ENGINE||'chromium';
const browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.BROWSER_EXECUTABLE||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']}:{})});
const server=await startServer({port:0});
const base=`http://127.0.0.1:${server.address().port}`;
const results=[];
try{
  for(const name of SCREENS){
    const context=await browser.newContext({viewport:{width:375,height:667}});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(`${base}/dynamic/dev/${name}.html`);
    await page.waitForSelector('.sim-guide-toggle',{timeout:30000});
    await page.locator('.sim-guide-toggle').click();
    await page.waitForFunction(()=>!document.querySelector('.sim-guide-popup').hidden);
    const state=await page.evaluate(()=>{
      const popup=document.querySelector('.sim-guide-popup'),r=popup.getBoundingClientRect();
      return {count:popup.querySelector('.sim-guide-count').textContent,
        highlighted:document.querySelectorAll('.sim-guide-target').length,
        inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,
        overflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert.match(state.count,/^1 \/ [4-9]$/ ,`${name}: counter shows step 1 of N`);
    assert.equal(state.highlighted,1,`${name}: one highlighted target`);
    assert.equal(state.inside,true,`${name}: popup inside the 375px viewport`);
    assert.ok(state.overflow<=0,`${name}: no horizontal page overflow`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('.sim-guide-popup').hidden);
    assert.deepEqual(errors,[],`${name}: no pageerror`);
    results.push(`${name}: guide opens (${state.count}), popup clamped at 375px, Esc closes`);
    await context.close();
  }
  console.log(JSON.stringify({engine,passed:true,results},null,2));
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
