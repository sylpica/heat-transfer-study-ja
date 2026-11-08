// Audit round 1 probe (R1-P2-08): while the report modal or the quiz-start
// confirm modal is open, .app-shell must be inert (background unreachable),
// and inert must be removed when the modal closes.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = new URL('../../dist/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
const shellInert = () => page.evaluate(() => document.querySelector('.app-shell')?.hasAttribute('inert'));
const tryFocusBackground = () => page.evaluate(() => {
  const link = document.querySelector('.main-nav .nav-link');
  link?.focus();
  return document.activeElement === link;
});

await page.goto(base + '#quiz', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
// Start a quiz from the setup screen (default settings, submit the setup form).
await page.evaluate(() => { document.querySelector('#quiz-start-form button[type=submit]')?.click(); });
await page.waitForTimeout(800);
const inQuiz = await page.evaluate(() => !!document.querySelector('[data-action="open-report"]'));
console.log('quiz started:', inQuiz);

await page.click('[data-action="open-report"]');
await page.waitForTimeout(400);
const reportState = { modal: await page.evaluate(() => !!document.querySelector('.report-modal')), inert: await shellInert(), bgFocusable: await tryFocusBackground() };
console.log('report modal:', JSON.stringify(reportState));

await page.click('[data-action="close-report"]');
await page.waitForTimeout(400);
console.log('after close, inert:', await shellInert());

// Quiz-start confirm: an in-progress session exists now; go to setup and start again.
await page.evaluate(() => { location.hash = '#quiz'; });
await page.waitForTimeout(600);
await page.click('[data-action="exit-quiz"]');
await page.waitForTimeout(600);
await page.evaluate(() => { document.querySelector('#quiz-start-form button[type=submit]')?.click(); });
await page.waitForTimeout(800);
const confirmState = { modal: await page.evaluate(() => !!document.querySelector('.quiz-start-modal')), inert: await shellInert(), bgFocusable: await tryFocusBackground() };
console.log('quiz-start confirm:', JSON.stringify(confirmState));
if (confirmState.modal) {
  await page.click('[data-action="cancel-quiz-start"]');
  await page.waitForTimeout(400);
  console.log('after cancel, inert:', await shellInert());
}
console.log('pageerrors:', errors.length, errors.slice(0, 2));
await browser.close();
server.close();
