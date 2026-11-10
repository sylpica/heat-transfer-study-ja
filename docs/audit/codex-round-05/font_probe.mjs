// Narrow rendering harness for real stylesheet selectors, not an app/E2E suite.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire('/workspace/work/codex-round-03/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
try{
 const page=await browser.newPage({viewport:{width:375,height:720},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const css=fs.readFileSync('styles.css','utf8');
 const markup=`<main><p id="body" class="book-paragraph">∇T · n⃗ ／ j⃗₁ = −ρ𝒟₁₂∇m₁</p><div class="book-quote"><p id="quote">n⃗ · dS⃗ ／ J⃗ = −c𝒟∇x</p></div><div class="reader-deep-lesson"><div id="deep" class="deep-expression">n⃗ · dS⃗ ／ j⃗ = −ρ𝒟∇m</div></div><div class="term-sheet"><div id="term" class="term-formula">n⃗ · dS⃗ ／ j⃗ = −ρ𝒟∇m</div></div><p id="control" style="font-family:'Noto Sans JP',sans-serif">n⃗ · dS⃗ ／ j⃗ = −ρ𝒟∇m</p></main>`;
 const results=[];
 for(const width of [375,1280])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:720});await page.emulateMedia({colorScheme:theme});
  await page.setContent(`<html lang="ja" data-theme="${theme}"><style>${css}</style><style>body{margin:0;padding:12px}main{max-width:760px}#body,#quote,#deep,#term,#control{font-size:24px;line-height:2;overflow-wrap:anywhere}.book-quote{margin:0;padding:8px}.term-sheet{position:static;max-width:100%;box-sizing:border-box}</style>${markup}</html>`);
  await page.evaluate(()=>document.fonts.ready);
  const client=await page.context().newCDPSession(page);await client.send('DOM.enable');await client.send('CSS.enable');const {root}=await client.send('DOM.getDocument');
  const nodes=[];
  for(const id of ['body','quote','deep','term','control']){
   const {nodeId}=await client.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#'+id});
   const fonts=await client.send('CSS.getPlatformFontsForNode',{nodeId});
   const metrics=await page.locator('#'+id).evaluate(e=>({family:getComputedStyle(e).fontFamily,text:e.textContent,width:e.getBoundingClientRect().width,scroll:e.scrollWidth,client:e.clientWidth}));
   nodes.push({id,...metrics,fonts:fonts.fonts});
  }
  results.push({width,theme,nodes,errors:[...errors]});await client.detach();
  if(width===375&&theme==='light')await page.screenshot({path:'docs/audit/codex-round-05/evidence/font-probe-375.png',timeout:15000});
 }
 fs.writeFileSync('docs/audit/codex-round-05/evidence/font-probe.json',JSON.stringify({browser:await browser.version(),scope:'Stylesheet-selector harness; no actual reader, OS, WebKit or assistive technology certification',results},null,2)+'\n');
 console.log(JSON.stringify({cases:results.length,errors:errors.length,nodes:results[0].nodes.map(n=>({id:n.id,fonts:n.fonts.map(f=>({family:f.familyName,glyphs:f.glyphCount}))}))}));
}finally{await browser.close()}
