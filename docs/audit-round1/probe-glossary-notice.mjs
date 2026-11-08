// R1-P2-02 regression probe: open the glossary screen in Chromium and verify
// the footer notice states the translated text IS included in the reader,
// and the false "not included" sentence is gone. Run from the repo root.
import {createRequire} from 'node:module';
import {startServer} from '../../scripts/serve.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const server=await startServer({port:0}),base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,timeout:20000});
const page=await (await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Tokyo'})).newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`${base}/#glossary`);
await page.locator('.glossary-grid').waitFor();
const text=await page.locator('body').innerText();
console.log('hasCorrect:',text.includes('原書の翻訳本文は読書画面に収録しています'));
console.log('hasFalse:',text.includes('原書の翻訳本文は未収録です'));
console.log('pageerrors:',errors.length);
await browser.close();server.close();
