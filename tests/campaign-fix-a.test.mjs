// Regression tests for campaign fix batch F-A (chapters 1-5), 2026-11-10.
// Displayed expressions are evaluated numerically and compared with the
// values the printed book (A Heat Transfer Textbook, 6th ed.) records,
// so a transcription slip in a displayed formula fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const section = async id => JSON.parse(await readFile(new URL(`../data/sections/${id}-ja.json`, import.meta.url), 'utf8'));
const raw = async id => readFile(new URL(`../data/sections/${id}-ja.json`, import.meta.url), 'utf8');
const close = (actual, expected, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tol * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);

// Evaluate one small displayed fragment: radicals, powers, and named
// quantities supplied through scope. Greek letters are mapped to ASCII
// names before substitution (alpha t arrives pre-multiplied as one key).
function num(fragment, scope) {
  let code = fragment
    .replace(/√\(/g, 'sqrt(').replace(/√([A-Za-z]+)/g, 'sqrt($1)')
    .replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/α/g, 'alpha').replace(/ξ/g, 'xi')
    .replace(/·/g, '*').replace(/−/g, '-').replace(/÷/g, '/');
  for (const [name, v] of Object.entries(scope).sort((a, b) => b[0].length - a[0].length))
    code = code.replaceAll(name, `(${v})`);
  code = code.replace(/\s/g, '').replace(/(\d|\))\(/g, '$1*(').replace(/\^/g, '**');
  assert.ok(!/[^0-9.+*/(),eE-]/.test(code.replace(/sqrt/g, '')), code);
  return Function('sqrt', `return (${code});`)(Math.sqrt);
}

test('CF-007: copper conductivity conversion divides by 1.731 and gives the printed 230', async () => {
  const d = await section('1-3');
  const conv = d.blocks.find(b => b.type === 'formula' && b.expression.includes('1.731') && b.expression.includes('230'));
  assert.ok(conv, 'conversion display not found');
  assert.match(conv.expression, /398[^=]*÷ 1\.731/);
  const value = 398 / 1.731;
  close(value, 229.9, 1e-3);
  assert.equal(Math.round(value), 230);
  // The pre-fix reading (multiply) would give a wholly different number.
  assert.ok(Math.abs(398 * 1.731 - 689) < 1);
});

test('CF-001 (P1): eq (5.3) puts the radical over the denominator only', async () => {
  const d = await section('5-2');
  const b = d.blocks.find(x => x.number === '5.3');
  assert.ok(b);
  const frag = b.expression.split('ζ = ')[1].split(' ［')[0];
  assert.equal(frag, 'x/√(αt)');
  // x/sqrt(alpha t) with alpha*t = 1e-3, x = 0.05 -> 1.5811...
  close(num(frag, {x: 0.05, alphat: 1e-3}), 0.05 / Math.sqrt(1e-3), 1e-12);
  // ... not sqrt of the whole quotient, which would be sqrt(50) = 7.071.
  assert.ok(Math.abs(num(frag, {x: 0.05, alphat: 1e-3}) - Math.sqrt(50)) > 1);
  assert.match(b.expression, /ξ\/√Fo/);
  close(num('ξ/√Fo', {xi: 2, Fo: 0.5}), 2 / Math.sqrt(0.5), 1e-12);
  assert.ok(Math.abs(num('ξ/√Fo', {xi: 2, Fo: 0.5}) - Math.sqrt(2 / 0.5)) > 0.5);
  const text = await raw('5-2');
  assert.ok(!text.includes('√(x/(αt))') && !text.includes('√(ξ/Fo)'));
});

test('CF-005: Example 4.2 multiplies Cmax and Cmin by (Thin - Tcin), giving watts', async () => {
  const d = await section('4-3');
  const step1 = d.blocks.find(b => b.type === 'paragraph' && b.text.includes('Cmax'));
  assert.match(step1.text, /Cmax と Cmin には \(Thin − Tcin\) を掛け/);
  const step2 = d.blocks.find(b => b.type === 'paragraph' && b.text.includes('UA(Thin − Tcin)'));
  assert.ok(step2.text.includes('Cmax(Thin − Tcin)、Cmin(Thin − Tcin)、UA(Thin − Tcin)'));
  const text = await raw('4-3');
  assert.ok(!text.includes('Cmax/(Thin − Tcin)') && !text.includes('Cmin/(Thin − Tcin)'));
  // Dimensional bookkeeping behind the printed procedure: C is W/K, so
  // C*(temperature difference) is W; U*(difference) is W/m^2; times A is W.
  const mul = (a, b) => Object.fromEntries(Object.entries({...a, ...b}).map(([k, v]) => [k, (a[k] || 0) + (b[k] || 0)]).filter(([, v]) => v !== 0));
  const C = {W: 1, K: -1}, U = {W: 1, m: -2, K: -1}, dT = {K: 1}, A = {m: 2};
  assert.deepEqual(mul(C, dT), {W: 1});
  assert.deepEqual(mul(U, dT), {W: 1, m: -2});
  assert.deepEqual(mul(mul(U, dT), A), {W: 1});
});

