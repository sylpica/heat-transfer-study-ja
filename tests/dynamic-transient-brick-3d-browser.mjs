import assert from 'node:assert/strict';import {mkdir,mkdtemp,cp,readFile} from 'node:fs/promises';import {existsSync} from 'node:fs';import {createRequire} from 'node:module';import {startServer} from '../scripts/serve.mjs';import {createTransientBrick3d} from '../dynamic/dev/transient-brick-3d.mjs';
import {BRICK_PRESETS,buildBrickInput} from '../dynamic/dev/transient-brick-3d-ui-config.mjs';
const work=new URL('../work/',import.meta.url);await mkdir(work,{recursive:true});const root=await mkdtemp(new URL('brick-3d-browser-',work).pathname);await mkdir(root+'/dynamic/dev',{recursive:true});
for(const file of ['transient-brick-3d.mjs','transient-brick-3d.html','transient-brick-3d-ui.mjs','transient-brick-3d-ui-config.mjs','transient-brick-3d-view.mjs','cavity.css'])await cp(new URL('../dynamic/dev/'+file,import.meta.url),root+'/dynamic/dev/'+file);
const engine=process.env.BROWSER_ENGINE||'chromium',engines=createRequire(import.meta.url)('playwright'),server=await startServer({root,port:0}),browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{...(process.env.BROWSER_EXECUTABLE||existsSync('/usr/bin/chromium')?{executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium'}:{}),args:['--no-sandbox']}: {})});
const reference=JSON.parse(await readFile(new URL('../docs/dynamic/TRANSIENT_BRICK_3D_REFERENCE_20261107.json',import.meta.url)));
function advance(m,target){let guard=0;while(m.time<target-1e-12){m.step(Math.min(m.safeDt,target-m.time),false);if(++guard>2000000)throw Error('進行しませんでした。');}return m.snapshot();}
const preset=id=>BRICK_PRESETS.find(p=>p.id===id).values;
const probeOf=async page=>{const text=await page.locator('#readout').innerText();const m=text.match(/測定セル（i=(\d+), j=(\d+), l=(\d+)／中心[^）]*）：([\d.]+) K/);assert.ok(m,`readout shape: ${text}`);return {i:Number(m[1])-1,j:Number(m[2])-1,l:Number(m[3])-1,temp:Number(m[4])};};
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>localStorage.setItem('brick-gui-sentinel','keep'));
 const ready=async()=>{await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='準備完了');assert.equal(await page.locator('#error').isVisible(),false);};
 const stepWait=async()=>{const t=await page.locator('#clock').innerText();await page.locator('#step').click();await page.waitForFunction(old=>document.querySelector('#clock').textContent!==old,t);};
 const setRange=async(sel,val)=>{await page.locator(sel).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},val);};
 await page.goto(`http://127.0.0.1:${server.address().port}/dynamic/dev/transient-brick-3d.html`);await ready();
 assert.equal(await page.locator('#clock').innerText(),'0.000 s');
 assert.match(await page.locator('#summary').innerText(),/格子 12×10×8（合計 960 セル）/);
 const blank=await page.locator('#field').evaluate(c=>c.toDataURL());
 // Default (asymmetric) preset: one 5 s frame must match the kernel run identically.
 await stepWait();assert.equal(await page.locator('#clock').innerText(),'5.000 s');
 const kernelA=advance(createTransientBrick3d(buildBrickInput(preset('asymmetric'))),5);
 const probeA=await probeOf(page);
 assert.deepEqual([probeA.i,probeA.j,probeA.l],[0,9,4],'default probe is the (0, ny-1, mid-z) slice cell');
 assert.ok(Math.abs(probeA.temp-kernelA.temperature[probeA.i+12*(probeA.j+10*probeA.l)])<5e-5,`screen probe ${probeA.temp} vs kernel`);
 const meanLine=(await page.locator('#readout').innerText()).match(/全体：平均 ([\d.]+) K、最小 ([\d.]+) K、最大 ([\d.]+) K/);
 assert.ok(Math.abs(Number(meanLine[1])-kernelA.mean)<5e-5&&Math.abs(Number(meanLine[2])-kernelA.min)<5e-5&&Math.abs(Number(meanLine[3])-kernelA.max)<5e-5,'screen mean/min/max vs kernel');
 assert.match(await page.locator('#diagnostic-values').textContent(),/安定刻み safeDt=/);
 assert.notEqual(await page.locator('#field').evaluate(c=>c.toDataURL()),blank);
 // Dirichlet cube preset: four 25 s frames to t = 100 s, centre cell vs kernel and vs the series reference.
 await page.locator('#preset').selectOption('dirichlet-cube');await ready();
 assert.match(await page.locator('#summary').innerText(),/格子 8×8×8（合計 512 セル）/);
 await setRange('#slice',4);await setRange('#probe-col',4);await setRange('#probe-row',3);
 for(let f=0;f<4;f++)await stepWait();
 assert.equal(await page.locator('#clock').innerText(),'100.000 s');
 const kernelC=advance(createTransientBrick3d(buildBrickInput(preset('dirichlet-cube'))),100);
 const probeC=await probeOf(page);
 assert.deepEqual([probeC.i,probeC.j,probeC.l],[4,4,4],'probe is the cube centre cell');
 const centreIdx=4+8*(4+8*4);
 assert.ok(Math.abs(probeC.temp-kernelC.temperature[centreIdx])<5e-5,`screen centre ${probeC.temp} vs kernel ${kernelC.temperature[centreIdx]}`);
 assert.ok(Math.abs(probeC.temp-reference.cases.dirichletCube.grids['8x8x8'][centreIdx])<0.1,`screen centre ${probeC.temp} vs series reference ${reference.cases.dirichletCube.grids['8x8x8'][centreIdx]}`);
 // Rewind and restart restore earlier states exactly.
 await page.locator('#back').click();await page.waitForFunction(()=>document.querySelector('#clock').textContent==='75.000 s');
 await page.locator('#restart').click();await page.waitForFunction(()=>document.querySelector('#clock').textContent==='0.000 s');
 assert.ok(Math.abs((await probeOf(page)).temp-300)<5e-5,'restart returns to the uniform initial field');
 // Slice plane switch re-renders without errors; canvas click moves the probe.
 const before=await page.locator('#field').evaluate(c=>c.toDataURL());
 await page.locator('#plane').selectOption('yz');await page.waitForTimeout(60);
 assert.notEqual(await page.locator('#field').evaluate(c=>c.toDataURL()),before);
 const box=await page.locator('#field').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 const probeClick=await probeOf(page);assert.ok(probeClick.i>=0&&probeClick.j>=0&&probeClick.l>=0);
 // Invalid input (cell total over the cap) is refused with the core's own reason; state untouched.
 const acceptedReadout=await page.locator('#readout').innerText(),acceptedClock=await page.locator('#clock').innerText();
 await page.locator('#nx').fill('33');await page.locator('#ny').fill('32');await page.locator('#nz').fill('32');await page.locator('#apply').click();
 await page.waitForFunction(()=>!document.querySelector('#error').hidden);
 assert.match(await page.locator('#error').innerText(),/直方体の格子は各軸1〜64、合計32768セル以下です。/);
 assert.equal(await page.locator('#readout').innerText(),acceptedReadout);assert.equal(await page.locator('#clock').innerText(),acceptedClock);
 // Oversize step through the core path: a boundary temperature of 0 K is refused verbatim too.
 await page.locator('#preset').selectOption('asymmetric');await ready();
 await page.locator('#f-xMin-type').selectOption('temperature');await page.locator('#f-xMin-temperature').fill('0');await page.locator('#apply').click();
 await page.waitForFunction(()=>!document.querySelector('#error').hidden);
 assert.match(await page.locator('#error').innerText(),/境界の絶対温度\[K\]が数値範囲外です。/);
 await page.locator('#preset').selectOption('flux-convection');await ready();
 assert.match(await page.locator('#summary').innerText(),/xMin=流束、xMax=対流/);
 for(const width of [375,390,1280,1920])for(const colorScheme of ['light','dark']){await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme});await page.waitForTimeout(80);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}/${colorScheme}`);assert.ok(await page.locator('#field').evaluate(c=>Math.abs(c.width/devicePixelRatio-c.clientWidth)<2));}
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(80);await page.screenshot({path:new URL(`../work/transient-brick-3d-${engine}-390-dark.png`,import.meta.url).pathname,fullPage:true});
 await page.setViewportSize({width:375,height:844});await page.emulateMedia({colorScheme:'light'});await page.waitForTimeout(80);await page.screenshot({path:new URL(`../work/transient-brick-3d-${engine}-375-light.png`,import.meta.url).pathname,fullPage:true});
 assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),{'brick-gui-sentinel':'keep'});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine,developmentOnly:true,defaultProbeMatchesKernel:true,cubeCentreMatchesKernel:true,cubeCentreVsSeriesReference:probeC.temp,sliceSwitchAndClickProbe:true,cellCapRefusedVerbatim:true,zeroKelvinRefusedVerbatim:true,rewindAndRestart:true,layoutWidths:[375,390,1280,1920],localStorageUnchanged:true,offlineVerified:false,passed:true}));await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
