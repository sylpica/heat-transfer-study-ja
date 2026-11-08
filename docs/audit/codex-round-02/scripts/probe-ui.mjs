import {fileURLToPath} from 'node:url';
const auditRoot=fileURLToPath(new URL('../../../../',import.meta.url));
const auditOut=fileURLToPath(new URL('../evidence/',import.meta.url));
import {createRequire} from 'node:module';import {writeFile} from 'node:fs/promises';import {startServer} from '../../../../scripts/serve.mjs';
const require=createRequire(auditRoot+'package.json');const {chromium}=require('playwright');const server=await startServer({root:auditRoot+'dist',port:0});const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:375,height:844},serviceWorkers:'block'});const p=await context.newPage();const base=`http://127.0.0.1:${server.address().port}`;const result={};
try{
 await p.goto(base+'/#term-fin-efficiency');await p.locator('#term-fin-efficiency .term-toggle').waitFor();result.dedupe=await p.locator('#term-fin-efficiency').evaluate(row=>({brief:row.querySelector('.term-brief').textContent,meaning:row.querySelector('.term-body >p')?.textContent}));
 const errors=[];p.on('pageerror',e=>errors.push(e.message));const findings=[];
 for(const width of [320,375,1280]){await p.setViewportSize({width,height:844});for(const route of ['home','reader','glossary','quiz','settings','map','guide','simulator','lab','calendar','plan','review','search']){
 await p.goto(base+'/#'+route);await p.locator('.app-shell').waitFor();if(route==='glossary'){await p.locator('#term-biot-number .term-toggle').click();}
 const candidates=await p.evaluate(()=>{
 const es=[...document.querySelectorAll('a[href],button,input,select,summary,[role=button]')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&!e.disabled&&!e.closest('[hidden],[inert]')});const targets=es.map(e=>({e,r:e.getBoundingClientRect()}));const out=[];
 for(const {e,r} of targets){if(r.width>=24&&r.height>=24)continue;if(e.classList.contains('skip-link'))continue;
 const inline=e.matches('.inline-term')||e.matches('a')&&e.closest('p,li,dd,dt,td,th,figcaption');if(inline)continue;
 if(e.matches('input[type=checkbox],input[type=radio]')&&e.closest('label')?.getBoundingClientRect().height>=24)continue;
 const cx=r.x+r.width/2,cy=r.y+r.height/2;const conflicts=[];
 for(const {e:o,r:b} of targets){if(o===e||o.contains(e)||e.contains(o))continue;const dx=Math.max(b.left-cx,0,cx-b.right),dy=Math.max(b.top-cy,0,cy-b.bottom);let collide;
 if(b.width<24||b.height<24)collide=Math.hypot((b.x+b.width/2)-cx,(b.y+b.height/2)-cy)<24-0.1;
 else collide=Math.hypot(dx,dy)<12-0.1;
 if(collide)conflicts.push({tag:o.tagName,cls:o.className,text:o.textContent.slice(0,60)});
 }
 if(conflicts.length)out.push({tag:e.tagName,cls:e.className,text:(e.textContent||e.getAttribute('aria-label')||'').slice(0,80),width:r.width,height:r.height,conflicts:conflicts.slice(0,3)});
 }
 return out;
 });if(candidates.length)findings.push({width,route,candidates});
 }}
 result.targetCandidates=findings;result.errors=errors;const cdp=await context.newCDPSession(p);result.manifest=await cdp.send('Page.getAppManifest');result.installability=await cdp.send('Page.getInstallabilityErrors');await writeFile(auditOut+'ui-recheck.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result).slice(0,6500));
}finally{await browser.close();await new Promise(r=>server.close(r));}