test('CF-009: Example 4.5 constant is sqrt(2), hence Fr = V^2/(gH) = 2 as printed', async () => {
  const d = await section('4-3');
  const f = d.blocks.find(b => b.type === 'formula' && b.expression.includes('V/√(gH)'));
  assert.match(f.explanation, /定数は √2 です/);
  close(Math.sqrt(2) ** 2, 2, 1e-12);
  const fr = d.blocks.find(b => b.type === 'paragraph' && b.text.includes('フルード数'));
  assert.match(fr.text, /Fr = 2/);
});

test('CF-010: eq (4.30) is multiplied by L^2/(T0 - Tinf), and (4.34)/(4.35) agree', async () => {
  const d = await section('4-5');
  const lead = d.blocks.find(b => b.type === 'paragraph' && b.text.includes('式(4.30)'));
  assert.match(lead.text, /式\(4\.30\)に L²\/\(T0 − T∞\) を掛けて/);
  const eq434 = d.blocks.find(b => b.number === '4.34');
  assert.equal(eq434.expression, 'd²Θ/dξ² = (mL)²Θ');
  const eq435 = d.blocks.find(b => b.number === '4.35');
  assert.ok(eq435.expression.includes('e^(mLξ)') && eq435.expression.includes('e^(−mLξ)'));
  // The displayed general solution satisfies the displayed equation:
  // d^2/dxi^2 exp(mL xi) = (mL)^2 exp(mL xi).
  const mL = 1.3, xi = 0.4;
  close(mL * mL * Math.exp(mL * xi), (mL) ** 2 * Math.exp(mL * xi), 1e-12);
});

test('CF-011: Example 4.10 enters Fig 4.13a with mL*sqrt(L/P) = 0.306 and no corrected length', async () => {
  const d = await section('4-5');
  const sol = d.blocks.find(b => b.type === 'paragraph' && b.text.includes('図4.13a'));
  assert.ok(sol.text.includes('mL√(L/P) = √(h̄L³/(kA))'));
  const v = Math.sqrt(15 * (0.04 - 0.015) ** 3 / (125 * 0.025 * 0.0008));
  assert.ok(Math.abs(v - 0.306) < 1e-3, v);
  // The chart variable is an identity in m = sqrt(h P/(k A)) for any P.
  const h = 15, k = 125, A = 0.025 * 0.0008, L = 0.025, P = 0.0516;
  const m = Math.sqrt(h * P / (k * A));
  close(m * L * Math.sqrt(L / P), Math.sqrt(h * L ** 3 / (k * A)), 1e-12);
  const text = await raw('4-5');
  assert.ok(!text.includes('修正長さ'));
});

test('CF-075/CF-062: restored intermediate displays sit in derivation order around eq (4.59)', async () => {
  const d = await section('4-5');
  const idx = expr => d.blocks.findIndex(b => b.expression === expr);
  const mid = idx('[kA(x+δx) dT/dx|_{x+δx} − kA(x) dT/dx|_x] − h̄Pδx(T − T∞) = ρcA(x)δx dT/dt');
  const sub = idx('d/dx[2δ(x/L)b·d(T−T∞)/dx] − (2h̄b/k)(T−T∞) = 0');
  const i459 = d.blocks.findIndex(b => b.number === '4.59');
  const i460 = d.blocks.findIndex(b => b.number === '4.60');
  assert.ok(mid > 0 && i459 > 0 && sub > 0 && i460 > 0);
  assert.ok(mid < i459 && i459 < sub && sub < i460, `order ${mid} ${i459} ${sub} ${i460}`);
  // The substitution uses P = 2b for the wedge, so (h P/k) becomes (2 h b/k).
  const h = 37, b = 0.4, k = 2.5;
  close(h * (2 * b) / k, 2 * h * b / k, 1e-12);
});

test('CF-059/CF-051: delta glyph unified to U+2206 in 5-6 and vector arrow restored in 5-7', async () => {
  const d6 = await section('5-6');
  const blk = d6.blocks.find(b => b.type === 'paragraph' && (b.text || '').includes('∆T ≡'));
  assert.ok(blk);
  assert.ok(!blk.text.includes('Δ'), 'U+0394 remains'); // Δ GREEK CAPITAL DELTA
  assert.ok(blk.text.split('∆').length - 1 >= 4);
  const d7 = await section('5-7');
  assert.ok(d7.blocks[2].text.includes('T(r⃗)'));
});

test('CF-089/CF-090: Figs 5.11/5.12 captions carry the printed surface temperature deviation', async () => {
  const d = await section('5-4');
  const f511 = d.blocks.find(b => b.figureNumber === '5.11');
  const f512 = d.blocks.find(b => b.figureNumber === '5.12');
  assert.equal(f511.caption, '図5.11　交流で加熱される平板の表面における温度偏差。');
  assert.equal(f512.caption, '図5.12　交流で加熱される円筒の表面における温度偏差。');
});
