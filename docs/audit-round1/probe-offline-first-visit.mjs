// Audit round 1 probe (R1-P1-01): after exactly ONE online visit, going
// offline and reloading must still render the app and the reader content,
// because the section JSON files are in the service worker precache.
// Method: stop the HTTP server entirely (Playwright's setOffline does not
// block service-worker fetches, so it cannot measure this).
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
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

await page.goto(base, { waitUntil: 'networkidle' });
await page.evaluate(async () => { await navigator.serviceWorker.ready; });
// Wait until the app cache actually holds the section files (install addAll).
await page.waitForFunction(async () => {
  const names = await caches.keys();
  for (const name of names) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    if (keys.filter(k => k.url.includes('/data/sections/')).length >= 76) return true;
  }
  return false;
}, null, { timeout: 60000 });
const cached = await page.evaluate(async () => {
  const out = {};
  for (const name of await caches.keys()) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    out[name] = { total: keys.length, sections: keys.filter(k => k.url.includes('/data/sections/')).length };
  }
  return out;
});
console.log('cache after one visit:', JSON.stringify(cached));

// Go offline for real: kill the server and its connections.
await new Promise(r => { server.closeAllConnections?.(); server.close(() => r()); });

await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(1500);
const home = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent || '', loadError: document.body.textContent.includes('教材を読み込めませんでした') }));
console.log('offline reload home:', JSON.stringify(home));

await page.goto(base + '#reader', { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(1500);
const reader = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent || '', hasBlocks: document.querySelectorAll('.book-block, [class*=block]').length > 0, loadError: document.body.textContent.includes('教材を読み込めませんでした') }));
console.log('offline reader:', JSON.stringify(reader));
console.log('pageerrors:', errors.length, errors.slice(0, 2));
await browser.close();
