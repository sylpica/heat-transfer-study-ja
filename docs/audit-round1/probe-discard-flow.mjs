// Focused check: start a quiz, exit it, and confirm the resume banner with
// [data-action="discard-quiz"] appears on the setup screen (the flow that
// timed out in tests/browser-distribution.mjs:731 under extreme VM load).
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
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
const t0 = Date.now();
await page.goto(base + '#quiz', { waitUntil: 'networkidle' });
await page.click('#quiz-start-form button[type=submit]');
await page.locator('[data-action="open-report"]').waitFor({ state: 'visible', timeout: 60000 });
console.log('quiz started at', Date.now() - t0, 'ms');
await page.click('[data-action="exit-quiz"]');
await page.locator('[data-action="discard-quiz"]').waitFor({ state: 'visible', timeout: 60000 });
console.log('discard-quiz visible at', Date.now() - t0, 'ms; pageerrors:', errors.length);
await page.click('[data-action="discard-quiz"]');
await page.waitForTimeout(500);
console.log('after discard, banner gone:', await page.locator('[data-action="discard-quiz"]').count() === 0);
await browser.close();
server.close();
