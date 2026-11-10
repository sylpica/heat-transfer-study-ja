import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const section = async id => (await read(`data/sections/${id}-ja.json`)).blocks;
const problems = async ch => (await read(`data/chapter-problems/chapter-${ch}.json`)).problems.blocks;
const formula = (blocks, number) => blocks.find(b => b.type === 'formula' && b.number === number);
const MACRON = '̄';

test('CF2-003/C07-25: eq. (8.26) is the single-fraction print form and its members agree numerically', async () => {
  const blocks = await section('8-3');
  const eq = formula(blocks, '8.26');
  assert.ok(eq, 'eq. (8.26) block exists');
  assert.ok(eq.expression.startsWith('Nux ≡ qx/(ΔTk) = 2x/δ'), eq.expression);
  assert.ok(!eq.expression.includes('(qx/∆T)(x/k)'), 'extra-factor form is gone');
  assert.ok(eq.expression.includes('(2/3.936)'), 'intermediate coefficient stays the fraction 2/3.936 (C07-26)');
  // Numeric identity of the three displayed members, Pr = 0.7, Grx = 1e8:
  const Pr = 0.7, Grx = 1e8;
  const member2 = (2 / 3.936) * (Pr * Grx) ** 0.25 * (Pr / (0.952 + Pr)) ** 0.25;
  const member3 = 0.508 * (Pr * Grx) ** 0.25 * (Pr / (0.952 + Pr)) ** 0.25;
  assert.ok(Math.abs(member2 / member3 - 1) < 1e-3, `2/3.936 vs 0.508: ${member2} vs ${member3}`);
  // With eq. (8.24), 2x/δ must reproduce the same value:
  const dx = 3.936 * ((0.952 + Pr) / Pr ** 2) ** 0.25 * Grx ** -0.25;
  assert.ok(Math.abs(2 / dx / member3 - 1) < 1e-3, `2x/δ = ${2 / dx} vs ${member3}`);
});

test('CF2-002/C07-08: Problem 7.1 carries R² in text and expression, and the identity holds', async () => {
  const blocks = await problems('07');
  const p = blocks.find(b => b.id === 'problem-7-1');
  assert.ok(p.text.includes('(−dp/dx)R²/(4µ)'), p.text);
  assert.ok(p.formulaBlocks[0].expression.includes('(−dp/dx)R²/(4µ)'), p.formulaBlocks[0].expression);
  // Poiseuille: u_av = R²(−dp/dx)/(8μ), so (−dp/dx)R²/(4μ) = 2·u_av exactly; the R¹ form does not.
  const R = 0.01, mu = 1e-3, dpdx = 100;
  const uav = R ** 2 * dpdx / (8 * mu);
  assert.ok(Math.abs(dpdx * R ** 2 / (4 * mu) - 2 * uav) < 1e-12);
  assert.ok(Math.abs(dpdx * R / (4 * mu) - 2 * uav) > 1e-6, 'dropped-exponent form must not satisfy the identity');
});

test('CF2-045/C05-13+C05-15: eqs. (6.9) and (6.30) exist as displayed blocks and (6.30) forms agree', async () => {
  const blocks = await section('6-2');
  const e69 = formula(blocks, '6.9');
  assert.ok(e69, 'eq. (6.9) display restored');
  assert.ok(e69.expression.includes('dψ = (∂ψ/∂x)|_y dx + (∂ψ/∂y)|_x dy = 0'), e69.expression);
  const e630 = formula(blocks, '6.30');
  assert.ok(e630, 'eq. (6.30) display restored');
  assert.ok(e630.expression.includes('−d/dx [δ(39/280)] = −ν/(u∞δ) · (3/2)'), e630.expression);
  // The print "or" form −(39/280)(2/3)(1/2) dδ²/dx = −ν/u∞ must give the same δ·dδ/dx:
  const fromMain = (3 / 2) * (280 / 39); // δ dδ/dx in units of ν/u∞
  const fromOr = 0.5 * (280 / 39) * 3;
  assert.ok(Math.abs(fromMain - fromOr) < 1e-12, `${fromMain} vs ${fromOr}`);
});

