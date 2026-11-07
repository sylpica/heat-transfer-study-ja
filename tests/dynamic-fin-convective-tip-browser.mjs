import assert from 'node:assert/strict';import {mkdir,mkdtemp,cp} from 'node:fs/promises';import {existsSync} from 'node:fs';import {createRequire} from 'node:module';import {startServer} from '../scripts/serve.mjs';import {createStraightFin} from '../dynamic/dev/fin-convective-tip.mjs';
const work=new URL('../work/',import.meta.url);await mkdir(work,{recursive:true});const root=await mkdtemp(new URL('fin-tip-browser-',work).pathname);await mkdir(root+'/dynamic/dev',{recursive:true});
for(const file of ['fin-convective-tip.mjs','fin-convective-tip.html','fin-convective-tip-ui.mjs','fin-convective-tip-view.mjs','cavity.css'])await cp(new URL('../dynamic/dev/'+file,import.meta.url),root+'/dynamic/dev/'+file);
const engine=process.env.BROWSER_ENGINE||'chromium',engines=createRequire(import.meta.url)('playwright'),server=await startServer({root,port:0}),browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{...(process.env.BROWSER_EXECUTABLE||existsSync('/usr/bin/chromium')?{executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium'}:{}),args:['--no-sandbox']}: {})});
const canonical={length:.1,thickness:.01,depth:.01,cells:32,k:200,rho:2700,cp:900,h:25,baseTemperature:353.15,ambient:293.15,initial:293.15};
function steady(model){let prev=model.snapshot();for(let g=0;g<20000;g++){for(let j=0;j<256;j++)model.step(model.safeDt,false);const s=model.snapshot(),d=Math.max(...s.temperature.map((v,i)=>Math.abs(v-prev.temperature[i])));if(d<1e-9)return s;prev=s;}throw Error('定常へ到達しませんでした。');}
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>localStorage.setItem('fin-gui-sentinel','keep'));
 const ready=async()=>{await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='準備完了');assert.equal(await page.locator('#error').isVisible(),false);};
 const readEta=async()=>Number((await page.locator('#readout').innerText()).match(/η=([\d.]+)/)[1]);
 const readQ=async()=>Number((await page.locator('#readout').innerText()).match(/基部熱流=([\d.]+) W/)[1]);
 const stepWait=async()=>{const t=await page.locator('#clock').innerText();await page.locator('#step').click();await page.waitForFunction(old=>document.querySelector('#clock').textContent!==old,t);};
 const runToSteady=async()=>{let prev=await readEta();for(let i=0;i<80;i++){await stepWait();const eta=await readEta();if(i>=2&&Math.abs(eta-prev)<=2e-6)return eta;prev=eta;}throw Error('画面が定常へ到達しませんでした。');};
 await page.goto(`http://127.0.0.1:${server.address().port}/dynamic/dev/fin-convective-tip.html`);await ready();
 assert.equal(await page.locator('#clock').innerText(),'0.000 s');
 const blank=await page.locator('#field').evaluate(c=>c.toDataURL());
 // Default (canonical) conditions, tip = convection: run the screen to steady state.
 await page.locator('#interval').fill('400');const etaConv=await runToSteady(),qConv=await readQ();
 const kernelConv=steady(createStraightFin({...canonical,tipCondition:'convection'}));
 assert.ok(Math.abs(etaConv-kernelConv.efficiency)<1e-4,`screen eta ${etaConv} vs kernel ${kernelConv.efficiency}`);
 assert.ok(Math.abs(qConv-kernelConv.baseHeatRateW)<0.002,`screen q ${qConv} vs kernel ${kernelConv.baseHeatRateW}`);
 assert.ok(Math.abs(etaConv-0.855241)<2e-3,`screen eta ${etaConv} vs analytic 0.855241`);
 assert.ok(Math.abs(qConv-5.259731)<0.02,`screen q ${qConv} vs analytic 5.259731`);
 const probeTemp=Number((await page.locator('#readout').innerText()).match(/セル \d+\/\d+）：([\d.]+) K/)[1]);
 assert.ok(Math.abs(probeTemp-kernelConv.temperature[16])<0.05,`probe ${probeTemp} vs kernel ${kernelConv.temperature[16]}`);
 assert.notEqual(await page.locator('#field').evaluate(c=>c.toDataURL()),blank);
 // Rewind and restart restore earlier states exactly.
 const steadyClock=await page.locator('#clock').innerText();await page.locator('#back').click();await page.waitForFunction(old=>document.querySelector('#clock').textContent!==old,steadyClock);
 await page.locator('#restart').click();await page.waitForFunction(()=>document.querySelector('#clock').textContent==='0.000 s');
 assert.match(await page.locator('#readout').innerText(),/先端セル（x=[\d.]+ mm）：293\.1500 K/);
 // Switch the tip condition to insulated and re-run: eta up, q down, both at the analytic values.
 await page.locator('#tip').selectOption('insulated');await page.locator('#apply').click();await ready();assert.match(await page.locator('#summary').innerText(),/先端は断熱/);
 const etaIns=await runToSteady(),qIns=await readQ();const kernelIns=steady(createStraightFin({...canonical,tipCondition:'insulated'}));
 assert.ok(Math.abs(etaIns-kernelIns.efficiency)<1e-4);assert.ok(Math.abs(qIns-kernelIns.baseHeatRateW)<0.002);
 assert.ok(Math.abs(etaIns-0.861057)<2e-3,`insulated eta ${etaIns} vs analytic 0.861057`);
 assert.ok(Math.abs(qIns-5.166343)<0.02,`insulated q ${qIns} vs analytic 5.166343`);
 assert.ok(etaIns>etaConv&&qIns<qConv,'tip switch changes eta/q in the expected directions');
 // Invalid input (h so large the uniform-section assumption leaves its range) is rejected with a reason; state untouched.
 const acceptedReadout=await page.locator('#readout').innerText(),acceptedClock=await page.locator('#clock').innerText();
 await page.locator('#h').fill('100000');await page.locator('#apply').click();await page.waitForFunction(()=>!document.querySelector('#error').hidden);
 assert.match(await page.locator('#error').innerText(),/開発範囲を超えます/);
 assert.equal(await page.locator('#readout').innerText(),acceptedReadout);assert.equal(await page.locator('#clock').innerText(),acceptedClock);
 await page.locator('#h').fill('25');await page.locator('#apply').click();await ready();
 for(const width of [375,390,1280])for(const colorScheme of ['light','dark']){await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme});await page.waitForTimeout(80);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}/${colorScheme}`);assert.ok(await page.locator('#field').evaluate(c=>Math.abs(c.width/devicePixelRatio-c.clientWidth)<2));}
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(80);await page.screenshot({path:new URL(`../work/fin-convective-tip-${engine}-mobile-dark.png`,import.meta.url).pathname,fullPage:true});
 assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),{'fin-gui-sentinel':'keep'});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine,developmentOnly:true,canonicalConvectionEta:etaConv,canonicalConvectionQ:qConv,insulatedEta:etaIns,insulatedQ:qIns,screenMatchesKernel:true,tipSwitchChangesValues:true,rewindAndRestart:true,invalidInputRejectedWithReason:true,mobileLightDark:true,localStorageUnchanged:true,offlineVerified:false,passed:true}));await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
