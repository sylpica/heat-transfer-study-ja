import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const readRaw = async path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const sec = async id => read(`data/sections/${id}-ja.json`);
const blocks = async id => (await sec(id)).blocks;
const fig = (bl, n) => bl.find(b => b.type === 'figure' && b.figureNumber === n);
const formula = (bl, n) => bl.find(b => b.type === 'formula' && b.number === n);
const SCRIPT_T = '\u{1D4AF}';
const BOLD_T = '\u{1D47B}';

// ---- Section header ranges (C3-C01-03, C02-F04/F16/F19) ----
test('C3-B headers: section ranges cover their own final blocks', async () => {
  const cases = {
    '1-3': ['11–34', '25–48'],
    '2-4': ['78–85', '92–99'],
    '3-1': ['99–107', '113–121'],
    '3-2': ['103–120', '117–134'],
  };
  for (const [id, [bp, pp]] of Object.entries(cases)) {
    const d = await sec(id);
    assert.equal(d.bookPages, bp, `${id} bookPages`);
    assert.equal(d.pdfPages, pp, `${id} pdfPages`);
  }
});

// ---- §3.1 figure order (C02-F17) ----
test('C02-F17: §3.1 figure blocks follow print order 3.1..3.7', async () => {
  const bl = await blocks('3-1');
  const order = bl.filter(b => b.type === 'figure').map(b => b.figureNumber);
  assert.deepEqual(order, ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7']);
});

// ---- Eq. (2.23) RHS brackets (C02-F05) ----
test('C02-F05: eq. (2.23) RHS carries the square bracket and subscript form', async () => {
  const eq = formula(await blocks('2-3'), '2.23');
  assert.ok(eq.expression.includes('= −k [∂/∂r (C₁ ln r + C₂)]_{r=rₒ}'), eq.expression);
});

// ---- Figure alt/description completeness (B-1) ----
test('C3-B figures: quantitative labels recorded in alt/description', async () => {
  const checks = [
    ['1-3', '1.5', ['基準', '「1」']],
    ['1-3', '1.11', ['T_o', 'k_b/h̄']],
    ['2-1', '2.5', ['δr・δθ・δz', 'r sinθδφ']],
    ['2-2', '2.7', ['T = T₁ − (T₁ − T₂)/L · x', 'Problem', 'Solution']],
    ['2-2', '2.8', ['R_t = L/(kA)', '円形の矢印']],
    ['2-3', '2.9', ['Resistor', '「A」', '「ΔV」']],
    ['2-3', '2.10', ['(T − T_i)/(T_o − T_i)', 'Configuration']],
    ['2-3', '2.12', ['ℓn(r_o/r_i)/(2πk)', '1/(2πr_o h̄)']],
    ['2-3', '2.15', ['R_{t,conv} = 1/(h̄A)', 'R_{t,rad} = 1/(h_rad A)', 'T_resistor']],
    ['2-3', '2.16', ['Interstitial heat transfer', 'Solid conduction', 'Temperature gradient']],
    ['2-3', '2.17', ['R_c = 1/h_c', 'L＋L']],
    ['2-4', '2.18', ['R₁・R₂・…・R_n', 'ΔT']],
    ['3-2', '3.14', ['P = (T_t,out − T_t,in)/(T_s,in − T_t,in)', '0.5–1.0', 'T_s,in・T_t,in・T_t,out・T_s,out']],
    ['5-4', '5.7', ['Fo = αt/L²', '0.01–100', '0.05']],
    ['5-4', '5.8', ['Fo = αt/r_o²', '最大値は平板の場合の10ではなく5']],
    ['5-6', '5.15', ['Θ = (T − T∞)/(Ti − T∞)', 'erf (ζ/2)', '0–3']],
    ['5-6', '5.16', ['0.1, 0.2, 0.5, 1, 2, 3, 5, 10, 20, 30, 50', 'β ≡ h̄√(αt)/k', '尺度が切り替わる']],
    ['5-6', '5.18', ['Bubble radius, R mm', 'Time, t seconds', 'Jakob 式', '厳密式']],
    ['5-6', '5.19', ['Θ = (T − T̄)/ΔT', 'Envelope of solution']],
    ['5-7', '5.20', ['δn／δs', 'T₁−3δT', 'I = ΔT/δT', 'δQ の矢印が4本']],
    ['5-7', '5.21', ['Step I', 'Step IV', '1/7th of a channel', 'Rough sketch'.replace('Rough sketch', 'ラフスケッチ')]],
    ['5-7', '5.22', ['3/4 of a channel', '凹角 A は T₁ 面', '上角 B は T₂ 面']],
    ['5-7', '5.23', ['Rough sketch', 'Final flux plot', '40°C', 'I = 2.1']],
    ['5-7', '5.24', ['S = N/I = 3/2.1 = 1.43']],
    ['5-7', '5.25', ['T₁ は内面', 'T₂ は外面']],
    ['5-7', '5.26', ['Fraction of a full channel', '左下隅']],
  ];
  for (const [id, num, needles] of checks) {
    const f = fig(await blocks(id), num);
    assert.ok(f, `${id} fig ${num} exists`);
    const hay = `${f.alt}\n${f.description}\n${f.caption}`;
    for (const n of needles) assert.ok(hay.includes(n), `${id} fig ${num} missing: ${n}`);
  }
});

// ---- Eq. (5.33) summation limit (C04-04) ----
test('C04-04: eq. (5.33) carries Σ to infinity', async () => {
  const eq = formula(await blocks('5-3'), '5.33');
  assert.ok(eq.expression.includes('Σ^∞(n = 奇数)'), eq.expression);
});

// ---- §5.6 "fine" and ≅ codepoints (C04-05, C04-18) ----
test('C04-05/C04-18: §5.6 fine shell wording and ≅ in Example 5.5 solution', async () => {
  const bl = await blocks('5-6');
  assert.ok(bl[4].text.includes('きめ細かい硬い外殻'), bl[4].text);
  assert.ok(bl[43].text.includes('t ≅ 0.33 s'), bl[43].text);
  assert.ok(bl[43].text.includes('Θ(ζ = 0, β) ≅ 1 − 2β/√π'), bl[43].text);
  assert.ok(!bl[43].text.includes('≃'), 'no U+2243 left in the block');
});

// ---- Time-constant glyph class (C3-C05-01 class; §5.2/§1.3/§4.5 verified at 600dpi) ----
test('C3-B glyph: time constant is bold italic T in 5-2/1-3/4-5; genuine script T kept in 2-3/4-2', async () => {
  const raw52 = await readRaw('data/sections/5-2-ja.json');
  assert.equal([...raw52].filter(c => c === SCRIPT_T).length, 0, 'no script T in 5-2');
  assert.equal([...raw52].filter(c => c === BOLD_T).length, 58, '58 bold italic T in 5-2');
  const raw13 = await readRaw('data/sections/1-3-ja.json');
  assert.equal([...raw13].filter(c => c === SCRIPT_T).length, 0, 'no script T in 1-3');
  assert.equal([...raw13].filter(c => c === BOLD_T).length, 11, '11 bold italic T in 1-3');
  const raw45 = await readRaw('data/sections/4-5-ja.json');
  assert.ok(raw45.includes(`t/${BOLD_T}`), '4-5 t/T in bold italic');
  assert.ok(!raw45.includes(SCRIPT_T), 'no script T in 4-5');
  const raw23 = await readRaw('data/sections/2-3-ja.json');
  assert.equal([...raw23].filter(c => c === SCRIPT_T).length, 2, 'Ex. 2.8 script T is print-genuine (C02-F13)');
  const raw42 = await readRaw('data/sections/4-2-ja.json');
  assert.equal([...raw42].filter(c => c === SCRIPT_T).length, 15, 'separation functions script T kept in 4-2');
});

// ---- §6.1/6.2 items (C3-C05-06/07/08/09/11) ----
test('C3-C05-06: eq. (6.5) explanation records the underbrace note', async () => {
  const eq = formula(await blocks('6-1'), '6.5');
  assert.ok(eq.explanation.includes('流体への伝導（conduction into the fluid）'), eq.explanation);
});

test('C3-C05-07/08/09/11: §6.2 juxtaposition, superscript minus, alt (x), eq. (6.27) display', async () => {
  const bl = await blocks('6-2');
  assert.ok(!bl[17].text.includes('u∞·y'), 'Ex. 6.1 solution uses juxtaposition');
  assert.ok(bl[17].text.includes('ψ = u∞y + fn(x)'), bl[17].text);
  assert.ok(fig(bl, '6.8').caption.includes('ψ = u∞y'), 'Fig. 6.8 caption juxtaposed');
  const lastRow = bl[43].items.at(-1);
  assert.ok(lastRow.includes('1.00000⁻'), lastRow);
  assert.ok(!lastRow.includes('1.00000−'), 'no full-size minus after 1.00000');
  assert.ok(formula(bl, '6.21').alt.includes('fn(y/δ(x))'), 'eq. (6.21) alt keeps (x)');
  assert.ok(bl[61].items[1].includes('u ∂u/∂x + v ∂u/∂y = ν ∂²u/∂y² |_{y=0}'), 'intermediate display transcribed');
  assert.ok(bl[61].items[1].includes('下括弧注'), 'underbrace =0 notes recorded');
});

// ---- §6.5 items (C3-C05-12/13) ----
test('C3-C05-12/13: Ex. 6.6 symbols restored; eq. (6.67) underbrace note added', async () => {
  const bl = await blocks('6-5');
  assert.ok(bl[35].text.includes('下括弧注「= (k/x) Nu_x」'), bl[35].text.slice(0, 80));
  assert.ok(bl[51].text.includes('(q·L)/(k·Nux=L)'), 'q not q_w');
  assert.ok(bl[51].text.includes('(q·L/k)'), 'q not q_w (2nd)');
  assert.ok(bl[51].text.includes('√Re_x'), 'Re_x not Re_L');
  assert.ok(!bl[51].text.includes('qw'), 'no q_w left');
});

// ---- §6.7 items (C3-C05-14/15/16/17) ----
test('C3-C05-14/15: overline scope in §6.7 uses the file-established bar-suffix forms', async () => {
  const raw = await readRaw('data/sections/6-7-ja.json');
  assert.ok(!raw.includes('ū′'), 'no ū′ ligature (bar on u only)');
  assert.ok(!raw.includes('v̄′'), 'no v̄′ ligature');
  const bl = await blocks('6-7');
  assert.ok(bl[9].text.includes('u′バー'), 'eq. (6.80) result averaged over u′');
  assert.ok(bl[16].text.includes('u′バー = v′バー = 0'), bl[16].text);
  assert.ok(bl[16].text.includes('u′v′バー') && bl[16].text.includes('u′²バー'), 'products of fluctuations carry the bar');
});

test('C3-C05-16/17: eq. (6.83) =0 note and eq. (6.85b) display form', async () => {
  const bl = await blocks('6-7');
  assert.ok(formula(bl, '6.82').explanation.includes('「= 0」の下括弧注'), 'underbrace =0 note');
  const e = formula(bl, '6.85a–6.85c').expression;
  assert.ok(e.includes('乱流混合を反映する何らかの他の因子'), e);
  assert.ok(e.includes('この第2項 ≡ ρ·εm'), 'underbrace definition of the 6.85b term');
  assert.ok(e.includes('ρ(ν + εm)(∂ū/∂y)'), '6.85c member present');
  assert.ok(!e.includes('[μ + ρ·εm]'), 'hybrid form removed');
});
