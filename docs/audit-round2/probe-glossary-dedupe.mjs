// Audit round 2 probe (R2-03 / A5-F01): on the public build, the expanded
// glossary row and the flashcard back must not show the brief's sentence
// twice in a row (brief -> meaning lead, meaning -> detail lead).
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
const page = await browser.newPage({ viewport: { width: 375, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

await page.goto(base + '#term-heat', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const row = await page.evaluate(() => {
  const brief = document.querySelector('#term-heat .term-brief')?.textContent || '';
  const bodyParas = [...document.querySelectorAll('#term-body-heat > p')].map(p => p.textContent);
  return { brief, firstBody: bodyParas[0] || '', dup: !!brief && (bodyParas[0] || '').startsWith(brief) };
});
console.log('row heat:', JSON.stringify(row));

// biot-number: detail starts with the full meaning -> details block must not repeat it
await page.goto(base + '#term-biot-number', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const bio = await page.evaluate(() => {
  const detail = document.querySelector('#term-body-biot-number .term-full p')?.textContent || '';
  const meaning = document.querySelector('#term-body-biot-number > p')?.textContent || '';
  return { detailStart: detail.slice(0, 40), meaningStart: meaning.slice(0, 40), dup: !!meaning && detail.startsWith(meaning) };
});
console.log('row biot-number:', JSON.stringify(bio));

// flashcard back for 'heat': switch to cards mode and flip
await page.goto(base + '#glossary', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const flash = await page.evaluate(async () => {
  const modeBtn = [...document.querySelectorAll('button')].find(b => b.dataset.flashMode === 'cards' || /単語帳/.test(b.textContent));
  modeBtn?.click();
  await new Promise(r => setTimeout(r, 400));
  const flip = document.querySelector('[data-action="flash-flip"]');
  flip?.click();
  await new Promise(r => setTimeout(r, 400));
  const brief = document.querySelector('.flash-brief')?.textContent || '';
  const paras = [...document.querySelectorAll('.flash-back .flash-scroll > p')].map(p => p.textContent);
  return { brief: brief.slice(0, 30), second: (paras[1] || '').slice(0, 30), dup: !!brief && (paras[1] || '').startsWith(brief) };
});
console.log('flash back:', JSON.stringify(flash));
console.log('pageerror:', errors.length, errors.slice(0, 3));
await browser.close();
server.close();
