// Browser verification for the glossary flashcard mode (単語帳) and term
// bookmarks, run against the built public distribution. Not part of the
// Node suite: run with `node tests/flashcards-browser.mjs` after
// `npm run build:public`. WebKit is not run (it cannot launch in this
// environment); Chromium only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../scripts/serve.mjs';

const require = createRequire(import.meta.url);
const engines = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const glossary = JSON.parse(await readFile(new URL('../data/glossary.json', import.meta.url), 'utf8'));
const root = join(dirname(fileURLToPath(import.meta.url)), '../dist');
const server = await startServer({ root, port: 0 });
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
try {
  browser = await engines.chromium.launch({ headless: true, ...(existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  page.on('pageerror', error => errors.push(error.message));
  const storedState = () => page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('heat-study-ja:') && !k.includes('profiles') && !k.includes('active'));
    return JSON.parse(localStorage.getItem(key));
  });
  const progress = () => page.locator('.flash-count').innerText();
  const frontName = () => page.locator('.flash-front h2').innerText();

  await page.goto(base + '/#glossary');
  await page.locator('.term-row').first().waitFor();

  // 1. Term bookmark from the list view persists across reload.
  const firstRow = page.locator('.term-row').first();
  const firstId = await firstRow.getAttribute('id');
  await firstRow.locator('[data-term-bookmark]').click();
  await page.waitForFunction(id => document.querySelector(`#${id} [data-term-bookmark]`)?.textContent === '★', firstId);
  let saved = await storedState();
  assert.equal(saved.termBookmarks.length, 1, 'one term bookmark stored');
  const bookmarkedId = saved.termBookmarks[0];
  assert.equal(firstId, `term-${bookmarkedId}`);
  await page.reload();
  await page.locator('.term-row').first().waitFor();
  assert.equal(await page.locator(`#term-${bookmarkedId} [data-term-bookmark]`).innerText(), '★', 'bookmark survives reload');

  // 2. Flashcard mode: front, flip to back, flip back via the nav button.
  await page.locator('[data-action="glossary-mode"][data-mode="cards"]').click();
  await page.locator('.flash-card').waitFor();
  assert.equal(await progress(), `1 / ${glossary.length}`);
  const firstCardName = await frontName();
  assert.ok(firstCardName.length > 0);
  await page.locator('.flash-face').click();
  await page.locator('.flash-back').waitFor();
  assert.ok((await page.locator('.flash-brief').innerText()).length > 0, 'back shows the summary first');
  await page.locator('.flash-nav [data-action="flash-flip"]').click();
  await page.locator('.flash-front').waitFor();

  // 3. Position persists across reload (mode, index).
  await page.locator('[data-action="flash-next"]').click();
  await page.locator('[data-action="flash-next"]').click();
  assert.equal(await progress(), `3 / ${glossary.length}`);
  await page.reload();
  await page.locator('.flash-card').waitFor();
  assert.equal(await progress(), `3 / ${glossary.length}`, 'position restored after reload');

  // 4. Keyboard: arrows move, Space flips.
  await page.locator('.flash-face').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await progress(), `4 / ${glossary.length}`);
  await page.keyboard.press(' ');
  await page.locator('.flash-back').waitFor();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await progress(), `3 / ${glossary.length}`);
  await page.locator('.flash-front').waitFor();

  // 5. Kana sort: first card is the kana-smallest term; position resets.
  await page.locator('select[name="flash-sort"]').selectOption('kana');
  assert.equal(await progress(), `1 / ${glossary.length}`);
  const expectedKanaFirst = [...glossary].sort((a, b) => a.ja.localeCompare(b.ja, 'ja') || a.id.localeCompare(b.id))[0];
  assert.equal(await frontName(), expectedKanaFirst.ja, 'kana sort starts at the expected term');
  await page.locator('select[name="flash-sort"]').selectOption('default');
  assert.equal(await frontName(), firstCardName, 'default sort restores registration order');

  // 6. Chapter filter narrows the deck to the expected count.
  const inChapter = (term, ch) => {
    const parts = v => { const m = /^(\d+)\.(\d+)$/.exec(String(v ?? '')); return m ? Number(m[1]) : null; };
    if (parts(term.source?.section) === ch) return true;
    return (term.relatedSections || []).some(s => parts(s) === ch);
  };
  const expectedCh7 = glossary.filter(t => inChapter(t, 7)).length;
  await page.locator('select[name="flash-chapter"]').selectOption('7');
  assert.equal(await progress(), `1 / ${expectedCh7}`, 'chapter filter count matches the data');
  await page.locator('select[name="flash-chapter"]').selectOption('all');

  // 7. Back-first: current card reopens on its back and stays so after reload.
  await page.locator('input[name="flash-back-first"]').check();
  await page.locator('.flash-back').waitFor();
  await page.reload();
  await page.locator('.flash-card').waitFor();
  await page.locator('.flash-back').waitFor();
  saved = await storedState();
  assert.equal(saved.flashcards.backFirst, true);
  await page.locator('input[name="flash-back-first"]').uncheck();
  await page.locator('.flash-front').waitFor();

  // 8. Shuffle: a full permutation is stored and the same card returns after reload.
  await page.locator('[data-action="flash-shuffle"]').click();
  await page.waitForFunction(() => document.querySelector('.flash-count')?.textContent.startsWith('1 /'));
  saved = await storedState();
  assert.ok(Array.isArray(saved.flashcards.order), 'shuffled order stored');
  assert.deepEqual([...saved.flashcards.order].sort(), glossary.map(t => t.id).sort(), 'order is a permutation of all terms');
  assert.notDeepEqual(saved.flashcards.order, glossary.map(t => t.id), 'order actually changed');
  const shuffledFirst = await frontName();
  await page.reload();
  await page.locator('.flash-card').waitFor();
  assert.equal(await frontName(), shuffledFirst, 'shuffled deck restored after reload');
  await page.locator('[data-action="flash-reset-order"]').click();
  assert.equal(await frontName(), firstCardName);

  // 9. Bookmarks-only deck: one card, then un-bookmarking empties it safely.
  await page.locator('select[name="flash-scope"]').selectOption('bookmarks');
  assert.equal(await progress(), '1 / 1');
  const bookmarkedTerm = glossary.find(t => t.id === bookmarkedId);
  assert.equal(await frontName(), bookmarkedTerm.ja);
  await page.locator('.flash-card [data-term-bookmark]').click();
  await page.locator('.empty-state').waitFor();
  assert.match(await page.locator('.empty-state h3').innerText(), /ブックマークした用語がありません/);
  saved = await storedState();
  assert.deepEqual(saved.termBookmarks, []);
  await page.locator('[data-action="flash-scope-all"]').click();
  await page.locator('.flash-card').waitFor();
  assert.equal(await progress(), `1 / ${glossary.length}`, 'scope reset returns the full deck');

  // 10. Layout matrix: no horizontal overflow, no clipped card text.
  for (const width of [375, 390, 1280, 1920]) {
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(350);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, `no horizontal overflow at ${width}px ${scheme} (got ${overflow})`);
      const clipped = await page.evaluate(() => {
        const bad = [];
        for (const el of document.querySelectorAll('.flash-front h2,.flash-secondary,.flash-meta')) {
          if (el.scrollWidth > el.clientWidth + 1) bad.push(el.className);
        }
        return bad;
      });
      assert.deepEqual(clipped, [], `no clipped card text at ${width}px ${scheme}`);
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
  console.log('flashcards-browser: all checks passed');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
