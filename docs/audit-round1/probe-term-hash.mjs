// Audit round 1 probe (R1-P2-03): a '#term-<id>' hash (issued by the dynamic
// lab's popup guide, dynamic/sim-guide.mjs) must land on the glossary with the
// term expanded and scrolled into view — not on the home screen.
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

await page.goto(base + '#term-thermal-conductivity', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const landed = await page.evaluate(() => {
  const el = document.getElementById('term-thermal-conductivity');
  const body = document.getElementById('term-body-thermal-conductivity');
  const r = el?.getBoundingClientRect();
  return { h1: document.querySelector('h1')?.textContent || '', termEl: !!el, expanded: !!body && !body.hidden, inView: !!r && r.top < innerHeight && r.bottom > 0 };
});
console.log('term hash landing:', JSON.stringify(landed));

await page.goto(base + '#term-no-such-term', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const bogus = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent || '' }));
console.log('bogus term hash:', JSON.stringify(bogus));

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const home = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent || '' }));
console.log('plain home:', JSON.stringify(home));
console.log('pageerrors:', errors.length);
await browser.close();
server.close();
