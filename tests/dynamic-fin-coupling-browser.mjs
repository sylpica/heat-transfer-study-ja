// Acceptance browser check for the fin coupling release
// (FIN_COUPLING_ACCEPTANCE_20261107.md, conditions (a)5/(b)5). Manual probe,
// not part of `npm test` (same convention as tests/dynamic-browser.mjs):
//   node tests/dynamic-fin-coupling-browser.mjs [chromium|webkit]
// Serves the repository root (development sources) and drives the real lab
// screen through its Worker path: fin preset + k(T)/cp(T) tables must be
// accepted, and the ambient step schedule must run without errors.
import assert from 'node:assert/strict';import {existsSync} from 'node:fs';import {createRequire} from 'node:module';
import {startServer} from '../scripts/serve.mjs';
const engine=process.argv[2]||process.env.BROWSER_ENGINE||'chromium',engines=createRequire(import.meta.url)('playwright');
// No root argument: serve.mjs defaults to the repository root. (Passing a
// URL pathname would add a trailing slash, which trips the server's 403
// prefix guard; the existing browser tests avoid it the same way.)
const server=await startServer({port:0});
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{...((process.env.BROWSER_EXECUTABLE||existsSync('/usr/bin/chromium'))?{executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium'}:{}),args:['--no-sandbox']}:{})});
 const page=await (await browser.newContext({viewport:{width:1280,height:900}})).newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const ready=async()=>page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('準備完了'),null,{timeout:30000});
 const step=async()=>{const before=await page.locator('#clock').innerText();await page.locator('#step').click();await page.waitForFunction(old=>document.querySelector('#clock').textContent!==old,before,{timeout:30000});};
 await page.goto(base+'/dynamic/index.html');await ready();
 await page.locator('#mode').selectOption('expert');
 await page.locator('[data-preset=fin]').click();await ready();
 assert.equal(await page.locator('#fin-ambient').inputValue(),'20');
 await page.locator('#property-table').evaluate(el=>el.open=true);
 await page.locator('#use-k-table').evaluate(el=>el.checked=true);await page.locator('#k-table').fill('250,150\n400,250');
 await page.locator('#use-cp-table').evaluate(el=>el.checked=true);await page.locator('#cp-table').fill('250,700\n400,1000');
 await page.locator('#conditions button[type=submit], #apply').first().click();await ready();
 assert.match(await page.locator('#model-label').innerText(),/k\(T\)/);
 assert.equal(await page.locator('#error').isHidden(),true);
 await step();await step();
 assert.match(await page.locator('#diagnostic-values').textContent(),/エネルギー収支誤差/);
 await page.locator('#free-settings').evaluate(el=>el.open=true);
 await page.locator('#fin-ambient-step-time').fill('1');await page.locator('#fin-ambient-step-temperature').fill('40');
 await page.locator('#conditions button[type=submit], #apply').first().click();await ready();
 for(let i=0;i<5;i++)await step();
 assert.equal(await page.locator('#error').isHidden(),true);
 assert.ok(parseFloat(await page.locator('#clock').innerText())>1);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine,ok:true,clock:await page.locator('#clock').innerText(),modelLabel:await page.locator('#model-label').innerText()}));
}catch(e){console.log(JSON.stringify({engine,ok:false,error:String(e).slice(0,600)}));process.exitCode=1;}
finally{await browser?.close().catch(()=>{});server.close();}
