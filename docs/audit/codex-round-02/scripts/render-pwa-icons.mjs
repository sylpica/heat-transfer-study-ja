import {fileURLToPath} from 'node:url';
const auditRoot=fileURLToPath(new URL('../../../../',import.meta.url));
const auditOut=fileURLToPath(new URL('../evidence/',import.meta.url));
// Render the existing vector icon verbatim at standard PWA raster sizes.
import {createRequire} from 'node:module';import {startServer} from '../../../../scripts/serve.mjs';
const require=createRequire(auditRoot+'package.json');const {chromium}=require('playwright');const server=await startServer({root:auditRoot,port:0});const b=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
try{for(const size of [192,512]){const p=await b.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});await p.goto(`http://127.0.0.1:${server.address().port}/assets/icon.svg`);await p.locator('svg').waitFor();await p.screenshot({path:`${auditRoot}assets/icon-${size}.png`,omitBackground:true});await p.close();}}finally{await b.close();await new Promise(r=>server.close(r));}
