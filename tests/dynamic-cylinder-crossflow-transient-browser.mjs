import assert from 'node:assert/strict';import {mkdir,mkdtemp,cp,readFile} from 'node:fs/promises';import {existsSync} from 'node:fs';import {createRequire} from 'node:module';import {startServer} from '../scripts/serve.mjs';import {createCylinderCrossflowTransient} from '../dynamic/dev/cylinder-crossflow-transient.mjs';
const work=new URL('../work/',import.meta.url);await mkdir(work,{recursive:true});const root=await mkdtemp(new URL('cylinder-gui-browser-',work).pathname);await mkdir(root+'/dynamic/dev',{recursive:true});await mkdir(root+'/dynamic',{recursive:true});
await cp(new URL('../cylinder-crossflow.mjs',import.meta.url),root+'/cylinder-crossflow.mjs');
for(const file of ['radial.mjs','surface-exchange.mjs'])await cp(new URL('../dynamic/'+file,import.meta.url),root+'/dynamic/'+file);
for(const file of ['cylinder-crossflow-transient.mjs','cylinder-crossflow-transient.html','cylinder-crossflow-transient-ui.mjs','cylinder-crossflow-transient-view.mjs','wind-heat-transfer.mjs','cavity.css'])await cp(new URL('../dynamic/dev/'+file,import.meta.url),root+'/dynamic/dev/'+file);
const reference=JSON.parse(await readFile(new URL('../docs/dynamic/CYLINDER_CROSSFLOW_REFERENCE_20261107.json',import.meta.url),'utf8')).reference;
const gradient={diameter:0.02,length:0.1,solidConductivity:15,solidDensity:8000,solidCp:500,heatTransferCoefficient:500,initialTemperature:400,fluidTemperature:300,cells:32};
const nu=1.602e-5,kf=0.0265,pr=0.712,D=0.0001;
const ex78={diameter:D,length:0.001,solidConductivity:15,solidDensity:8000,solidCp:500,initialTemperature:383.15,fluidTemperature:293.15,cells:32,flow:{velocity:457*nu/D,density:1,viscosity:nu,cp:pr*kf/nu,conductivity:kf}};
const lumped={diameter:0.02,length:0.1,solidConductivity:400,solidDensity:8900,solidCp:385,heatTransferCoefficient:50,initialTemperature:400,fluidTemperature:300,cells:16};
const engine=process.env.BROWSER_ENGINE||'chromium',engines=createRequire(import.meta.url)('playwright'),server=await startServer({root,port:0}),browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{...(process.env.BROWSER_EXECUTABLE||existsSync('/usr/bin/chromium')?{executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium'}:{}),args:['--no-sandbox']}: {})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>localStorage.setItem('cylinder-gui-sentinel','keep'));
 const ready=async()=>{await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='準備完了');assert.equal(await page.locator('#error').isVisible(),false);};
 const readout=()=>page.locator('#readout').innerText();
 const diag=async()=>{await page.evaluate(()=>{document.querySelector('#diagnostics').open=true;});return page.locator('#diagnostic-values').innerText();};
 const grab=(text,re)=>{const m=text.match(re);assert.ok(m,`pattern ${re} in: ${text}`);return Number(m[1]);};
 const near4=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<=1.1e-4,`${label}: ${actual} vs ${expected}`);
 const stepWait=async(timeout=30000)=>{const t=await page.locator('#clock').innerText();await page.locator('#step').click();await page.waitForFunction(old=>document.querySelector('#clock').textContent!==old,t,{timeout});};
 await page.goto(`http://127.0.0.1:${server.address().port}/dynamic/dev/cylinder-crossflow-transient.html`);await ready();
 assert.equal(await page.locator('#clock').innerText(),'0.000 s');
 assert.match(await page.locator('#summary').innerText(),/Bi=0\.333333/);
 const blank=await page.locator('#field').evaluate(c=>c.toDataURL());
 // Default gradient case: one 2 s frame; screen values equal the kernel's to the displayed digits,
 // and collate with the independent Python reference sample at t = 2 s.
 const kernel=createCylinderCrossflowTransient(gradient);const kernelAt2=kernel.step(2);
 await stepWait();assert.equal(await page.locator('#clock').innerText(),'2.000 s');
 let text=await readout();
 near4(grab(text,/セル \d+\/\d+）：([\d.]+) K/),kernelAt2.temperature[16],'probe vs kernel');
 near4(grab(text,/中心セル（r=[\d.]+ mm）：([\d.]+) K/),kernelAt2.temperature[0],'centre vs kernel');
 near4(grab(text,/表面温度（半セル抵抗で再構成）：([\d.]+) K/),kernelAt2.surfaceTemperature,'surface vs kernel');
 near4(grab(text,/体積平均温度：([\d.]+) K/),kernelAt2.meanTemperature,'mean vs kernel');
 const sample=reference.gradientCase.samples[0];
 assert.ok(Math.abs(grab(text,/中心セル（r=[\d.]+ mm）：([\d.]+) K/)-sample.centreTemperature)<0.05,'centre vs independent reference');
 assert.ok(Math.abs(grab(text,/表面温度（半セル抵抗で再構成）：([\d.]+) K/)-sample.surfaceTemperature)<0.05,'surface vs independent reference');
 assert.ok(Math.abs(grab(text,/体積平均温度：([\d.]+) K/)-sample.meanTemperature)<0.05,'mean vs independent reference');
 assert.notEqual(await page.locator('#field').evaluate(c=>c.toDataURL()),blank);
 // Rewind restores the exact initial frame (surface temperature is the half-cell reconstruction, below 400 K).
 await page.locator('#back').click();await page.waitForFunction(()=>document.querySelector('#clock').textContent==='0.000 s');
 const kernel0=createCylinderCrossflowTransient(gradient).snapshot();
 text=await readout();near4(grab(text,/表面温度（半セル抵抗で再構成）：([\d.]+) K/),kernel0.surfaceTemperature,'initial surface vs kernel');
 assert.ok(kernel0.surfaceTemperature<400,'initial surface reconstruction is below the uniform temperature');
 await page.locator('#restart').click();assert.equal(await page.locator('#clock').innerText(),'0.000 s');
 // Example 7.8 preset (wind mode): h on screen reproduces the 50-digit verified value.
 await page.locator('#preset').selectOption('ex78');await ready();
 assert.match(await page.locator('#summary').innerText(),/風速から推定：式\(7\.66\)/);
 text=await readout();const hScreen=grab(text,/熱伝達率 h=([\d.]+) W/);
 assert.ok(Math.abs(hScreen-2833.9817356038657)<=1e-8*2833.9817356038657,`screen h ${hScreen} vs verified 2833.9817356038657`);
 const kernel78=createCylinderCrossflowTransient(ex78);assert.ok(Math.abs(kernel78.snapshot().heatTransferCoefficient-2833.9817356038657)<=1e-12*2833.9817356038657);
 const d78=await diag();assert.ok(Math.abs(grab(d78,/Re_D = ([\d.]+)/)-457)<1e-6,'Re_D = 457');
 assert.ok(Math.abs(grab(d78,/Nu_D = ([\d.]+)/)-kernel78.snapshot().windEstimate.nusselt)<1e-5,'screen Nu_D vs kernel');
 const kernel78At=kernel78.step(0.005);
 await stepWait();assert.equal(await page.locator('#clock').innerText(),'0.005 s');
 text=await readout();near4(grab(text,/体積平均温度：([\d.]+) K/),kernel78At.meanTemperature,'ex78 mean vs kernel');near4(grab(text,/表面温度（半セル抵抗で再構成）：([\d.]+) K/),kernel78At.surfaceTemperature,'ex78 surface vs kernel');
 // Lumped preset: tau on screen is 342.65 s and the mean decays to e^-1 at t = tau.
 await page.locator('#preset').selectOption('lumped');await ready();
 const tau=grab(await diag(),/τ = ρcpR\/\(2h\) = ([\d.]+) s/);assert.ok(Math.abs(tau-342.65)<5e-5,`screen tau ${tau}`);
 await page.locator('#interval').fill('342.65');await stepWait(60000);assert.equal(await page.locator('#clock').innerText(),'342.650 s');
 text=await readout();const meanAtTau=grab(text,/体積平均温度：([\d.]+) K/);
 const ratio=(meanAtTau-300)/100;assert.ok(Math.abs(ratio-Math.exp(-1))<2e-3,`mean ratio at tau ${ratio} vs e^-1`);
 const kernelL=createCylinderCrossflowTransient(lumped);near4(meanAtTau,kernelL.step(342.65).meanTemperature,'lumped mean vs kernel');
 // Rejection: Bi above the model limit shows the core reason verbatim; accepted state untouched.
 await page.locator('#preset').selectOption('gradient');await ready();
 const acceptedReadout=await readout(),acceptedClock=await page.locator('#clock').innerText();
 await page.locator('#h').fill('20000');await page.locator('#apply').click();await page.waitForFunction(()=>!document.querySelector('#error').hidden);
 assert.match(await page.locator('#error').innerText(),/Bi=hR\/k=[\d.]+ が本モデルの開発範囲上限 10 を超えます/);
 assert.equal(await readout(),acceptedReadout);assert.equal(await page.locator('#clock').innerText(),acceptedClock);
 // Rejection: wind correlation range (Re_D > 1e7) propagates the wind module's reason.
 await page.locator('#preset').selectOption('ex78');await ready();
 const accepted78=await readout();
 await page.locator('#diameter').fill('100');await page.locator('#velocity').fill('3000');await page.locator('#apply').click();await page.waitForFunction(()=>!document.querySelector('#error').hidden);
 assert.match(await page.locator('#error').innerText(),/10⁷/);assert.equal(await readout(),accepted78);
 // Rejection: non-positive direct h.
 await page.locator('#preset').selectOption('gradient');await ready();
 await page.locator('#h').fill('0');await page.locator('#apply').click();await page.waitForFunction(()=>!document.querySelector('#error').hidden);
 assert.match(await page.locator('#error').innerText(),/熱伝達率hは正の値で指定してください/);
 await page.locator('#preset').selectOption('gradient');await ready();
 // Layout: no horizontal overflow or clipped readout, light and dark, phone and desktop widths.
 for(const width of [375,390,1280,1920])for(const colorScheme of ['light','dark']){await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme});await page.waitForTimeout(80);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}/${colorScheme}`);assert.ok(await page.locator('#readout').evaluate(e=>e.scrollWidth<=e.clientWidth+1),`readout clip at ${width}/${colorScheme}`);assert.ok(await page.locator('#field').evaluate(c=>Math.abs(c.width/devicePixelRatio-c.clientWidth)<2));}
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(80);await page.screenshot({path:new URL(`../work/cylinder-gui-${engine}-390-dark.png`,import.meta.url).pathname,fullPage:true});
 await page.setViewportSize({width:375,height:844});await page.emulateMedia({colorScheme:'light'});await page.waitForTimeout(80);await page.screenshot({path:new URL(`../work/cylinder-gui-${engine}-375-light.png`,import.meta.url).pathname,fullPage:true});
 assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),{'cylinder-gui-sentinel':'keep'});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine,developmentOnly:true,gradientScreenMatchesKernel:true,gradientCollatesWithIndependentReference:true,rewindRestoresInitialFrame:true,ex78ScreenH: hScreen,ex78MatchesVerifiedH:true,lumpedTauOnScreen:tau,lumpedDecayAtTau:ratio,snapshotRestore:true,biotLimitRejectedWithCoreReason:true,windRangeRejectedWithCoreReason:true,nonPositiveHRejected:true,mobileDesktopLightDark:true,localStorageUnchanged:true,offlineVerified:false,passed:true}));await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
