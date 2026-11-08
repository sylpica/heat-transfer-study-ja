// Guide-review verification (standalone, not part of `npm test`):
// operate the app in Chromium exactly as the revised guide describes,
// against the built dist. Run `npm run build:public` first, then
// `node tests/guide-review-browser.mjs`.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('playwright');
const DIST = new URL('../dist', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(DIST, p);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const results = [];
const check = (name, ok, detail = '') => { results.push([name, ok, detail]); if (!ok) console.log('FAIL:', name, detail); };

const browser = await chromium.launch();
async function overflow(page, label) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check(`no horizontal overflow @${label}`, m.sw <= m.iw, `scrollWidth=${m.sw} innerWidth=${m.iw}`);
}

// ---------- desktop light ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(90000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  // 1. Guide view: 49 sections incl. the new lab section
  await page.goto(base + '/#guide');
  await page.waitForSelector('.guide-layout');
  const count = await page.locator('.guide-count').innerText();
  check('guide count shows 49', count.includes('全49項目'), count);
  check('guide TOC has lab link', await page.locator('.guide-toc nav a[href="#guide/lab"]').count() === 1);
  await overflow(page, '1280 guide');

  // 2. Open the lab guide section from the TOC, follow its cross-links
  await page.click('.guide-toc nav a[href="#guide/lab"]');
  await page.waitForSelector('#guide-lab');
  check('lab section anchor', page.url().endsWith('#guide/lab'), page.url());
  const labText = await page.locator('#guide-lab').innerText();
  check('lab section mentions lab tab', labText.includes('通常シミュレーター') && labText.includes('実験室を開く'));
  await page.click('#guide-lab a[href="#guide/simulator"]');
  await page.waitForSelector('#guide-simulator');
  check('lab -> simulator cross-link', page.url().endsWith('#guide/simulator'), page.url());
  await page.goto(base + '/#guide/lab');
  await page.click('#guide-lab a[href="#guide/reader"]');
  await page.waitForSelector('#guide-reader');
  check('lab -> reader cross-link', page.url().endsWith('#guide/reader'), page.url());
  const readerText = await page.locator('#guide-reader').innerText();
  check('reader guide covers chapter extras', readerText.includes('章末問題・参考文献') && readerText.includes('563問') && readerText.includes('410件'));
  check('reader guide covers section->experiment', readerText.includes('動的実験'));

  // 3. Lab screen: help link now points at the lab guide section
  await page.goto(base + '/#lab');
  await page.waitForSelector('.lab-entry-card');
  const helpHref = await page.locator('a.page-help').getAttribute('href');
  check('lab screen help link', helpHref === '#guide/lab', String(helpHref));
  await page.click('a.page-help');
  await page.waitForSelector('#guide-lab');
  check('lab help link reaches lab section', page.url().endsWith('#guide/lab'), page.url());

  // 4. Reader: chapter extras via the TOC button (chapter 1: 46 problems / 22 refs)
  await page.goto(base + '/#reader');
  await page.waitForSelector('[data-chapter-extras="ch1"]');
  await page.click('[data-chapter-extras="ch1"]');
  await page.waitForSelector('#chapter-extras', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('#chapter-extras')?.textContent.includes('問題（46問）'), null, { timeout: 20000 });
  const extrasText = await page.locator('#chapter-extras').innerText();
  check('ch1 extras counts', extrasText.includes('問題（46問）') && extrasText.includes('参考文献（22件）'), extrasText.slice(0, 120));
  await page.locator('#chapter-extras details.chapter-extras-group > summary').first().click();
  const firstProblem = page.locator('#chapter-extras details.chapter-problem-item').first();
  await firstProblem.locator('> summary').click();
  const probText = await firstProblem.innerText();
  check('ch1 first problem opens with text', probText.length > 40, probText.slice(0, 60));

  // 5. Section -> experiment link (section 2.1 has a dynamic experiment card)
  await page.goto(base + '/#reader');
  await page.locator('summary:has(> small:text-is("第2章"))').first().click();
  await page.click('.toc-item[data-section="2.1"]');
  await page.waitForSelector('aside[aria-label="関連する動的実験"] a', { timeout: 20000 });
  const expHref = await page.locator('aside[aria-label="関連する動的実験"] a').getAttribute('href');
  check('section 2.1 experiment href', expHref === './dynamic/index.html?preset=heating&section=2.1', String(expHref));
  const [dyn] = await Promise.all([ctx.waitForEvent('page'), page.click('aside[aria-label="関連する動的実験"] a')]);
  await dyn.waitForLoadState('load');
  const dynTitle = await dyn.title();
  check('dynamic lab page opens', dynTitle.includes('動的熱移動実験室'), dynTitle);
  await dyn.close();

  // 6. Question -> experiment: answer the fin question, link appears in feedback
  await page.goto(base + '/#quiz');
  await page.click('[data-action="toggle-question-bank"]');
  await page.waitForSelector('.question-bank-list');
  const bankItem = page.locator('.bank-item', { hasText: '断熱先端の一定断面フィンで' }).first();
  await bankItem.scrollIntoViewIfNeeded();
  await bankItem.click();
  await page.waitForSelector('label.answer-choice', { timeout: 20000 });
  await page.locator('label.answer-choice').first().click();
  await page.click('button.answer-submit');
  await page.waitForSelector('#answer-feedback', { timeout: 20000 });
  const fbLink = page.locator('#answer-feedback a', { hasText: 'この条件のフィンを動的実験で観察する' });
  check('feedback experiment link exists', await fbLink.count() === 1);
  const fbHref = await fbLink.getAttribute('href');
  check('feedback experiment href', fbHref === './dynamic/index.html?case=fin-base-v1', String(fbHref));

  check('no pageerror (desktop)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------- smartphone widths, light + dark ----------
for (const [w, scheme] of [[375, 'light'], [390, 'light'], [375, 'dark'], [1920, 'dark']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme });
  const page = await ctx.newPage(); page.setDefaultTimeout(90000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(base + '/#guide/lab');
  await page.waitForSelector('#guide-lab');
  await overflow(page, `${w} ${scheme} guide-lab`);
  await page.goto(base + '/#reader');
  await page.locator('summary:has(> small:text-is("第5章"))').first().click();
  await page.click('[data-chapter-extras="ch5"]');
  await page.waitForFunction(() => document.querySelector('#chapter-extras')?.textContent.includes('問題（66問）'), null, { timeout: 20000 });
  await overflow(page, `${w} ${scheme} reader extras`);
  check(`no pageerror (${w} ${scheme})`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter(r => !r[1]);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
for (const [n, ok] of results) console.log((ok ? 'PASS ' : 'FAIL ') + n);
process.exit(failed.length ? 1 : 0);
