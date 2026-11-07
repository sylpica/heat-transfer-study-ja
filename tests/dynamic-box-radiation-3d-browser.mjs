import assert from 'node:assert/strict';import {mkdir,mkdtemp,cp} from 'node:fs/promises';import {existsSync} from 'node:fs';import {createRequire} from 'node:module';import {startServer} from '../scripts/serve.mjs';import {createBoxRadiation3D} from '../dynamic/dev/box-radiation-3d.mjs';
import {BOX_FACE_DEFS,BOX_RADIATION_GUI_PRESETS,buildBoxRadiationInput,frameSteps,fmt10} from '../dynamic/dev/box-radiation-3d-ui-config.mjs';
const work=new URL('../work/',import.meta.url);await mkdir(work,{recursive:true});const root=await mkdtemp(new URL('boxrad-gui-browser-',work).pathname);
await cp(new URL('../dynamic',import.meta.url),root+'/dynamic',{recursive:true});
const engine=process.env.BROWSER_ENGINE||'chromium',engines=createRequire(import.meta.url)('playwright'),server=await startServer({root,port:0}),browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{...(process.env.BROWSER_EXECUTABLE||existsSync('/usr/bin/chromium')?{executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium'}:{}),args:['--no-sandbox']}: {})});
const expectedReadout=s=>[
 ...BOX_FACE_DEFS.map((def,i)=>`${def.name} ${def.id}：T=${fmt10(s.temperature[i])} K、J=${fmt10(s.radiosity[i])} W/m²、G=${fmt10(s.irradiation[i])} W/m²、正味放射 Q=${fmt10(s.outwardPower[i])} W（外向き+）、正味熱流束 q″=${fmt10(s.faceOutwardFlux[i])} W/m²`),
 `放射収支 ΣQ = ${fmt10(s.radiationBalance)} W（全6面の正味放射の合計）`,
].join('\n');
const stepped=(input,duration)=>{const m=createBoxRadiation3D(input),{count,dt}=frameSteps(duration,m.safeDt);for(let i=0;i<count;i++)m.step(dt);return m;};
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>localStorage.setItem('boxrad-gui-sentinel','keep'));
 const ready=async()=>{await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='準備完了');assert.equal(await page.locator('#error').isVisible(),false);};
 const readout=()=>page.locator('#readout').innerText();
 const stepWait=async(timeout=30000)=>{const t=await page.locator('#clock').innerText();await page.locator('#step').click();await page.waitForFunction(old=>document.querySelector('#clock').textContent!==old,t,{timeout});};
 await page.goto(`http://127.0.0.1:${server.address().port}/dynamic/dev/box-radiation-3d.html`);await ready();
 // Default gray box: the screen's initial readout equals the connector's snapshot, string for string.
 const grayInput=buildBoxRadiationInput(structuredClone(BOX_RADIATION_GUI_PRESETS.gray));
 const gray0=createBoxRadiation3D(grayInput).snapshot();
 assert.equal(await page.locator('#clock').innerText(),'0.000 s');
 assert.equal(await readout(),expectedReadout(gray0));
 assert.ok(Math.abs(gray0.radiationBalance)<=1e-9);
 assert.equal(await page.locator('#figure svg rect').count(),6);
 assert.match(await page.locator('#summary').innerText(),/自動引上げなし/);
 // One 60 s frame: screen and connector agree after the same safeDt subdivision.
 const gray60=stepped(grayInput,60).snapshot();
 await stepWait();assert.equal(await page.locator('#clock').innerText(),'60.000 s');
 assert.equal(await readout(),expectedReadout(gray60));
 // Rewind restores the exact initial frame; restart returns to it too.
 await page.locator('#back').click();await page.waitForFunction(()=>document.querySelector('#clock').textContent==='0.000 s');
 assert.equal(await readout(),expectedReadout(gray0));
 await stepWait();await page.locator('#restart').click();assert.equal(await page.locator('#clock').innerText(),'0.000 s');
 assert.equal(await readout(),expectedReadout(gray0));
 // Isothermal blackbody preset: every face's net exchange is zero to round-off and ΣQ is exactly 0.
 await page.locator('#preset').selectOption('iso');await ready();
 const isoText=await readout(),isoExpected=expectedReadout(createBoxRadiation3D(buildBoxRadiationInput(structuredClone(BOX_RADIATION_GUI_PRESETS.iso))).snapshot());
 assert.equal(isoText,isoExpected);
 assert.match(isoText,/放射収支 ΣQ = 0 W/);
 for(const m of isoText.matchAll(/正味放射 Q=(-?[\d.e+]+) W/g))assert.ok(Math.abs(Number(m[1]))<=1e-12,`iso outward ${m[1]}`);
 // Flat preset under auto: admitted with escalation, and the summary says so.
 await page.locator('#preset').selectOption('flat');await ready();
 assert.match(await page.locator('#summary').innerText(),/自動引上げあり/);
 const flatAccepted=await readout();
 // The same flat box with an explicitly low resolution is refused with the connector's own reason, verbatim;
 // the accepted state on screen is untouched.
 await page.locator('#resolution').selectOption('low');await page.locator('#apply').click();
 await page.waitForFunction(()=>!document.querySelector('#error').hidden);
 assert.match(await page.locator('#error').innerText(),/指定された積分解像度では、形態係数の総和則・相反則を放射ネットワークの受入精度（1e-12）まで解像できません/);
 assert.equal(await readout(),flatAccepted);
 // A physical refusal (emissivity above 1) also surfaces the kernel's reason verbatim.
 await page.locator('#preset').selectOption('gray');await ready();
 const grayAccepted=await readout();
 await page.locator('#face-0-emissivity').fill('1.5');await page.locator('#apply').click();
 await page.waitForFunction(()=>!document.querySelector('#error').hidden);
 assert.match(await page.locator('#error').innerText(),/放射率は0〜1です/);
 assert.equal(await readout(),grayAccepted);
 await page.locator('#preset').selectOption('gray');await ready();
 // An external power input on one face shows up in the balance: ΣQ equals that face's net outward power sum.
 await page.locator('#face-0-input-kind').selectOption('power');await page.locator('#face-0-input-value').fill('100');await page.locator('#apply').click();await ready();
 const powered=await readout();
 assert.equal(powered,expectedReadout(createBoxRadiation3D(buildBoxRadiationInput({...structuredClone(BOX_RADIATION_GUI_PRESETS.gray),faces:BOX_RADIATION_GUI_PRESETS.gray.faces.map((f,i)=>i?f:{...f,inputKind:'power',inputValue:100})})).snapshot()));
 // Layout: no horizontal overflow or clipped readout, light and dark, phone and desktop widths.
 for(const width of [375,390,1280,1920])for(const colorScheme of ['light','dark']){await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme});await page.waitForTimeout(80);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}/${colorScheme}`);assert.ok(await page.locator('#readout').evaluate(e=>e.scrollWidth<=e.clientWidth+1),`readout clip at ${width}/${colorScheme}`);assert.ok(await page.locator('#figure').evaluate(e=>e.scrollWidth<=e.clientWidth+1),`figure clip at ${width}/${colorScheme}`);}
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(80);await page.screenshot({path:new URL(`../work/boxrad-gui-${engine}-390-dark.png`,import.meta.url).pathname,fullPage:true});
 await page.setViewportSize({width:375,height:844});await page.emulateMedia({colorScheme:'light'});await page.waitForTimeout(80);await page.screenshot({path:new URL(`../work/boxrad-gui-${engine}-375-light.png`,import.meta.url).pathname,fullPage:true});
 assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),{'boxrad-gui-sentinel':'keep'});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine,developmentOnly:true,grayScreenMatchesConnector:true,graySteppedMatchesConnector:true,rewindRestoresInitialFrame:true,isothermalZeroExchange:true,flatEscalationShown:true,underResolvedRefusedVerbatim:true,emissivityRefusedVerbatim:true,powerInputMatchesConnector:true,mobileDesktopLightDark:true,localStorageUnchanged:true,offlineVerified:false,passed:true}));await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
