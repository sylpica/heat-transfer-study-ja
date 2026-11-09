// Narrow read-only browser probe: three concrete alt candidates, no suite.
import{createRequire}from'node:module';import{fileURLToPath}from'node:url';import{writeFile,mkdir}from'node:fs/promises';
import{startServer}from'../../../../scripts/serve.mjs';import{lessonDiagramAlt,lessonDiagramPath}from'../../../../lesson-diagrams.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),require=createRequire(root+'package.json'),{chromium}=require('playwright');
const server=await startServer({root:root+'dist',port:0});let browser;const rows=[],errors=[];
try{browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:375,height:900},serviceWorkers:'block'});page.on('pageerror',e=>errors.push(e.message));
for(const id of['5.6','10.1','11.10']){
 await page.goto(`http://127.0.0.1:${server.address().port}/#reader/${id}`);const img=page.locator(`.lesson-diagram img[src="${lessonDiagramPath(id)}"]`);await img.waitFor();await img.scrollIntoViewIfNeeded();await img.evaluate(img=>img.complete&&img.naturalWidth>0?Promise.resolve():new Promise((resolve,reject)=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',()=>reject(Error('image load failed')),{once:true});}));
 const dom=await img.evaluate(el=>({alt:el.alt,complete:el.complete,naturalWidth:el.naturalWidth,box:el.getBoundingClientRect().toJSON(),scrollWidth:document.documentElement.scrollWidth,innerWidth}));
 rows.push({id,registry:lessonDiagramAlt(id),...dom,aria_snapshot:await img.ariaSnapshot()});
 if(id==='11.10'||id==='10.1'){await mkdir(new URL('screenshots/',import.meta.url),{recursive:true});await img.screenshot({path:fileURLToPath(new URL(`screenshots/${id}.png`,import.meta.url))});}
}
}finally{await browser?.close();await new Promise(r=>server.close(r));}
await writeFile(new URL('targeted-alt.json',import.meta.url),JSON.stringify({scope:'Three candidate images at375px in Chromium, DOM/AX snapshots, not actual AT operation or full browser suite',rows,pageerrors:errors},null,2)+'\n');console.log(JSON.stringify({cases:rows.length,pageerrors:errors,literal_entity:rows[0].alt.includes('&gt;'),all_images_loaded:rows.every(x=>x.naturalWidth>0)}));
