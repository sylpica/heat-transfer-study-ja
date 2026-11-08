// Round-3 probe: the reader <img> alt for lesson diagrams now carries the
// diagram content description (R1-P3-17 residual fix). Serves dist exactly
// like tests/browser-distribution.mjs does.
import {chromium} from 'playwright';
import {startServer} from '../../scripts/serve.mjs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '../../dist');
const server = await startServer({root, port: 0});
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 375, height: 800}});
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
for (const sec of ['1.1', '9.5']) {
  await page.goto(`${base}/index.html#reader/${sec}`, {waitUntil: 'load'});
  await page.waitForSelector('figure.lesson-diagram img', {timeout: 30000});
  const alt = await page.evaluate(() => document.querySelector('figure.lesson-diagram img')?.getAttribute('alt') || null);
  console.log(sec, 'alt length:', alt?.length);
  console.log(sec, 'alt head:', alt?.slice(0, 110));
}
console.log('pageerrors:', errors.length, errors.slice(0, 2));
await browser.close();
server.close();
