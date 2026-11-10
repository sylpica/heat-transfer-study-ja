import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async (path) => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const readText = async (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

const SCRIPT_D = '\u{1D49F}'; // 𝒟
const SCRIPT_F = '\u2131'; // ℱ
const PLIMSOLL = '\u29B5'; // ⦵
const CONG = '\u2245'; // ≅
const NAS = '\u224A'; // ≊

// CF-072: deep lesson for §7.2 must carry the book form of eq. (7.29),
// Nu_D = 3.657/tanh[...] + 0.0499 Gz tanh(Gz^-1), which evaluates to the
// recorded 4.27 at the book example's Gz = 11.8 (precisely 4.26588...;
// the previous mis-grouped form gives 4.27349...).
test('CF-072 deep lesson eq. (7.29) has the book grouping and value', async () => {
  const deep = await read('data/original-deep-lessons.json');
  const lesson = deep.lessons.find((l) => l.sectionId === '7.2');
  const eq = lesson.equations.find((e) => e.label.includes('(7.29)'));
  assert.equal(
    eq.expression,
    'Nū_D=3.657/tanh[2.264 Gz^(−1/3)+1.7 Gz^(−2/3)]+0.0499 Gz tanh(Gz^(−1))',
  );
  const Gz = 11.8;
  const den = Math.tanh(2.264 * Gz ** (-1 / 3) + 1.7 * Gz ** (-2 / 3));
  const value = 3.657 / den + 0.0499 * Gz * Math.tanh(1 / Gz);
  assert.ok(Math.abs(value - 4.26588) < 1e-4, `corrected form = ${value}`);
  assert.equal(Math.round(value * 100) / 100, 4.27);
});

// CF-015: the Lewis-relation derivation in §11.7 must divide the first
// expression by the second, giving [h_bar/(g_bar_m,i cp)] [D_H2O,air/alpha]
// = (Pr/Sc)^b. Numerically the quotient of the two analogy expressions
// (h_bar D/k) / (g_bar_m,i D/(rho D)) must equal that product form.
test('CF-015 §11.7 Lewis derivation direction and fraction attribution', async () => {
  const sec = await read('data/sections/11-7-ja.json');
  const text = sec.blocks[4].text;
  assert.ok(text.includes('第1の表式を第2の表式で割ることで'));
  assert.ok(text.includes(`[h̄/(ḡm,i·cp)]·[${SCRIPT_D}H2O,air/α] = (Pr/Sc)^b`));
  const h = 8.0, g = 0.01, rho = 1.2, Dc = 2.6e-5, k = 0.026, cp = 1005.0, D = 0.05;
  const alpha = k / (rho * cp);
  const quotient = (h * D / k) / (g * D / (rho * Dc));
  const product = (h / (g * cp)) * (Dc / alpha);
  assert.ok(Math.abs(quotient - product) < 1e-9, `${quotient} != ${product}`);
  // eq. (11.73) approximation sign is the book's ≅, not ≊
  assert.ok(sec.blocks[10].expression.includes(`Le^(1−b) ${CONG} Le^(2/3)`));
});

// ℱ adjudication: every transfer factor in §10.4 is the script ℱ (U+2131);
// no F + combining macron (U+0304) remains in the file.
test('ℱ adjudication in §10.4: 22 script-F, zero F-macron', async () => {
  const raw = await readText('data/sections/10-4-ja.json');
  assert.equal([...raw.matchAll(new RegExp(SCRIPT_F, 'g'))].length, 22);
  assert.ok(!raw.includes('F\u0304'));
  const sec101 = await read('data/sections/10-1-ja.json');
  assert.ok(sec101.blocks[8].expression.includes(`${SCRIPT_F}1–2`));
});

// CF-058: standard-state symbol in §11.11 is ⦵ (U+29B5) for mu_i and x_i;
// the white circle U+25E6 no longer appears.
test('CF-058 §11.11 standard-state symbol is U+29B5', async () => {
  const raw = await readText('data/sections/11-11-ja.json');
  assert.equal([...raw.matchAll(new RegExp(PLIMSOLL, 'g'))].length, 4);
  assert.ok(!raw.includes('\u25E6'));
});

// CF-046 class guard: no ≊ (U+224A) remains in the ch. 10-11 section files
// handled by this batch (the PDF text layer maps the printed ≅ to ≊, which
// is how the wrong codepoint entered the data).
test('CF-046 no U+224A remains in batch-C section files', async () => {
  for (const f of ['10-2', '10-4', '10-5', '11-2', '11-4', '11-5', '11-7', '11-8', '11-10']) {
    const raw = await readText(`data/sections/${f}-ja.json`);
    assert.ok(!raw.includes(NAS), `${f} still contains U+224A`);
  }
});

// CF-060/CF-070 structural insertions keep their required neighbours.
test('CF-060 eq. (6.37) display follows eq. (11.43); CF-070 eq. (11.58) restored', async () => {
  const s114 = await read('data/sections/11-4-ja.json');
  const i1143 = s114.blocks.findIndex((b) => b.number === '11.43');
  assert.ok(i1143 >= 0);
  assert.equal(s114.blocks[i1143 + 1].number, '6.37');
  assert.ok(s114.blocks[i1143 + 1].expression.includes('−∇·q⃗ + q̇'));
  const s115 = await read('data/sections/11-5-ja.json');
  const i1158 = s115.blocks.findIndex((b) => b.number === '11.58');
  assert.ok(i1158 >= 0);
  assert.ok(s115.blocks[i1158].expression.includes(`ln[(1 − m2,L)/(1 − m2,0)]`));
  assert.ok(s115.blocks[i1158 - 1].expression.includes('dm2/(1 − m2)'));
  // CF-065 middle form of eq. (11.51)
  const eq1151 = s115.blocks.find((b) => b.number === '11.51');
  assert.ok(eq1151.expression.includes('d(ρiv + ji)/dx'));
});

// CF-056: the spurious dot on n is removed from the §11.8/§11.9 lessons.
test('CF-056 no U+1E45 (n with dot above) in §11.8/§11.9 lessons', async () => {
  const deep = await read('data/original-deep-lessons.json');
  for (const id of ['11.8', '11.9']) {
    const lesson = deep.lessons.find((l) => l.sectionId === id);
    assert.ok(!JSON.stringify(lesson).includes('\u1E45'), id);
  }
});

// CF-012: §5.4 lesson reads Fig. 5.11/5.12 in the correct direction
// (larger psi -> relatively smaller surface-temperature amplitude).
test('CF-012 §5.4 lesson amplitude direction', async () => {
  const deep = await read('data/original-deep-lessons.json');
  const lesson = deep.lessons.find((l) => l.sectionId === '5.4');
  const block = lesson.blocks.find((b) => (b.text || '').includes('振動幅'));
  assert.ok(block.text.includes('表面温度の振動幅は相対的に小さくなる'));
});
