import assert from 'node:assert/strict';import {mkdir,mkdtemp,cp} from 'node:fs/promises';import {existsSync} from 'node:fs';import {createRequire} from 'node:module';import {startServer} from '../scripts/serve.mjs';import {solveGraetzChannel} from '../dynamic/dev/graetz-channel.mjs';import {sampleGraetz} from '../dynamic/dev/graetz-view.mjs';
assert.equal(existsSync(new URL('../dist/dynamic/dev',import.meta.url)),false);
const work=new URL('../work/',import.meta.url);await mkdir(work,{recursive:true});const root=await mkdtemp(new URL('graetz-browser-',work).pathname);await mkdir(root+'/dynamic/dev',{recursive:true});
for(const f of ['graetz-channel.mjs','graetz.html','graetz-ui.mjs','graetz-view.mjs','cavity.css'])await cp(new URL('../dynamic/dev/'+f,import.meta.url),root+'/dynamic/dev/'+f);
const engine=process.env.BROWSER_ENGINE||'chromium',engines=createRequire(import.meta.url)('playwright'),server=await startServer({root,port:0}),browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{...(process.env.BROWSER_EXECUTABLE||existsSync('/usr/bin/chromium')?{executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium'}:{}),args:['--no-sandbox']}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>localStorage.setItem('graetz-sentinel','keep'));
 await page.goto(`http://127.0.0.1:${server.address().port}/dynamic/dev/graetz.html`);
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='計算済み');assert.equal(await page.locator('#error').isVisible(),false);
 // Default screen (flux, 128x64) must match a direct solver call at the probe.
 const expected=solveGraetzChannel({width:.05,height:.01,depth:.01,nx:128,ny:64,rho:1.177,cp:1006,k:.0264,nu:1.575e-5,bulkVelocity:.5,inletTemperature:300,boundary:{type:'wall-heat-flux',wallHeatFlux:50}});
 const sample=sampleGraetz(expected,[.5,.5]),text=await page.locator('#readout').innerText();
 assert.ok(Math.abs(Number(text.match(/セル温度=([\d.]+) K/)[1])-sample.temperature)<6e-6);
 assert.ok(Math.abs(Number(text.match(/バルク温度=([\d.]+) K/)[1])-sample.bulkTemperature)<6e-6);
 assert.ok(Math.abs(Number(text.match(/局所Nu_Dh=([\d.]+)/)[1])-sample.localNusselt)<6e-5);
 await page.locator('#diagnostics').evaluate(e=>e.open=true);const d=await page.locator('#diagnostic-values').innerText();assert.match(d,/Re_Dh=/);assert.match(d,/収支残差=/);
 assert.ok(Math.abs(Number(d.match(/出口バルク温度=([\d.]+) K/)[1])-expected.outlet.bulkTemperature)<6e-6);
 // Keyboard probe moves the sampled column.
 await page.locator('#field').focus();const before=await page.locator('#readout').innerText();await page.keyboard.press('ArrowRight');const after=await page.locator('#readout').innerText();assert.notEqual(after,before);
 // Switching to constant wall temperature recomputes and stays physical.
 await page.locator('#bc').selectOption('wall-temperature');await page.locator('#apply').click();await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='計算済み');
 const expectedTw=solveGraetzChannel({width:.05,height:.01,depth:.01,nx:128,ny:64,rho:1.177,cp:1006,k:.0264,nu:1.575e-5,bulkVelocity:.5,inletTemperature:300,boundary:{type:'wall-temperature',wallTemperature:320}});
 const dTw=await page.locator('#diagnostic-values').innerText();assert.ok(Math.abs(Number(dTw.match(/出口バルク温度=([\d.]+) K/)[1])-expectedTw.outlet.bulkTemperature)<6e-6);
 // One-sided heating (lower wall flux, upper wall adiabatic) recomputes and
 // shows an asymmetric wall pair.
 await page.locator('#bc').selectOption('wall-heat-flux-insulated');await page.locator('#apply').click();await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='計算済み');
 const expectedIns=solveGraetzChannel({width:.05,height:.01,depth:.01,nx:128,ny:64,rho:1.177,cp:1006,k:.0264,nu:1.575e-5,bulkVelocity:.5,inletTemperature:300,boundary:{type:'wall-heat-flux-insulated',wallHeatFlux:50}});
 const dIns=await page.locator('#diagnostic-values').innerText();assert.ok(Math.abs(Number(dIns.match(/出口バルク温度=([\d.]+) K/)[1])-expectedIns.outlet.bulkTemperature)<6e-6);
 const readoutIns=await page.locator('#readout').innerText();assert.ok(Math.abs(Number(readoutIns.match(/下壁=([\d.]+) K/)[1])-Number(readoutIns.match(/上壁=([\d.]+) K/)[1]))>0.1);
 // Out-of-domain input is rejected with a Japanese message, not silently solved.
 await page.locator('#bc').selectOption('wall-heat-flux');await page.locator('#speed').fill('20');await page.locator('#apply').click();
 await page.waitForFunction(()=>!document.querySelector('#error').hidden);assert.match(await page.locator('#error').innerText(),/Re_Dh上限2300/);
 assert.match(await page.locator('#status').innerText(),/^計算できません/);
 // Theory/limits text lives at the bottom of the page.
 await page.locator('#theory').evaluate(e=>e.open=true);const theory=await page.locator('#theory').innerText();assert.match(theory,/Pe_Dh≥100/);assert.match(theory,/水力学的な入口発達/);assert.match(theory,/140\/17/);assert.match(theory,/5\.385/);assert.match(theory,/断熱/);
 for(const width of [375,390,1280])for(const colorScheme of ['light','dark']){await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme});await page.waitForTimeout(80);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}/${colorScheme}`);assert.ok(await page.locator('#field').evaluate(c=>Math.abs(c.width/devicePixelRatio-c.clientWidth)<2));}
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(80);await page.screenshot({path:new URL(`../work/graetz-${engine}-mobile-dark.png`,import.meta.url).pathname,fullPage:true});
 assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),{'graetz-sentinel':'keep'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({engine,developmentOnly:true,uiMatchesDirectSolver:true,wallTemperatureMode:true,oneSidedFluxInsulatedMode:true,invalidInputRejectedAtomically:true,keyboardProbe:true,mobileLightDark:true,widths375_390_1280:true,localStorageUnchanged:true,offlineVerified:false,passed:true}));
 await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
