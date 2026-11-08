import assert from 'node:assert/strict';import {mkdir,mkdtemp,cp} from 'node:fs/promises';import {existsSync} from 'node:fs';import {createRequire} from 'node:module';import {startServer} from '../scripts/serve.mjs';import {solveHeatSinkCoupled} from '../dynamic/dev/heat-sink-coupled.mjs';import {COUPLED_GUI_PRESETS,buildCoupledInput,formatTemperatureK,formatPressurePa,formatRadiationW,formatFlowLMin} from '../dynamic/dev/heat-sink-coupled-ui-config.mjs';
assert.equal(existsSync(new URL('../dist/dynamic/dev',import.meta.url)),false);const work=new URL('../work/',import.meta.url);await mkdir(work,{recursive:true});const root=await mkdtemp(new URL('coupled-gui-browser-',work).pathname);await mkdir(root+'/dynamic/dev',{recursive:true});
for(const file of ['heat-sink-coupled.mjs','heat-sink-coupled.html','heat-sink-coupled-ui.mjs','heat-sink-coupled-ui-config.mjs','heat-sink-coupled-view.mjs','heat-sink-coupled-worker.mjs','cavity.css'])await cp(new URL('../dynamic/dev/'+file,import.meta.url),root+'/dynamic/dev/'+file);
// Core values computed here, in Node, at the exact preset conditions; the
// screen must reproduce them at the displayed digits.
const stdInput=buildCoupledInput(COUPLED_GUI_PRESETS.standard.fields);
const opts={refinement:4,hydraulicRefinement:2};
const std=solveHeatSinkCoupled(stdInput,opts);
const noRad=solveHeatSinkCoupled({...stdInput,emissivity:0},opts);
const coreError=input=>{try{solveHeatSinkCoupled(input,{refinement:1,hydraulicRefinement:1});}catch(e){return e.message;}throw Error('expected the core to reject');};
const flowRefusal=coreError({...stdInput,totalFlow:0});
const patchRefusal=coreError({...stdInput,patchWidth:0.05});
const engine=process.env.BROWSER_ENGINE||'chromium',engines=createRequire(import.meta.url)('playwright'),server=await startServer({root,port:0}),browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{...(process.env.BROWSER_EXECUTABLE||existsSync('/usr/bin/chromium')?{executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium'}:{}),args:['--no-sandbox']}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const readout=()=>page.locator('#readout').innerText();
 const waitReadout=async marker=>page.waitForFunction(m=>document.querySelector('#readout').textContent.includes(m),marker,{timeout:900000});
 await page.goto(`http://127.0.0.1:${server.address().port}/dynamic/dev/heat-sink-coupled.html`);
 // The standard preset auto-runs at r=4 in the worker; screen values match
 // the core result computed above to the displayed digits.
 await waitReadout(`発熱面平均温度 = ${formatTemperatureK(std.sourceAverageTemperatureK)} K`);let text=await readout();
 assert.ok(text.includes(`圧損 = ${formatPressurePa(std.pressureDropPa)} Pa`),'pressure on screen');
 assert.ok(text.includes(`放射（開口から周囲へ） = ${formatRadiationW(std.radiationApertureW)} W`),'radiation on screen');
 assert.ok(text.includes(`基部セル最大温度 = ${formatTemperatureK(std.maximumBaseCellTemperatureK)} K`),'base max on screen');
 const flows=await page.locator('#flowlist').innerText();
 assert.ok(flows.includes(`流路 1：流量 ${formatFlowLMin(std.channelFlowsM3PerS[0]*60000)} L/min`),'channel flow on screen');
 assert.ok(flows.includes(`出口バルク温度 ${formatTemperatureK(std.bulkTemperaturesK[0][std.nx-1])} K`),'outlet bulk on screen');
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
 // The no-radiation preset reproduces the convection-only core values.
 await page.setViewportSize({width:1280,height:900});
 await page.locator('#preset').selectOption('noRadiation');
 await waitReadout(`発熱面平均温度 = ${formatTemperatureK(noRad.sourceAverageTemperatureK)} K`);text=await readout();
 assert.ok(text.includes(`放射（開口から周囲へ） = ${formatRadiationW(noRad.radiationApertureW)} W`),'zero radiation on screen');
 await page.locator('#preset').selectOption('standard');
 // Pressure does not depend on emissivity, so wait on the temperature
 // line, which only the fresh standard render can produce.
 await waitReadout(`発熱面平均温度 = ${formatTemperatureK(std.sourceAverageTemperatureK)} K`);
 // Refusals from the core reach the screen verbatim.
 await page.locator('#flow').fill('0');await page.locator('#apply').click();
 await page.waitForFunction(m=>document.querySelector('#error').textContent===m,flowRefusal,{timeout:60000});
 assert.equal(await page.locator('#error').isHidden(),false);
 await page.locator('#flow').fill('43.2');await page.locator('#patchw').fill('50');await page.locator('#apply').click();
 await page.waitForFunction(m=>document.querySelector('#error').textContent===m,patchRefusal,{timeout:60000});
 assert.deepEqual(errors,[]);
 console.log('heat-sink-coupled browser checks passed');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