test('CF2-050/C05-16+C05-17: eq. (6.24) upper limit δ(x) and eq. (6.25) x-dependence restored', async () => {
  const blocks = await section('6-2');
  assert.ok(formula(blocks, '6.24').expression.includes('∫₀^δ(x)'), formula(blocks, '6.24').expression);
  const e625 = formula(blocks, '6.25').expression;
  assert.ok(e625.includes('−τ_w(x)/(ρu∞²) ≡ −(1/2)C_f(x)'), e625);
});

test('CF2-016/C07-63: Problem 8.15 second plotted quantity is the linearised density difference itself', async () => {
  const blocks = await problems('08');
  const p = blocks.find(b => b.id === 'problem-8-15');
  assert.ok(p.text.includes('|−ρ_f β_f (T_w − T_∞)|'), p.text);
  assert.ok(!p.text.includes('|ρ_∞ − ρ_f β_f'), 'inserted ρ_∞ − is gone');
});

test('C07-53: eq. (8.65) full fraction form is present and evaluates to ge·cos θ', async () => {
  const blocks = await section('8-5');
  const ex87 = blocks.find(b => b.type === 'paragraph' && b.text.startsWith('例題8.7'));
  assert.ok(ex87.text.includes('[x·ge^(4/3)(cos θ)^(4/3)]/[ge^(1/3)(cos θ)^(1/3)∫₀^x dx]'), ex87.text);
  const ge = 9.8, th = Math.PI / 6, x = 0.5;
  const full = (x * ge ** (4 / 3) * Math.cos(th) ** (4 / 3)) / (ge ** (1 / 3) * Math.cos(th) ** (1 / 3) * x); // ∫₀^x dx = x
  assert.ok(Math.abs(full - ge * Math.cos(th)) < 1e-9, `${full} vs ${ge * Math.cos(th)}`);
});

test('C07-47+C07-48: Example 8.5 substitution displays are present and evaluate to 144 K and 131 K', async () => {
  const blocks = await section('8-4');
  const ex85 = blocks.find(b => b.type === 'paragraph' && b.text.startsWith('例題8.5'));
  assert.ok(ex85.text.includes('((1.18)(661)(0.17)/0.02623)'), 'first-pass substitution present');
  assert.ok(ex85.text.includes('((1.18)(577)(0.17)/0.03136)'), 'corrected-pass substitution present');
  const first = ((1.18 * 661 * 0.17) / 0.02623) / ((9.8 * 661 * 0.17 ** 4 / (300 * 0.02623 * 1.578 * 2.213e-10)) ** (1 / 6) * 0.713 ** 0.028);
  assert.ok(Math.abs(first - 144) < 1, `first pass ΔT̄ = ${first}`);
  const corrected = ((1.18 * 577 * 0.17) / 0.03136) / ((9.8 * 577 * 0.17 ** 4 / (372 * 0.03136 * 2.315 * 3.281e-10)) ** (1 / 6) * 0.706 ** 0.028);
  assert.ok(Math.abs(corrected - 131) < 1, `corrected ΔT̄ = ${corrected}`);
});

test('C07-20..24: §8.3 intermediate displays restored; the 1/30 integral value checks out', async () => {
  const blocks = await section('8-3');
  const e820 = formula(blocks, '8.20');
  assert.ok(e820.explanation.includes('dδ⁴/dx = 84(1/3 − C1)(C1² gβ(Tw − T∞)/ν²)^(−1)'), 'intermediate dδ⁴/dx line');
  const e822 = formula(blocks, '8.22');
  assert.ok(e822.explanation.includes('(d/dx)[δ³∫₀¹(y/δ)(1 − y/δ)⁴ d(y/δ)]'), 'substitution display (C07-21)');
  assert.ok(e822.explanation.includes('3(C1/30)δ³ dδ/dx = (C1/40)dδ⁴/dx = 2(Pr gβ(Tw − T∞)/ν²)^(−1)'), 'reduction line (C07-22)');
  const e824 = formula(blocks, '8.24');
  assert.ok(e824.explanation.includes('δ⁴ = 240(20/21 + Pr)(Pr² gβ(Tw − T∞)/ν²)^(−1) x'), 'intermediate δ⁴ form (C07-23)');
  assert.ok(e824.explanation.includes('[d((T − T∞)/(Tw − T∞))/d(y/δ)]_{y/δ=0}'), 'eq. (8.25) middle member (C07-24)');
  // ∫₀¹ η(1−η)⁴ dη = B(2,5) = 1/30, by Simpson quadrature:
  const f = t => t * (1 - t) ** 4;
  const n = 2000, h = 1 / n;
  let sum = f(0) + f(1);
  for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * f(i * h);
  assert.ok(Math.abs(sum * h / 3 - 1 / 30) < 1e-9, `integral = ${sum * h / 3}`);
});

