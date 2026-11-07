import assert from 'node:assert/strict';import {mkdir,mkdtemp,cp} from 'node:fs/promises';import {existsSync} from 'node:fs';import {createRequire} from 'node:module';import {startServer} from '../scripts/serve.mjs';import {createRadialMultilayer} from '../dynamic/dev/radial-multilayer.mjs';import {buildMultilayerConfig,MULTILAYER_PRESETS} from '../dynamic/dev/radial-multilayer-ui-config.mjs';
const work=new URL('../work/',import.meta.url);await mkdir(work,{recursive:true});const root=await mkdtemp(new URL('radial-multilayer-browser-',work).pathname);await mkdir(root+'/dynamic/dev',{recursive:true});
for(const file of ['radial-multilayer.mjs','radial-multilayer.html','radial-multilayer-ui.mjs','radial-multilayer-ui-config.mjs','radial-multilayer-view.mjs','cavity.css'])await cp(new URL('../dynamic/dev/'+file,import.meta.url),root+'/dynamic/dev/'+file);
await cp(new URL('../dynamic/surface-exchange.mjs',import.meta.url),root+'/dynamic/surface-exchange.mjs');
const engine=process.env.BROWSER_ENGINE||'chromium',engines=createRequire(import.meta.url)('playwright'),server=await startServer({root,port:0}),browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{...(process.env.BROWSER_EXECUTABLE||existsSync('/usr/bin/chromium')?{executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium'}:{}),args:['--no-sandbox']}: {})});
function steady(model){for(let n=0;;n++){for(let i=0;i<500;i++)model.step(model.safeDt,false);const s=model.snapshot(),scale=Math.max(1,Math.abs(s.innerInwardWatts),Math.abs(s.outerInwardWatts));if(Math.abs(s.innerInwardWatts+s.outerInwardWatts)/scale<1e-8)return s;if(n>16000)throw Error('定常へ到達しませんでした。');}}
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>localStorage.setItem('radial-gui-sentinel','keep'));
 const ready=async()=>{await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='準備完了');assert.equal(await page.locator('#error').isVisible(),false);};
 const readout=async()=>page.locator('#readout').innerText();
 const jumpOf=text=>Number(text.match(/ジャンプ ([\d.]+) K/)[1]);
 const outerQOf=text=>Number(text.match(/外面の外向き熱流=([\d.-]+) W/)[1]);
 const outerSurfaceOf=text=>Number(text.match(/外面温度=([\d.]+) K/)[1]);
 const stepFrame=async()=>{const t=await page.locator('#clock').innerText();await page.locator('#step').click();await page.waitForFunction(old=>document.querySelector('#clock').textContent!==old,t,{timeout:120000});};
 const runUntilStable=async(extract,tolerance,maxFrames)=>{let prev=extract(await readout());for(let i=0;i<maxFrames;i++){await stepFrame();const value=extract(await readout());if(Math.abs(value-prev)<tolerance)return value;prev=value;}throw Error('画面が定常へ到達しませんでした。');};
 await page.goto(`http://127.0.0.1:${server.address().port}/dynamic/dev/radial-multilayer.html`);await ready();
 assert.equal(await page.locator('#clock').innerText(),'0.000 s');
 assert.equal(jumpOf(await readout()),0,'uniform initial field has no interface jump');
 const blank=await page.locator('#field').evaluate(c=>c.toDataURL());
 // Contact-resistance preset (default): run the screen to steady state and
 // compare against the core run in this process and the analytic reference.
 await page.locator('#interval').fill('5');
 const screenJump=await runUntilStable(jumpOf,0.002,15),screenQ=outerQOf(await readout());
 const kernel=createRadialMultilayer(buildMultilayerConfig(structuredClone(MULTILAYER_PRESETS.contact.values)));
 const kernelSteady=steady(kernel),kernelJump=kernel.flux().interfaces[0].temperatureJump;
 assert.ok(Math.abs(screenJump-kernelJump)<0.01,`screen jump ${screenJump} vs kernel ${kernelJump}`);
 assert.ok(Math.abs(screenJump-56.7188)<0.01,`screen jump ${screenJump} vs analytic 56.7188`);
 assert.ok(Math.abs(screenQ-(-kernelSteady.outerInwardWatts))<0.05,`screen Q ${screenQ} vs kernel ${-kernelSteady.outerInwardWatts}`);
 assert.ok(Math.abs(screenQ-42.765)<0.05,`screen Q ${screenQ} vs reference 42.7650`);
 const probeTemp=Number((await readout()).match(/）：([\d.]+) K/)[1]);
 assert.ok(Math.abs(probeTemp-kernelSteady.temperature[16])<0.05,`probe ${probeTemp} vs kernel ${kernelSteady.temperature[16]}`);
 assert.notEqual(await page.locator('#field').evaluate(c=>c.toDataURL()),blank);
 // Rewind and restart restore earlier states exactly.
 const steadyClock=await page.locator('#clock').innerText();await page.locator('#back').click();await page.waitForFunction(old=>document.querySelector('#clock').textContent!==old,steadyClock);
 await page.locator('#restart').click();await page.waitForFunction(()=>document.querySelector('#clock').textContent==='0.000 s');
 assert.equal(jumpOf(await readout()),0);assert.match(await readout(),/）：350\.0000 K/);
 // Sphere two-layer convection preset: outer surface temperature and heat
 // rate agree with the core at steady state.
 await page.locator('#preset').selectOption('sphereConvection');await ready();
 await page.locator('#interval').fill('10');
 const screenOuterSurface=await runUntilStable(outerSurfaceOf,0.005,25),screenSphereQ=outerQOf(await readout());
 const sphereKernel=createRadialMultilayer(buildMultilayerConfig(structuredClone(MULTILAYER_PRESETS.sphereConvection.values)));
 const sphereSteady=steady(sphereKernel);
 assert.ok(Math.abs(screenOuterSurface-sphereSteady.outerSurfaceTemperature)<0.01,`screen outer surface ${screenOuterSurface} vs kernel ${sphereSteady.outerSurfaceTemperature}`);
 assert.ok(Math.abs(screenOuterSurface-325.765)<0.01,`screen outer surface ${screenOuterSurface} vs reference 325.7650`);
 assert.ok(Math.abs(screenSphereQ-(-sphereSteady.outerInwardWatts))<0.01,`screen sphere Q ${screenSphereQ} vs kernel ${-sphereSteady.outerInwardWatts}`);
 // Layer editing: add a layer (interfaces follow), then remove it again.
 await page.locator('#preset').selectOption('contact');await ready();
 assert.equal(await page.locator('.layer-row').count(),2);assert.equal(await page.locator('#interfaces input').count(),1);
 await page.locator('#add-layer').click();assert.equal(await page.locator('.layer-row').count(),3);assert.equal(await page.locator('#interfaces input').count(),2);
 await page.locator('.layer-row').nth(2).locator('button',{hasText:'削除'}).click();assert.equal(await page.locator('.layer-row').count(),2);assert.equal(await page.locator('#interfaces input').count(),1);
 // Invalid input is refused with the core's own words; accepted state stays.
 const acceptedReadout=await readout(),acceptedClock=await page.locator('#clock').innerText();
 await page.locator('.layer-row').nth(0).locator('[data-layer-field="k"]').fill('0');await page.locator('#apply').click();await page.waitForFunction(()=>!document.querySelector('#error').hidden);
 assert.match(await page.locator('#error').innerText(),/熱伝導率は正の値です。/);
 assert.equal(await readout(),acceptedReadout);assert.equal(await page.locator('#clock').innerText(),acceptedClock);
 await page.locator('.layer-row').nth(0).locator('[data-layer-field="k"]').fill('8');
 await page.locator('#inner-radius').fill('0');await page.locator('#apply').click();await page.waitForFunction(()=>!document.querySelector('#error').hidden);
 assert.match(await page.locator('#error').innerText(),/中実形状には内面の境界条件を指定できません。/);
 assert.equal(await readout(),acceptedReadout);
 await page.locator('#inner-radius').fill('3');await page.locator('#apply').click();await ready();
 // Layout: no horizontal overflow and no clipped canvas at any width, both schemes.
 for(const width of [375,390,1280,1920])for(const colorScheme of ['light','dark']){await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme});await page.waitForTimeout(80);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}/${colorScheme}`);assert.ok(await page.locator('#field').evaluate(c=>Math.abs(c.width/devicePixelRatio-c.clientWidth)<2));assert.ok(await page.locator('#graph').evaluate(c=>Math.abs(c.width/devicePixelRatio-c.clientWidth)<2));}
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(80);await page.screenshot({path:new URL(`../work/radial-multilayer-${engine}-390-dark.png`,import.meta.url).pathname,fullPage:true});
 await page.setViewportSize({width:375,height:844});await page.emulateMedia({colorScheme:'light'});await page.waitForTimeout(80);await page.screenshot({path:new URL(`../work/radial-multilayer-${engine}-375-light.png`,import.meta.url).pathname,fullPage:true});
 assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),{'radial-gui-sentinel':'keep'});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine,developmentOnly:true,contactJumpK:screenJump,contactHeatRateW:screenQ,sphereOuterSurfaceK:screenOuterSurface,sphereHeatRateW:screenSphereQ,screenMatchesKernel:true,layerEditing:true,rewindAndRestart:true,invalidInputRejectedWithCoreReason:true,mobileDesktopLightDark:true,localStorageUnchanged:true,webKitVerified:false,offlineVerified:false,passed:true}));await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
