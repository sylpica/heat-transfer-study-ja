// Audit round 2 probe (user reports 2026-11-08 22:50): verify on the final
// integrated build, with real browser operations from a cold profile, that
// (1) the simple simulator's mode selection is a collapsed picker (no long
//     scroll through a fully expanded mode list), and
// (2) a first-time user can find and open the normal simulator (dynamic lab)
//     without any explanation: main nav -> lab tab -> open-lab button -> lab.
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
const out = {};
const browser = await chromium.launch();

for (const width of [375, 1280]) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 375 ? 844 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  // --- cold start on home: is the normal-simulator entry visible in nav? ---
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const nav = await page.evaluate(() => {
    const links = [...document.querySelectorAll('.main-nav .nav-link')].map(a => ({
      text: a.textContent.trim(), href: a.getAttribute('href'),
      top: Math.round(a.getBoundingClientRect().top), visible: a.getBoundingClientRect().height > 0,
    }));
    return { links, navBottom: Math.round(document.querySelector('.main-nav')?.getBoundingClientRect().bottom || 0), vh: innerHeight };
  });
  out[`nav@${width}`] = nav;

  // --- complaint 1: simple simulator mode picker ---
  await page.click('.main-nav a[href="#simulator"]');
  await page.waitForTimeout(600);
  const simInitial = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent || '',
    panelPresent: !!document.querySelector('.sim-mode-panel'),
    toggleText: document.querySelector('[data-action="toggle-sim-picker"]')?.textContent.trim() || '',
    toggleExpanded: document.querySelector('[data-action="toggle-sim-picker"]')?.getAttribute('aria-expanded'),
    currentMode: document.querySelector('.sim-current strong')?.textContent || '',
    pageHeight: document.documentElement.scrollHeight, vh: innerHeight,
    tabsInDom: document.querySelectorAll('[role="tab"][data-sim-mode]').length,
  }));
  out[`sim-initial@${width}`] = simInitial;

  // open the picker with a real click, then pick the LAST category's last mode
  await page.click('[data-action="toggle-sim-picker"]');
  await page.waitForTimeout(400);
  const pickerOpen = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role="tab"][data-sim-mode]')];
    const groups = [...document.querySelectorAll('.sim-tab-group')].map(g => g.getAttribute('aria-label'));
    const last = tabs[tabs.length - 1];
    const panel = document.querySelector('.sim-mode-panel');
    return {
      tabCount: tabs.length, groups,
      panelTop: Math.round(panel.getBoundingClientRect().top + scrollY),
      panelHeight: Math.round(panel.getBoundingClientRect().height),
      lastTabKey: last?.dataset.simMode, lastTabText: last?.textContent.trim(),
      lastTabAbsTop: Math.round(last.getBoundingClientRect().top + scrollY),
      pageHeight: document.documentElement.scrollHeight, vh: innerHeight,
    };
  });
  out[`picker-open@${width}`] = pickerOpen;
  // a user scrolls the last tab into view and clicks it (real operations)
  await page.evaluate(() => document.querySelectorAll('[role="tab"][data-sim-mode]')[[...document.querySelectorAll('[role="tab"][data-sim-mode]')].length - 1].scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await page.click(`[role="tab"][data-sim-mode="${pickerOpen.lastTabKey}"]`);
  await page.waitForTimeout(600);
  const afterPick = await page.evaluate(() => ({
    currentMode: document.querySelector('.sim-current strong')?.textContent || '',
    panelPresent: !!document.querySelector('.sim-mode-panel'),
    selectedTab: document.querySelector('[role="tab"][aria-selected="true"]')?.dataset.simMode || '',
    resultText: (document.querySelector('.sim-result, .result-card, [class*="result"]')?.textContent || '').slice(0, 60),
    h1: document.querySelector('h1')?.textContent || '',
  }));
  out[`after-pick@${width}`] = afterPick;

  // --- complaint 2: from the simple simulator, go to the normal simulator
  // exactly as a first-time user would: use the main nav tab, then the
  // page's primary button, which opens the lab in a new tab. ---
  await page.click('.main-nav a[href="#lab"]');
  await page.waitForTimeout(600);
  const labPage = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent || '',
    openBtn: (() => { const a = [...document.querySelectorAll('a')].find(x => /実験室を開く/.test(x.textContent)); return a ? { text: a.textContent.trim(), href: a.getAttribute('href'), target: a.getAttribute('target') } : null; })(),
    explainsDifference: /簡易シミュレーターとは違い/.test(document.body.textContent),
  }));
  out[`lab-page@${width}`] = labPage;
  const [labTab] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 15000 }),
    page.click('a:has-text("実験室を開く")'),
  ]);
  await labTab.waitForLoadState('networkidle');
  await labTab.waitForTimeout(1200);
  const labHome = await labTab.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1')?.textContent || '',
    url: location.pathname,
    modelButtons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean).slice(0, 12),
    hasCanvas: !!document.querySelector('canvas'),
  }));
  out[`lab-home@${width}`] = labHome;
  // open the first experiment and confirm the lab actually runs it
  const firstModel = await labTab.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /加熱|冷却|フィン|放射/.test(b.textContent) && b.offsetParent !== null);
    if (btn) { btn.click(); return btn.textContent.trim(); }
    return null;
  });
  await labTab.waitForTimeout(2500);
  const labRun = await labTab.evaluate(() => {
    const canvas = document.querySelector('canvas');
    let painted = false;
    if (canvas && canvas.width > 0) {
      try {
        const c = canvas.getContext('2d');
        const d = c.getImageData(0, 0, Math.min(40, canvas.width), Math.min(40, canvas.height)).data;
        painted = [...d].some((v, i) => i % 4 !== 3 && v !== 0);
      } catch { painted = 'unreadable'; }
    }
    return { canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null, painted, h2: document.querySelector('h2')?.textContent || '' };
  });
  out[`lab-run@${width}`] = { clicked: firstModel, ...labRun };
  out[`pageerror@${width}`] = errors;
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
server.close();
