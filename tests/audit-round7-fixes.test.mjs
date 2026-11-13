// Muse round 7 fixes (2026-11-10): the ch.11 script-G (U+1D4A2) restorations were
// over-applications. At 600 dpi the book's mass-transfer coefficient and the fg
// subscript are lowercase italic g with a descender (eqs. (11.67e), (11.79c),
// (11.80), (11.99) verified against genuinely script D on the same pages).
// Also: Problem 6.20's answer hint approx symbol is U+2245 in print (PDF 353).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SCRIPT_G = '\u{1D4A2}';

test('round7: no script-G remains in chapter 11 data', () => {
  for (const p of [
    'data/sections/11-6-ja.json',
    'data/sections/11-7-ja.json',
    'data/sections/11-8-ja.json',
    'data/sections/11-9-ja.json',
    'data/sections/11-10-ja.json',
    'data/chapter-problems/chapter-11.json',
  ]) {
    assert.ok(!read(p).includes(SCRIPT_G), `${p} still contains script-G`);
  }
  // The lessons file also holds ch. 8, whose effective gravity 𝒢_eff /
  // 𝒢_e IS genuinely script in print (eqs. (8.63)/(8.69), 600dpi,
  // PDF 463/466 — round 8), so the scan is scoped to the ch. 11 lessons.
  const lessons = JSON.parse(read('data/original-deep-lessons.json'));
  const list = Array.isArray(lessons) ? lessons : lessons.lessons;
  for (const lesson of list.filter((l) => String(l.sectionId).startsWith('11'))) {
    assert.ok(!JSON.stringify(lesson).includes(SCRIPT_G), `lesson ${lesson.sectionId} still contains script-G`);
  }
});

test('round7: section 11.6 uses plain gm,i for the mass-transfer coefficient', () => {
  const t = read('data/sections/11-6-ja.json');
  assert.ok(t.includes('gm,i'), 'gm,i missing from 11-6');
});

test('round7: latent-heat symbol is plain hfg/hf g form in 11.7 (no script subscript)', () => {
  const t = read('data/sections/11-7-ja.json');
  assert.ok(!t.includes(`hf${SCRIPT_G}`) && !t.includes(`f${SCRIPT_G}`), 'script fg remains in 11-7');
});

test('round7: problem 6.20 answer hint uses U+2245', () => {
  const d = JSON.parse(read('data/chapter-problems/chapter-06.json'));
  const walk = (o, num = null) => {
    if (o && typeof o === 'object') {
      num = o.number ?? num;
      for (const v of Object.values(o)) {
        if (typeof v === 'string' && num === '6.20' && v.includes('0.003 m/s')) return v;
        const r = walk(v, num);
        if (r) return r;
      }
    }
    return null;
  };
  const hint = walk(d);
  assert.ok(hint && hint.includes('≅'), `6.20 hint not fixed: ${hint}`);
});
