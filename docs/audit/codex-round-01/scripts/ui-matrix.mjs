import {fileURLToPath} from 'node:url';
const auditRoot=fileURLToPath(new URL('../../../../',import.meta.url));
const auditOut=fileURLToPath(new URL('../evidence/',import.meta.url));
import {createRequire} from 'node:module';import {writeFile,mkdir} from 'node:fs/promises';
import {startServer} from '../../../../scripts/serve.mjs';
const require=createRequire(auditRoot+'package.json');const {chromium}=require('playwright');
const server=await startServer({root:auditRoot+'dist',port:0});const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block',viewport:{width:375,height:900}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const base=`http://127.0.0.1:${server.address().port}`;const rows=[];
await mkdir(auditOut+'screenshots',{recursive:true});
try{
 await page.goto(base);await page.locator('.app-shell').waitFor();
 for(const theme of ['light','dark']){await page.emulateMedia({colorScheme:theme});
 for(const width of [320,375,390,430,768,1280,1920]){await page.setViewportSize({width,height:900});
 for(const route of ['home','reader','quiz','review','search','glossary','map','simulator','lab','plan','calendar','settings','guide']){
 await page.evaluate(route=>{location.hash=route;},route);await page.waitForTimeout(100);
 rows.push(await page.evaluate(({theme,width,route})=>({theme,width,route,innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth,heading:document.querySelector('h1')?.textContent,offenders:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.right>innerWidth+1||r.left< -1)&&getComputedStyle(e).position!=='fixed';}).slice(0,8).map(e=>({tag:e.tagName,cls:e.className}))}),{theme,width,route}));
 if(width===375&&['glossary','simulator','lab'].includes(route))await page.screenshot({path:`${auditOut}screenshots/${theme}-${width}-${route}.png`});
 }
 }
 }
 const result={browser:'Chromium',measurements:rows.length,overflows:rows.filter(r=>r.overflow),pageerrors:errors,rows};await writeFile(auditOut+'ui-matrix.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({measurements:rows.length,overflows:result.overflows,pageerrors:errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
