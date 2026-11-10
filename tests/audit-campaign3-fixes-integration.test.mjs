import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const section = async (id) => JSON.parse(await readFile(new URL(`../data/sections/${id}-ja.json`, import.meta.url), 'utf8'));
test('C03-02: section 4.5 balance explanation carries the underbrace approximation step', async () => {
  const s = await section('4-5');
  assert.ok(s.blocks[88].explanation.includes('≃ d/dx(kA(x)dT/dx)·δx'), s.blocks[88].explanation);
});
test('C06-13: Example 7.7 wall resistance uses the printed R_twall form (no comma)', async () => {
  const s = await section('7-5');
  assert.ok(s.blocks[9].text.includes('Rtwall'));
  assert.ok(!s.blocks[9].text.includes('Rt,wall'));
  assert.ok(!s.blocks[9].text.includes('R_t,wall'));
});
test('R8-2-01/02: mu_m uses U+03BC and glossary Maxwell-Stefan uses Đ (U+0110)', async () => {
  const s = await section('11-10');
  const t = JSON.stringify([s.blocks[45], s.blocks[48]]);
  assert.ok(!t.includes('µ'), 'U+00B5 remains in mu_m blocks');
  assert.ok(t.includes('μm'));
  const g = JSON.parse(await readFile(new URL('../data/glossary.json', import.meta.url), 'utf8'));
  assert.ok(!JSON.stringify(g).includes('Ð'));
  assert.ok(JSON.stringify(g[234] ?? g).includes('Đ_ij') || JSON.stringify(g).includes('Đ'));
});
test('R8-2-03/04/05: lessons time-constant uses bold italic T, transmissivity uses tau', async () => {
  const les = JSON.parse(await readFile(new URL('../data/original-deep-lessons.json', import.meta.url), 'utf8'));
  for (const i of [2, 19, 20]) assert.ok(!JSON.stringify(les.lessons[i]).includes('𝒯'), `lesson ${i}`);
  assert.ok(JSON.stringify(les.lessons[20]).includes('𝑻'));
  assert.ok(!JSON.stringify(les.lessons[63]).includes('𝒯'));
  assert.ok(JSON.stringify(les.lessons[63]).includes('τ=e'));
  const qs = JSON.parse(await readFile(new URL('../data/questions.json', import.meta.url), 'utf8'));
  const arr = qs.questions ?? qs;
  for (const i of [412, 413, 414]) assert.ok(!JSON.stringify(arr[i]).includes('𝒯'), `question ${i}`);
});
test('R8-2-06/07: figure descriptions carry quantitative labels; book.json section titles match headings', async () => {
  const s73 = await section('7-3');
  assert.ok(s73.blocks[10].description.includes('3.66'));
  const s1110 = await section('11-10');
  assert.ok(s1110.blocks[35].description.includes('𝒟₁₂'));
  assert.ok(s1110.blocks[38].description.includes('n-ヘプタン'));
  const book = JSON.parse(await readFile(new URL('../data/book.json', import.meta.url), 'utf8'));
  const raw = JSON.stringify(book);
  assert.ok(raw.includes('平板表面上の層流・非圧縮性境界層'));
  assert.ok(!raw.includes('平板上の非圧縮性層流境界層'));
});
