import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {startServer} from '../../../../scripts/serve.mjs';
import {createEmptyState,localDay} from '../../../../study-core.mjs';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const require=createRequire(root+'package.json'),{chromium}=require('playwright');
const output=new URL('../evidence/current-screenshots/',import.meta.url);
await mkdir(output,{recursive:true});
const server=await startServer({root:root+'dist',port:0});
let browser;
const rows=[];
try{
  browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
  for(const [name,width,theme,route,target] of [
    ['reader-8-4-375-light',375,'light','#reader/8.4','8.44b'],
    ['reader-10-3-1280-dark',1280,'dark','#reader/10.3','表10.2　さまざまな二次元配置'],
    ['glossary-375-dark',375,'dark','#term-fin-efficiency',null],
    ['glossary-1280-light',1280,'light','#term-fin-efficiency',null],
    ['calendar-375-light',375,'light','#calendar',null],
    ['calendar-1280-dark',1280,'dark','#calendar',null]
  ]){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,serviceWorkers:'block'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const state=createEmptyState();state.settings.theme=theme;
    const now=new Date();
    if(route==='#calendar')state.sessions=[{id:'audit-inconsistent',date:localDay(now),startedAt:now.toISOString(),total:99,correct:99,answers:[]}];
    await page.addInitScript(state=>localStorage.setItem('heat-study-ja:v1',JSON.stringify(state)),state);
    await page.goto(`http://127.0.0.1:${server.address().port}/`+route);
    if(route.startsWith('#reader')){
      await page.locator('.reader-title').waitFor();
      await page.getByText(target,{exact:false}).first().scrollIntoViewIfNeeded();
    }else if(route.startsWith('#term-')){
      await page.locator('#term-fin-efficiency .term-body').waitFor({state:'visible'});
      await page.locator('#term-fin-efficiency').scrollIntoViewIfNeeded();
    }
    else{await page.locator('.session-entry').waitFor();await page.locator('.session-entry').scrollIntoViewIfNeeded();}
    const data=await page.screenshot({path:fileURLToPath(new URL(name+'.png',output)),animations:'disabled'});
    rows.push({name,width,theme,route,sha256:createHash('sha256').update(data).digest('hex'),bytes:data.length,pageerrors:errors});
    await context.close();
  }
}finally{
  await browser?.close();await new Promise(resolve=>server.close(resolve));
}
await writeFile(new URL('../evidence/current-screenshots.json',import.meta.url),JSON.stringify({scope:'Six current Chromium viewports; separate from restored round1 history',rows},null,2)+'\n');
console.log(JSON.stringify({screenshots:rows.length,pageerrors:rows.flatMap(row=>row.pageerrors)}));
