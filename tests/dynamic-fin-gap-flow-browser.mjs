import assert from 'node:assert/strict';import {mkdir,mkdtemp,cp} from 'node:fs/promises';import {existsSync} from 'node:fs';import {createRequire} from 'node:module';import {startServer} from '../scripts/serve.mjs';import {solveFinGapFlow} from '../dynamic/dev/fin-gap-flow.mjs';import {FINGAP_GUI_PRESETS,buildFinGapInput,formatTemperatureK,formatNusselt,formatPressurePa,formatVelocity,formatWatt} from '../dynamic/dev/fin-gap-flow-ui-config.mjs';
assert.equal(existsSync(new URL('../dist/dynamic/dev',import.meta.url)),false);const work=new URL('../work/',import.meta.url);await mkdir(work,{recursive:true});const root=await mkdtemp(new URL('fingap-gui-browser-',work).pathname);await mkdir(root+'/dynamic/dev',{recursive:true});
for(const file of ['fin-gap-flow.mjs','graetz-channel.mjs','fin-gap-flow.html','fin-gap-flow-ui.mjs','fin-gap-flow-ui-config.mjs','fin-gap-flow-view.mjs','cavity.css'])await cp(new URL('../dynamic/dev/'+file,import.meta.url),root+'/dynamic/dev/'+file);
// Core values computed here, in Node, at the exact preset conditions; the
// screen must reproduce them at the displayed digits.
const flux=solveFinGapFlow(buildFinGapInput(FINGAP_GUI_PRESETS.developedFlux.fields));
const temp=solveFinGapFlow(buildFinGapInput(FINGAP_GUI_PRESETS.developedTemp.fields));
const coreError=fields=>{try{solveFinGapFlow(buildFinGapInput(fields));}catch(e){return e.message;}throw Error('expected the core to reject');};
const reRefusal=coreError({...FINGAP_GUI_PRESETS.developedFlux.fields,driveValue:3});
const gapRefusal=coreError({...FINGAP_GUI_PRESETS.developedFlux.fields,gapMm:0});
const engine=process.env.BROWSER_ENGINE||'chromium',engines=createRequire(import.meta.url)('playwright'),server=await startServer({root,port:0}),browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{...(process.env.BROWSER_EXECUTABLE||existsSync('/usr/bin/chromium')?{executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium'}:{}),args:['--no-sandbox']}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const readout=()=>page.locator('#readout').innerText();
 await page.goto(`http://127.0.0.1:${server.address().port}/dynamic/dev/fin-gap-flow.html`);
 // The developed-flux preset auto-runs; screen values match the core.
 await page.waitForFunction(m=>document.querySelector('#readout').textContent.includes(m),`出口局所 Nu = ${formatNusselt(flux.thermal.outletLocalNusselt)}`,{timeout:60000});
 let text=await readout();
 assert.ok(text.includes(`出口バルク温度 = ${formatTemperatureK(flux.thermal.outletBulkTemperatureK)} K`),'outlet bulk on screen');
 assert.ok(text.includes(`圧力損失 Δp = ${formatPressurePa(flux.pressure.dropPa)} Pa`),'pressure on screen');
 assert.ok(text.includes(`総熱移動率 = ${formatWatt(flux.thermal.totalHeatRateW)} W`),'heat rate on screen');
 assert.equal(await page.locator('#error').isHidden(),true);
 // Layout: no horizontal overflow at any checked width, in either scheme.
 for(const scheme of ['light','dark']){
  await page.emulateMedia({colorScheme:scheme});
  for(const width of [375,390,1280,1920]){
   await page.setViewportSize({width,height:900});
   const overflow=await page.evaluate(()=>document.scrollingElement.scrollWidth-window.innerWidth);
   assert.ok(overflow<=0,`${scheme} ${width}px: horizontal overflow ${overflow}`);
  }
 }
 // The developed-temperature preset reproduces its core values.
 await page.setViewportSize({width:1280,height:900});
 await page.locator('#preset').selectOption('developedTemp');
 await page.waitForFunction(m=>document.querySelector('#readout').textContent.includes(m),`出口局所 Nu = ${formatNusselt(temp.thermal.outletLocalNusselt)}`,{timeout:60000});
 text=await readout();
 assert.ok(text.includes(`出口バルク温度 = ${formatTemperatureK(temp.thermal.outletBulkTemperatureK)} K`),'temp preset outlet on screen');
 assert.ok(text.includes(`平均流速 U = ${formatVelocity(temp.drive.bulkVelocityMPerS)} m/s`),'velocity on screen');
 // Refusals from the core reach the screen verbatim.
 await page.locator('#preset').selectOption('developedFlux');
 await page.locator('#drivevalue').fill('3');await page.locator('#apply').click();
 await page.waitForFunction(m=>document.querySelector('#error').textContent===m,reRefusal,{timeout:60000});
 assert.equal(await page.locator('#error').isHidden(),false);
 await page.locator('#drivevalue').fill('0.5');await page.locator('#gap').fill('0');await page.locator('#apply').click();
 await page.waitForFunction(m=>document.querySelector('#error').textContent===m,gapRefusal,{timeout:60000});
 assert.deepEqual(errors,[]);
 console.log('fin-gap-flow browser checks passed');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
