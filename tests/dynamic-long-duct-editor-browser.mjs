import assert from 'node:assert/strict';import {mkdir,mkdtemp,cp} from 'node:fs/promises';import {existsSync} from 'node:fs';import {createRequire} from 'node:module';import {startServer} from '../scripts/serve.mjs';
// Free vertex editing for the long-duct screen: presets keep their known
// view factors, numeric/drag edits recompute factors immediately, invalid
// edits (concave / self-intersecting / out of bounds) are refused with the
// kernel's reason and keep the previous outline.
assert.equal(existsSync(new URL('../dist/dynamic/dev',import.meta.url)),false);const work=new URL('../work/',import.meta.url);await mkdir(work,{recursive:true});const root=await mkdtemp(new URL('long-duct-editor-browser-',work).pathname);await mkdir(root+'/dynamic/dev',{recursive:true});
for(const f of ['actor.mjs','experiment.mjs','trace-plot.mjs','worker-runtime.mjs','radiation-network.mjs','thermal.mjs','surface-exchange.mjs','properties.mjs','geometry.mjs'])await cp(new URL('../dynamic/'+f,import.meta.url),root+'/dynamic/'+f);for(const f of ['long-duct-radiation.mjs','long-duct.html','long-duct-ui.mjs','long-duct-view.mjs','long-duct-worker.mjs','cavity.css'])await cp(new URL('../dynamic/dev/'+f,import.meta.url),root+'/dynamic/dev/'+f);
const engine=process.env.BROWSER_ENGINE||'chromium',engines=createRequire(import.meta.url)('playwright'),server=await startServer({root,port:0}),browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{...(process.env.BROWSER_EXECUTABLE||existsSync('/usr/bin/chromium')?{executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium'}:{}),args:['--no-sandbox']}: {})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>localStorage.setItem('duct-ui-sentinel','keep'));
 const ready=async()=>{await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='準備完了'&&!document.querySelector('#step').disabled);assert.equal(await page.locator('#error').isVisible(),false);};
 const rows=()=>page.locator('#vertex-rows .vertex-row').count(),rowInput=(i,axis)=>page.locator(`#vertex-rows [data-vertex-row="${i}"] input`).nth(axis),vertexValue=async(i,axis)=>Number(await rowInput(i,axis).inputValue());
 const blur=()=>page.evaluate(()=>document.activeElement?.blur());
 const setVertex=async(i,x,y)=>{await rowInput(i,0).fill(String(x));await rowInput(i,1).fill(String(y));await blur();};
 const preview=()=>page.locator('#vertex-preview').innerText(),errorText=()=>page.locator('#vertex-error').innerText();
 const applyAndReady=async()=>{await page.locator('#apply').click();await ready();await page.locator('#diagnostics').evaluate(e=>e.open=true);};
 const screenOf=async target=>{
  const pts=[];
  for(let i=0;i<await page.locator('#vertex-svg [data-vertex]').count();i++){const box=await page.locator(`#vertex-svg [data-vertex="${i}"]`).boundingBox();pts.push({s:[box.x+box.width/2,box.y+box.height/2],p:[await vertexValue(i,0),await vertexValue(i,1)]});}
  const [A,B,C]=pts,det=(B.p[0]-A.p[0])*(C.p[1]-A.p[1])-(C.p[0]-A.p[0])*(B.p[1]-A.p[1]);
  const alpha=((target[0]-A.p[0])*(C.p[1]-A.p[1])-(target[1]-A.p[1])*(C.p[0]-A.p[0]))/det,beta=((B.p[0]-A.p[0])*(target[1]-A.p[1])-(B.p[1]-A.p[1])*(target[0]-A.p[0]))/det;
  return [A.s[0]+alpha*(B.s[0]-A.s[0])+beta*(C.s[0]-A.s[0]),A.s[1]+alpha*(B.s[1]-A.s[1])+beta*(C.s[1]-A.s[1])];
 };
 const dragVertex=async(i,target,steps=14)=>{
  const box=await page.locator(`#vertex-svg [data-vertex="${i}"]`).boundingBox(),[tx,ty]=await screenOf(target);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(tx,ty,{steps});await page.mouse.up();
 };
 await page.goto(`http://127.0.0.1:${server.address().port}/dynamic/dev/long-duct.html`);await ready();
 // Initial equilateral triangle: 3 rows, F=0.5 in the live preview, deletes locked at the minimum.
 assert.equal(await rows(),3);assert.match(await preview(),/0\.50000/);assert.equal(await page.locator('#vertex-error').isHidden(),true);
 assert.equal(await page.locator('#vertex-rows [data-vertex-row="0"] button').isDisabled(),true);
 // Square preset: known factors sqrt(2)-1 opposite, 1-1/sqrt(2) adjacent, also after applying.
 await page.locator('#height').fill('1');await page.locator('#shape').selectOption('rectangle');
 assert.equal(await rows(),4);assert.match(await preview(),/0\.41421/);
 await applyAndReady();assert.equal(await page.locator('#figure-a [data-wall]').count(),4);assert.match(await page.locator('#diagnostic-values').innerText(),/0\.4142136/);
 // 2x1 rectangle preset: opposite long walls (sqrt(5)-1)/2, opposite short walls sqrt(5)-2.
 await page.locator('#width').fill('2');assert.match(await preview(),/0\.61803/);assert.match(await preview(),/0\.23607/);
 await applyAndReady();const diag2x1=await page.locator('#diagnostic-values').innerText();assert.match(diag2x1,/0\.6180340/);assert.match(diag2x1,/0\.2360680/);
 // Custom mode freezes the preset size inputs; dragging the corner (2,1)->(2,2) makes it a square again.
 await page.locator('#shape').selectOption('custom');assert.equal(await page.locator('#width').isDisabled(),true);assert.equal(await page.locator('#height').isDisabled(),true);
 await dragVertex(2,[2,2]);assert.ok(Math.abs(await vertexValue(2,0)-2)<.02&&Math.abs(await vertexValue(2,1)-2)<.02,'dragged corner lands on (2,2)');
 assert.match(await preview(),/0\.41421/);assert.equal(await page.locator('#vertex-error').isHidden(),true);
 // Regular pentagon built purely by adding vertices and typing coordinates:
 // centre (0.5,0.35), radius 0.75; adjacent (3-sqrt(5))/4, second (sqrt(5)-1)/4.
 await page.locator('#shape').selectOption('triangle');await page.locator('#width').fill('1');await page.locator('#height').fill('0.8660254037844386');await page.locator('#shape').selectOption('custom');
 await page.locator('#vertex-add').click();await page.locator('#vertex-add').click();assert.equal(await rows(),5);
 const ring=[90,162,234,306,18].map(d=>{const a=d*Math.PI/180;return [0.5+0.75*Math.cos(a),0.35+0.75*Math.sin(a)];}),targets=[ring[1],ring[2],ring[3],ring[4],ring[0]];
 for(let i=0;i<5;i++)await setVertex(i,targets[i][0],targets[i][1]);
 assert.equal(await page.locator('#vertex-error').isHidden(),true);assert.match(await preview(),/0\.19098/);assert.match(await preview(),/0\.30902/);
 await applyAndReady();assert.equal(await page.locator('#figure-a [data-wall]').count(),5);const diagPent=await page.locator('#diagnostic-values').innerText();assert.match(diagPent,/0\.1909830/);assert.match(diagPent,/0\.3090170/);
 // Concave edit is refused with the kernel reason; the input reverts and the preview is untouched.
 await page.locator('#shape').selectOption('rectangle');await page.locator('#height').fill('1');
 await setVertex(2,0.4,1);assert.equal(await page.locator('#vertex-error').isHidden(),true);const trapezoidPreview=await preview();
 await rowInput(2,1).fill('0.4');await blur();
 assert.equal(await page.locator('#vertex-error').isVisible(),true);assert.match(await errorText(),/凹形状・自己交差/);
 assert.equal(await vertexValue(2,0),0.4);assert.equal(await vertexValue(2,1),1);assert.equal(await preview(),trapezoidPreview);
 // A self-intersecting target is refused the same way.
 await page.locator('#shape').selectOption('triangle');await page.locator('#shape').selectOption('rectangle');
 await setVertex(1,0.2,0);assert.equal(await page.locator('#vertex-error').isHidden(),true);
 await rowInput(1,1).fill('1.2');await blur();
 assert.equal(await page.locator('#vertex-error').isVisible(),true);assert.match(await errorText(),/凹形状・自己交差/);
 assert.equal(await vertexValue(1,0),0.2);assert.equal(await vertexValue(1,1),0);
 // Vertex count bounds: 3 minimum (deletes disabled) and 12 maximum (add disabled).
 await page.locator('#shape').selectOption('triangle');await page.locator('#height').fill('0.8660254037844386');
 assert.equal(await rows(),3);assert.equal(await page.locator('#vertex-rows [data-vertex-row="0"] button').isDisabled(),true);
 for(let k=0;k<9;k++)await page.locator('#vertex-add').click();
 assert.equal(await rows(),12);assert.equal(await page.locator('#vertex-add').isDisabled(),true);assert.equal(await page.locator('#vertex-error').isHidden(),true);
 // Dragging a square corner past the diagonal is refused en route: the vertex
 // sticks at the last valid position and the reason stays visible.
 await page.locator('#shape').selectOption('rectangle');await page.locator('#height').fill('1');
 await dragVertex(0,[0.75,0.75],16);
 assert.equal(await page.locator('#vertex-error').isVisible(),true);assert.ok(await vertexValue(0,0)<0.6,'vertex sticks before the diagonal');assert.ok((await preview()).length>0);
 // No horizontal overflow with the editor at phone and desktop widths, both schemes.
 for(const width of [375,390,1280])for(const colorScheme of ['light','dark']){await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`no horizontal overflow at ${width}/${colorScheme}`);}
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(80);await page.screenshot({path:new URL(`../work/long-duct-editor-${engine}-mobile-dark.png`,import.meta.url).pathname,fullPage:true});
 assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),{'duct-ui-sentinel':'keep'});assert.deepEqual(errors,[]);console.log(JSON.stringify({engine,developmentOnly:true,freeVertexEditing:true,presetsKnownFactors:true,numericEditPentagon:true,dragEdit:true,concaveRejectedAtomically:true,selfIntersectionRejected:true,vertexCountBounds:true,invalidDragSticksWithReason:true,immediateFactorPreview:true,mobileLightDark:true,localStorageUnchanged:true,offlineVerified:false,passed:true}));await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