test('CF2-033: chapter-problem macrons restored per instance; unbarred locals stay unbarred', async () => {
  const ch06 = await read('data/chapter-problems/chapter-06.json');
  assert.equal(JSON.stringify(ch06).split(MACRON).length - 1, 11, 'chapter-06 macron count');
  const ch08 = await problems('08');
  const p845 = ch08.find(b => b.id === 'problem-8-45');
  assert.ok(p845.items[0].includes('h' + MACRON + '_o ≡ h' + MACRON + '(T = T_o)'), p845.items[0]);
  const p846 = ch08.find(b => b.id === 'problem-8-46');
  assert.ok(p846.text.includes('ℱ = 1'), 'script ℱ restored (CF2-038)');
  const ch06b = await problems('06');
  const p616 = ch06b.find(b => b.id === 'problem-6-16');
  assert.ok(p616.items[1].includes('h' + MACRON), 'problem 6.16(b) mean h barred');
  assert.ok(!p616.items[2].includes(MACRON) && !p616.items[3].includes(MACRON), 'problem 6.16(c)(d) local h stays unbarred');
});

test('CF2-040: no U+00B5 remains in chapter-6 section files; CF2-041: no U+2206 remains in 8-4', async () => {
  for (const id of ['6-1', '6-2', '6-3', '6-4', '6-5', '6-6', '6-7', '6-8', '6-9']) {
    const raw = await readFile(new URL(`../data/sections/${id}-ja.json`, import.meta.url), 'utf8');
    assert.ok(!raw.includes('µ'), `${id} still contains U+00B5`);
  }
  const raw84 = await readFile(new URL('../data/sections/8-4-ja.json', import.meta.url), 'utf8');
  assert.ok(!raw84.includes('∆'), '8-4 still contains U+2206');
});

test('C07-50: footnote 8 restored with marker at the Dhir citation; CF2-086: eq. (8.72) opens with =', async () => {
  const blocks = await section('8-5');
  const fn8 = blocks.find(b => b.type === 'footnote' && b.text.startsWith('脚注8'));
  assert.ok(fn8 && fn8.text.includes('再計算'), 'footnote 8 block present');
  const e848 = formula(blocks, '8.48');
  assert.ok(e848.explanation.includes('ディア（Dhir）(脚注8)[8.30]'), 'marker at Dhir citation');
  const e872 = formula(blocks, '8.72');
  assert.ok(e872.expression.startsWith('Rec = ρuavδ/μ'), e872.expression);
});

test('CF2-012/C07-35-class + CF2-014/C07-46: §8.4 proportionality and §8.5 annotation attribution', async () => {
  const b84 = await section('8-4');
  const rich = b84.find(b => b.type === 'paragraph' && b.text.includes('リッチ（Rich）'));
  assert.ok(rich.text.includes('NuL と RaL^(1/3) はどちらも L に比例'), rich.text.slice(-200));
  const b85 = await section('8-5');
  const e859 = formula(b85, '8.59');
  assert.ok(e859.explanation.includes('Π4 が明らかに支配的な変数であり、Ja の影響は h′fg に陰に運ばれ、Pr はエネルギー方程式の対流項を無視した限りにおいて消去されます'), 'attribution fixed');
});
