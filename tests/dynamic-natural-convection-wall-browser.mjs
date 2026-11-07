import assert from 'node:assert/strict';import {mkdir,mkdtemp,cp} from 'node:fs/promises';import {existsSync} from 'node:fs';import {createRequire} from 'node:module';import {startServer} from '../scripts/serve.mjs';import {naturalConvectionVerticalWall,uniformHeatFluxVerticalWall} from '../dynamic/dev/natural-convection-wall.mjs';import {WALL_GUI_PRESETS,buildIsothermalWallInput,buildUniformFluxWallInput} from '../dynamic/dev/natural-convection-wall-ui-config.mjs';
assert.equal(existsSync(new URL('../dist/dynamic/dev',import.meta.url)),false);const work=new URL('../work/',import.meta.url);await mkdir(work,{recursive:true});const root=await mkdtemp(new URL('wall-gui-browser-',work).pathname);await mkdir(root+'/dynamic/dev',{recursive:true});
for(const file of ['natural-convection-wall.mjs','natural-convection-wall.html','natural-convection-wall-ui.mjs','natural-convection-wall-ui-config.mjs','cavity.css'])await cp(new URL('../dynamic/dev/'+file,import.meta.url),root+'/dynamic/dev/'+file);
const fmt=x=>String(Number(x.toPrecision(10)));
const ex81=naturalConvectionVerticalWall(buildIsothermalWallInput(WALL_GUI_PRESETS.ex81.fields));
const ex83=naturalConvectionVerticalWall(buildIsothermalWallInput(WALL_GUI_PRESETS.ex83.fields));
const uhf=uniformHeatFluxVerticalWall(buildUniformFluxWallInput(WALL_GUI_PRESETS.uhf.fields));
const coreError=(fn,input)=>{try{fn(input);}catch(e){return e.message;}throw Error('expected the core to reject');};
const engine=process.env.BROWSER_ENGINE||'chromium',engines=createRequire(import.meta.url)('playwright'),server=await startServer({root,port:0}),browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{...(process.env.BROWSER_EXECUTABLE||existsSync('/usr/bin/chromium')?{executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium'}:{}),args:['--no-sandbox']}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>localStorage.setItem('wall-gui-sentinel','keep'));
 const readout=()=>page.locator('#readout').innerText();
 const waitReadout=async(marker)=>page.waitForFunction(m=>document.querySelector('#readout').textContent.includes(m),marker);
 await page.goto(`http://127.0.0.1:${server.address().port}/dynamic/dev/natural-convection-wall.html`);
 // Initial state auto-computes the Example 8.1 defaults; screen values
 // match the core to the displayed digits (same 10-significant-digit
 // formatting applied to the core record computed here).
 await waitReadout(`Nu_L（相似解） = ${fmt(ex81.averageNusselt)}`);let text=await readout();
 assert.ok(text.includes(`Ra_L = ${fmt(ex81.rayleigh)}`),'Ra on screen');
 assert.ok(text.includes(`−θ′(0) = ${fmt(ex81.similarity.wallTemperatureGradient)}`),'theta prime on screen');
 assert.ok(text.includes(`Nu_L = ${fmt(ex81.churchillChu.averageNusselt)}`),'8.13a on screen');
 assert.ok(text.includes(`Nu_L = ${fmt(ex81.squireEckert.averageNusselt)}`),'8.27 on screen');
 assert.ok(Math.abs(ex81.averageNusselt-46.797)<0.001&&Math.abs(ex81.churchillChu.averageNusselt-47.346)<0.001,'verified anchors');
 assert.equal(await page.locator('#error').isHidden(),true);
 assert.equal(await page.locator('#profiles-isothermal').isVisible(),true);
 assert.equal(await page.locator('#profiles-uniform').isHidden(),true);
 // Example 8.3 preset.
 await page.locator('#preset').selectOption('ex83');await waitReadout(`Nu_L（相似解） = ${fmt(ex83.averageNusselt)}`);text=await readout();
 assert.ok(text.includes(`Nu_L = ${fmt(ex83.squireEckert.averageNusselt)}`),'ex83 8.27 on screen');
 assert.ok(text.includes(`最大速度 ${fmt(ex83.maxVelocityAtTopMPerS)} m/s`),'ex83 u_max on screen');
 // Uniform-flux preset: (8.44b) values, wall-temperature profile shown,
 // and the printed (8.44a) never appears in the results.
 await page.locator('#preset').selectOption('uhf');await waitReadout(`Nu_L（式8.44b） = ${fmt(uhf.averageNusselt)}`);text=await readout();
 assert.ok(text.includes(`Ra*_L = ${fmt(uhf.modifiedRayleigh)}`),'Ra* on screen');
 assert.ok(text.includes(`ΔT = ${fmt(uhf.meanDeltaTK)} K`),'mean dT on screen');
 assert.ok(text.includes(`Nu_L = ${fmt(uhf.churchillChu.averageNusselt)}`),'8.43b on screen');
 assert.ok(!text.includes('8.44a'),'readout never presents (8.44a)');
 assert.equal(await page.locator('#profiles-uniform').isVisible(),true);
 assert.equal(await page.locator('#profiles-isothermal').isHidden(),true);
 assert.equal(await page.locator('#walltemp').isDisabled(),true);
 assert.equal(await page.locator('#heatflux').isEnabled(),true);
 // Rejection: turbulent Rayleigh number shows the core reason verbatim.
 await page.locator('#preset').selectOption('ex81');await waitReadout(`Nu_L（相似解） = ${fmt(ex81.averageNusselt)}`);
 const turbMsg=coreError(naturalConvectionVerticalWall,{...WALL_GUI_PRESETS.ex81.fields,lengthM:30});
 await page.locator('#length').fill('30');await page.locator('#apply').click();
 await page.waitForFunction(m=>!document.querySelector('#error').hidden&&document.querySelector('#error').textContent===m,turbMsg);
 assert.match(await readout(),/計算できませんでした/);assert.doesNotMatch(await readout(),/Nu_L（相似解） = [\d]/);
 // Rejection: Prandtl number outside the verified range, verbatim.
 const prMsg=coreError(naturalConvectionVerticalWall,{...WALL_GUI_PRESETS.ex81.fields,lengthM:0.30,thermalDiffusivityM2PerS:3.2e-4});
 await page.locator('#length').fill('0.30');await page.locator('#alpha').fill('0.00032');await page.locator('#apply').click();
 await page.waitForFunction(m=>!document.querySelector('#error').hidden&&document.querySelector('#error').textContent===m,prMsg);
 // Rejection: zero temperature difference, verbatim.
 const dtMsg=coreError(naturalConvectionVerticalWall,{...WALL_GUI_PRESETS.ex81.fields,thermalDiffusivityM2PerS:2.315e-5,wallTemperatureK:293.15});
 await page.locator('#alpha').fill('0.00002315');await page.locator('#walltemp').fill('293.15');await page.locator('#apply').click();
 await page.waitForFunction(m=>!document.querySelector('#error').hidden&&document.querySelector('#error').textContent===m,dtMsg);
 // Rejection: uniform-flux case below the Nu >= 5 condition of (8.44b).
 await page.locator('#preset').selectOption('uhf');await waitReadout(`Nu_L（式8.44b） = ${fmt(uhf.averageNusselt)}`);
 const nuMsg=coreError(uniformHeatFluxVerticalWall,{...WALL_GUI_PRESETS.uhf.fields,heatFluxWPerM2:1e-5});
 await page.locator('#heatflux').fill('0.00001');await page.locator('#apply').click();
 await page.waitForFunction(m=>!document.querySelector('#error').hidden&&document.querySelector('#error').textContent===m,nuMsg);
 assert.match(nuMsg,/適用条件はNu≳5/);
 // Layout: no horizontal overflow or clipped result text at phone and
 // desktop widths, light and dark, with profiles on screen.
 await page.locator('#preset').selectOption('ex81');await waitReadout(`Nu_L（相似解） = ${fmt(ex81.averageNusselt)}`);
 for(const width of [375,390,1280,1920])for(const colorScheme of ['light','dark']){await page.setViewportSize({width,height:844});await page.emulateMedia({colorScheme});await page.waitForTimeout(120);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`scrollWidth at ${width}/${colorScheme}`);assert.ok(await page.locator('#readout').evaluate(e=>e.scrollWidth<=e.clientWidth+1),`readout clip at ${width}/${colorScheme}`);assert.ok(await page.locator('#graph-velocity').evaluate(e=>e.clientWidth>200),`velocity graph width at ${width}/${colorScheme}`);}
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(120);await page.screenshot({path:new URL(`../work/wall-gui-${engine}-390-dark.png`,import.meta.url).pathname,fullPage:true});
 await page.setViewportSize({width:375,height:844});await page.emulateMedia({colorScheme:'light'});await page.waitForTimeout(120);await page.screenshot({path:new URL(`../work/wall-gui-${engine}-375-light.png`,import.meta.url).pathname,fullPage:true});
 assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),{'wall-gui-sentinel':'keep'});assert.deepEqual(errors,[]);console.log(JSON.stringify({engine,developmentOnly:true,ex81VerifiedOnScreen:true,ex83VerifiedOnScreen:true,uniformFluxVerifiedOnScreen:true,printed844aNotPresented:true,turbulentRejectedVerbatim:true,prandtlRangeRejectedVerbatim:true,zeroDeltaTRejectedVerbatim:true,uniformFluxNuFloorRejectedVerbatim:true,mobileDesktopLightDark:true,localStorageUnchanged:true,offlineVerified:false,passed:true}));await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
