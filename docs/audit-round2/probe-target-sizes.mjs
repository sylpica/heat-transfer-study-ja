// Audit round 2 probe (R1-P3-04): enumerate visible interactive targets
// smaller than 24x24 CSS px (WCAG 2.2 SC 2.5.8) on the main routes of the
// public build, and classify each by the exception that may apply:
//   - inline: inside a sentence / block of text (line-height constrained)
//   - ua-control: native checkbox/radio/range whose size the author CSS
//     does not set (user-agent controlled)
//   - spacing: standalone, but 24px-diameter circles around targets do not
//     overlap any other target's circle
//   - none: no exception identified (candidate violation)
// Chromium only (WebKit cannot launch in this environment).
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

const routes = ['home', 'glossary', 'quiz', 'reader', 'search', 'guide', 'simulator', 'plan', 'calendar', 'review', 'notes', 'map', 'settings'];
const allFindings = [];
for (const width of [375, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  for (const route of routes) {
    await page.goto(`${base}#${route}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(500);
    if (route === 'glossary') {
      // expand the first term row so its in-body controls are laid out too
      await page.evaluate(() => document.querySelector('[data-term-toggle]')?.click());
      await page.waitForTimeout(300);
    }
    if (route === 'reader') {
      await page.evaluate(() => document.querySelector('.toc-item[data-section]')?.click());
      await page.waitForTimeout(600);
    }
    const found = await page.evaluate(() => {
      const els = [...document.querySelectorAll('a[href],button,input,select,textarea,[role="button"],[tabindex]')];
      const visible = els.filter(el => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.disabled;
      });
      const rects = visible.map(el => { const r = el.getBoundingClientRect(); return { el, x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; });
      const out = [];
      for (const t of rects) {
        if (t.w >= 24 && t.h >= 24) continue;
        const el = t.el;
        const inText = !!el.closest('p,li,figcaption,td,th,dd,dt,.book-content,.term-body');
        const tag = el.tagName.toLowerCase();
        const type = el.getAttribute('type') || '';
        const uaControl = tag === 'input' && ['checkbox', 'radio', 'range'].includes(type);
        let nearest = Infinity;
        for (const o of rects) { if (o !== t) nearest = Math.min(nearest, Math.hypot(o.cx - t.cx, o.cy - t.cy)); }
        out.push({
          tag, type, cls: (el.className && String(el.className).slice(0, 60)) || '',
          text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30),
          w: Math.round(t.w * 10) / 10, h: Math.round(t.h * 10) / 10,
          inText, uaControl, nearestCenterPx: Math.round(nearest),
          exception: inText ? 'inline' : uaControl ? 'ua-control' : (nearest >= 24 ? 'spacing' : 'none'),
        });
      }
      return { h1: document.querySelector('h1')?.textContent || '', out };
    });
    for (const f of found.out) allFindings.push({ route, width, h1: found.h1, ...f });
    if (errors.length) console.log(`pageerror on #${route} @${width}:`, errors.join(' | '));
  }
  await page.close();
}
await browser.close();
server.close();

const byException = {};
for (const f of allFindings) byException[f.exception] = (byException[f.exception] || 0) + 1;
console.log('undersized target instances:', allFindings.length, JSON.stringify(byException));
const none = allFindings.filter(f => f.exception === 'none');
console.log('--- no-exception candidates:', none.length);
for (const f of none) console.log(JSON.stringify(f));
const uniq = new Map();
for (const f of allFindings) { const k = `${f.tag}|${f.type}|${f.cls}|${f.exception}`; if (!uniq.has(k)) uniq.set(k, f); }
console.log('--- unique classes:', uniq.size);
for (const f of uniq.values()) console.log(JSON.stringify(f));
