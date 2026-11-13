// Campaign-3 fix line C regression tests (sections ch.7-11, deep lessons, book.json).
// Assertions follow the primary source (A Heat Transfer Textbook, 6th ed.),
// not the pre-fix data forms.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const section = (id) => load(`../data/sections/${id}-ja.json`);
const lessons = load('../data/original-deep-lessons.json').lessons;
const book = load('../data/book.json');
const BAR = '\u0304';
const SCD = '\u{1D49F}'; // 𝒟
const DSTR = '\u0110';   // Đ

const allText = (blocks) => blocks.map((b) => JSON.stringify(b)).join('\n');
const figDesc = (sec, num) => section(sec).blocks.find((b) => b.figureNumber === num)?.description ?? '';
const figAlt = (sec, num) => section(sec).blocks.find((b) => b.figureNumber === num)?.alt ?? '';

// ---------- C-1 substantive fixes ----------

test('C04-06: lesson 5.6 eq (5.52) meaning says Bi*sqrt(Fo), not sqrt(Bi*Fo)', () => {
  const eq = lessons[24].equations.find((e) => e.label.includes('(5.52)'));
  assert.ok(eq.meaning.includes('Bi√Fo'), eq.meaning);
  assert.ok(!eq.meaning.includes('Bi と Fo の積の平方根'), eq.meaning);
  // beta = h*sqrt(alpha*t)/k equals Bi*sqrt(Fo) when Fo uses the same L:
  const h = 120, k = 0.6, alpha = 1.4e-7, t = 3600, L = 0.05;
  const beta = (h * Math.sqrt(alpha * t)) / k;
  const Bi = (h * L) / k, Fo = (alpha * t) / L ** 2;
  assert.ok(Math.abs(beta - Bi * Math.sqrt(Fo)) < 1e-12);
  assert.ok(Math.abs(beta - Math.sqrt(Bi * Fo)) > 0.1, 'sqrt(Bi*Fo) must NOT equal beta');
});

test('C06-07: section 7.2 restores the C1=0 derivation paragraph and the C2 display', () => {
  const blocks = section('7-2').blocks;
  assert.ok(blocks.some((b) => (b.text ?? '').includes('温度は r → 0 で有限でなければならない（脚注3）ゆえ C1 = 0')), 'derivation paragraph missing');
  assert.ok(blocks.some((b) => b.expression === 'C2 = Tb − (7/24)(qw·R/k)'), 'C2 display missing');
  // C2 must sit between the (7.18) block and the (7.20) block
  const i18 = blocks.findIndex((b) => b.number === '7.18');
  const iC2 = blocks.findIndex((b) => b.expression === 'C2 = Tb − (7/24)(qw·R/k)');
  const i20 = blocks.findIndex((b) => b.number === '7.20');
  assert.ok(i18 < iC2 && iC2 < i20, `order: ${i18} ${iC2} ${i20}`);
});

test('C06-06: section 7.2 MEMS parentheses are a matched half-width pair', () => {
  assert.ok(allText(section('7-2').blocks).includes('マイクロ電気機械システム (MEMS)'));
  assert.ok(!allText(section('7-2').blocks).includes('（MEMS)'));
});

test('C3C08-21: lesson 9.7 gravity paragraph uses L-prime for the characteristic length', () => {
  const txt = lessons[54].blocks.map((b) => b.text ?? '').join('\n');
  assert.ok(txt.includes('無次元特性長 L′ を通じた影響'), 'L-prime missing');
  assert.ok(txt.includes('R′ が約0.15を下回ると'), 'threshold R-prime sentence must stay');
});

test('C09-F01: Table 10.2 config 5 defines a from the band cylinder-side edge', () => {
  const items = section('10-3').blocks.flatMap((b) => b.items ?? []);
  const cfg5 = items.find((i) => i.startsWith('配置5'));
  assert.ok(cfg5.includes('a は帯の円柱側の端を通る鉛直線から中心線までの水平距離'), cfg5);
  assert.ok(!cfg5.includes('円柱の左端を通る鉛直線'), cfg5);
});

test('C3-10-13: Example 11.12 inline correlation has the printed exponent attribution', () => {
  const txt = allText(section('11-7').blocks);
  assert.ok(txt.includes('NūD = 0.560·√2·GrD^{1/4}·Pr^{1/4}/[1 + (0.492/Pr)^{9/16}]^{4/9}'), 'printed form missing');
  assert.ok(!txt.includes('[0.560(2·GrD·Pr)^{1/4}'), 'old mixed form remains');
  const GrD = 2.756e6, Pr = 0.708;
  const printed = (0.560 * Math.SQRT2 * GrD ** 0.25 * Pr ** 0.25) / (1 + (0.492 / Pr) ** (9 / 16)) ** (4 / 9);
  assert.ok(Math.abs(printed - 22.7) < 0.05, `printed form evaluates to ${printed}`);
});

// ---------- C09 adjudicated retention items + registered P3 (section side) ----------

test('C09: eq (10.21) leads with q_net*A and the rho/epsilon denominator first', () => {
  const b = section('10-4').blocks.find((x) => x.number === '10.21');
  assert.equal(b.expression, 'qnet·A = Qnet = (eb − B)/((ρ/ε)/A) = (eb − B)/((1 − ε)/(εA))');
});

test('C09: eq (10.31) explanation says underbrace, (10.34b/c) carry number fields', () => {
  const blocks = section('10-4').blocks;
  const b31 = blocks.find((x) => x.number === '10.31');
  assert.ok(b31.explanation.includes('下括弧で示された追加項'), b31.explanation);
  assert.ok(!allText(blocks).includes('波括弧で示された追加項'));
  assert.ok(blocks.some((x) => x.number === '10.34b'), '10.34b number missing');
  assert.ok(blocks.some((x) => x.number === '10.34c'), '10.34c number missing');
  assert.ok(!allText(blocks).includes('（式(10.34b)）') && !allText(blocks).includes('（式(10.34c)）'));
});

test('C09: eq (10.53) has no appended trailing equality', () => {
  const b = section('10-5').blocks.find((x) => x.number === '10.53');
  assert.equal(b.expression, 'iλ(L) = iλ0·e^(−ρκλL) + iλb·(1 − e^(−ρκλL))');
});

test('C09 retention: Figs 10.2/10.4/10.7 descriptions completed', () => {
  const d102 = figDesc('10-1', '10.2');
  assert.ok(d102.includes('O₃') && d102.includes('吸収帯') && d102.includes('0–3 µm'), d102);
  const d104 = figDesc('10-1', '10.4');
  assert.ok(d104.includes('dA cos 20°') && d104.includes('dA cos 90°'), d104);
  assert.ok(figDesc('10-3', '10.7').includes('上辺'), figDesc('10-3', '10.7'));
});

test('C09 retention: Example 10.1 symbolic forms precede the numeric lines', () => {
  const txt = allText(section('10-3').blocks);
  assert.ok(txt.includes('Qnet jet–room = Ajet·Fjet–room·σ(Tjet⁴ − Troom⁴) = π(0.003)'));
  assert.ok(txt.includes('Qnet shield–room = Ashield·Fshield–room·σ(Tshield⁴ − Troom⁴) = (π(0.05)'));
});

test('C09 retention: A_iH_i display and eqs (10.36)/(10.38) are standalone formula blocks', () => {
  const blocks = section('10-4').blocks;
  assert.ok(blocks.some((b) => b.expression === 'AiHi = Σj AjBjFj–i = Σj BjAiFi–j'), 'A_iH_i display missing');
  assert.ok(blocks.some((b) => b.number === '10.36' && b.type === 'formula'), '10.36 block missing');
  assert.ok(blocks.some((b) => b.number === '10.38' && b.type === 'formula'), '10.38 block missing');
  const txt = allText(blocks);
  assert.ok(txt.includes('Qnet1 = A1(ε1/(1 − ε1))(σT1⁴ − B1) = A1(ε1/(1 − ε1))σ(T1⁴ − 0.232T1⁴'), 'Ex 10.10 symbolic form missing');
});

// ---------- C-2 figure description class (C08) ----------

test('C3C08: ch.9 figure descriptions carry the figure content', () => {
  assert.ok(figDesc('9-1', '9.1').includes('彼の推測'), 'Fig 9.1 dashed conjecture');
  const d92 = figDesc('9-1', '9.2');
  assert.ok(!d92.includes('核沸騰、ピーク、'), 'peak must not be listed as a regime');
  assert.ok(d92.includes('特徴点'), d92);
  assert.ok(figDesc('9-2', '9.5').includes('T_superheated'), 'Fig 9.5 isotherm labels');
  assert.ok(figDesc('9-3', '9.8').includes('λd'), 'Fig 9.8 lambda_d');
  assert.ok(figDesc('9-3', '9.9').includes('λd1²'), 'Fig 9.9 cell area');
  assert.ok(figDesc('9-3', '9.10').includes('λH/2'), 'Fig 9.10 lambda_H/2');
  assert.ok(figDesc('9-3', '9.11').includes('2部構成'), 'Fig 9.11 two parts');
  assert.ok(figDesc('9-3', '9.12').includes('式(9.17)'), 'Fig 9.12 left half');
  assert.ok(figDesc('9-3', '9.13').includes('5パネル'), 'Fig 9.13 panels');
  assert.ok(figDesc('9-6', '9.14').includes('未清浄・非酸化'), 'Fig 9.14 legend');
  assert.ok(figAlt('9-6', '9.15').includes('一点鎖線'), 'Fig 9.15 line style');
  assert.ok(figDesc('9-7', '9.16').includes('遷移沸騰の振る舞いは知られていない'), 'Fig 9.16 note');
  assert.ok(figDesc('9-7', '9.16').includes('[(Tw − Tsat) + ΔTsub]^(5/4)'), 'Fig 9.16 second form');
  const d917 = figDesc('9-7', '9.17');
  assert.ok(!d917.includes('板の高さ 4.7 cm') && d917.includes('平板面から流れ領域の上端まで'), d917);
  const d918 = figDesc('9-8', '9.18');
  assert.ok(d918.includes('T_liquid core') && !d918.includes('T^liquid core') && !d918.includes('横軸は温度と乾き度／距離'), d918);
  const d919 = figDesc('9-8', '9.19');
  assert.ok(d919.includes('乾き度 x') && !d919.includes('χ') && d919.includes('ドライアウトは中央の結節点から'), d919);
  assert.ok(figDesc('9-10', '9.21').includes('A Moment later'), 'Fig 9.21 two instants');
  assert.ok(figDesc('9-11', '9.22').includes('Insulation'), 'Fig 9.22 insulation label');
  assert.ok(figDesc('9-11', '9.23').includes('Cooler Master'), 'Fig 9.23 upper unit');
});

test('C3C08-14: Table 9.3 row 9 keeps the group modifier (vertical orientation)', () => {
  const items = section('9-3').blocks.flatMap((b) => b.items ?? []);
  assert.ok(items.some((i) => i.startsWith('9. 小さい水平リボン（垂直向き、一側断熱）')), items.find((i) => i.startsWith('9.')));
});

test('C3C08-17: eq (9.46) is a standalone formula block in section 9.8', () => {
  const b = section('9-8').blocks.find((x) => x.number === '9.46');
  assert.ok(b && b.type === 'formula', '9.46 block missing');
  assert.equal(b.expression, 'h_{fb}/h_{lo} = fn(x, qw/(Gh_fg), ρ_g/ρ_f)');
});

test('C3C08-13: lesson 9.4 restores macrons in eqs (9.28)/(9.31)', () => {
  const eqs = lessons[51].equations;
  const e28 = eqs.find((e) => e.label.includes('(9.28)'));
  const e31 = eqs.find((e) => e.label.includes('(9.31)'));
  assert.ok(e28.expression.includes(`Nu${BAR}_D = 0.62`), e28.expression);
  assert.ok(e31.expression.includes(`h${BAR}_total = h${BAR}_boiling + (3/4) h${BAR}_rad`), e31.expression);
});

test('C3C08-23: lesson 9.7 eq (9.42) condition uses the slanted ⩾ (U+2A7E)', () => {
  const txt = JSON.stringify(lessons[54]);
  assert.ok(txt.includes('u∞²/(gD)⩾4'), 'slanted form missing');
  assert.ok(!txt.includes('u∞²/(gD)≥4'), 'U+2265 form remains');
});

// ---------- C06 ch.7 items / C07 items ----------

test('C06-08..12: section 7.3 condition glyph, Re_d subscripts, Haaland forms', () => {
  const blocks = section('7-3').blocks;
  const b732 = blocks.find((b) => b.number === '7.32');
  assert.ok(b732.explanation.includes('Pr ≳ 0.7'), b732.explanation);
  assert.ok(blocks.find((b) => b.number === '7.43a').expression.includes('Re_d^0.8'));
  assert.ok(blocks.find((b) => b.number === '7.43b').expression.includes('Re_d^0.87'));
  assert.ok(blocks.find((b) => b.number === '7.50').expression.startsWith('f = 1/{1.8·log10'), 'Haaland printed form');
  const txt = allText(blocks);
  assert.ok(!txt.includes('{−1.8·log10'), 'spurious minus remains');
  assert.ok(txt.includes('特に Pe_d < 200'), 'Pe_d prose');
});

test('C06-13/14 + C07-03: Rt comma removed, Fig 7.13 caption, 7.6 header range', () => {
  assert.ok(!allText(section('7-5').blocks).includes('Rt,wall'));
  const s76 = section('7-6');
  assert.equal(s76.bookPages, '387–397');
  assert.equal(s76.pdfPages, '401–411');
  const cap = s76.blocks.find((b) => b.figureNumber === '7.13').caption;
  assert.ok(!cap.includes('通常の横流れ') && cap.includes('円柱に垂直な'), cap);
});

test('C07-01/04/05/14/15: ch.8 condition, macron attribution, integral limits, footnote, lesson note', () => {
  const d81 = figDesc('8-2', '8.1');
  // Campaign 5 (C5-C07-07) superseded the campaign-3 pin below: the print's Fig. 8.1 note
  // reads "Pr ≲ the order of unity" (600dpi), so the description now says 1のオーダー程度以下.
  assert.ok(d81.includes('Pr が1のオーダー程度以下') && !d81.includes('Pr ≪ 1'), d81);
  const b89 = section('8-3').blocks.find((b) => b.number === '8.9');
  assert.ok(b89.explanation.includes('NuL = fn(GrL, Pr)（式(8.10)）'), 'eq (8.10) must be bar-less');
  const txt83 = allText(section('8-3').blocks);
  assert.ok(txt83.includes('∫_{Ti}^{T}(Tb − T)^(−5/4)d(Tb − T) = −(B/(ρcw))∫_0^t dt'), 'Ex 8.2 integral limits');
  const fn11 = section('8-5').blocks.map((b) => b.text ?? '').find((x) => x.startsWith('脚注11'));
  assert.ok(fn11.endsWith('（問題8.54を見よ）。'), fn11);
  assert.ok(!fn11.includes('照合済み事項'), fn11);
  assert.ok(JSON.stringify(lessons[47]).includes('Nu_x/(Π_4/4)^(1/4)'), 'lesson 8.5 normalization note');
});

// ---------- C10 / C11 items ----------

test('C3-10-01/09/12: >90% wording, product dots, 11.5 page range', () => {
  assert.ok(allText(section('10-6').blocks).includes('90%を超える部分が通過する'));
  assert.ok(!allText(section('10-6').blocks).includes('90%以上が通過する'));
  const e1138 = section('11-4').blocks.find((b) => b.number === '11.38').expression;
  const e1139 = section('11-4').blocks.find((b) => b.number === '11.39').expression;
  assert.ok(e1138.includes('ρiv⃗·dS⃗') && !e1138.includes('ρi·v⃗'), e1138);
  assert.ok(e1139.includes('∇·(ρiv⃗)') && !e1139.includes('(ρi·v⃗)'), e1139);
  const s115 = section('11-5');
  assert.equal(s115.bookPages, '647–655');
  assert.equal(s115.pdfPages, '661–669');
});

test('C3-10-08/10/11: Figs 11.10/11.15 descriptions completed; Nu subscript x is plain', () => {
  const d1110 = figDesc('11-4', '11.10');
  assert.ok(d1110.includes('0–100') && d1110.includes('約1.0'), d1110);
  const d1115 = figDesc('11-6', '11.15');
  assert.ok(d1115.includes('自由流の矢印が6本') && d1115.includes('ni,s'), d1115);
  const raw116 = readFileSync(new URL('../data/sections/11-6-ja.json', import.meta.url), 'utf8');
  assert.equal((raw116.match(/𝒳/g) ?? []).length, 2, 'only the two length positions keep script X');
  assert.ok(raw116.includes('Num,x ≡ gm,i·𝒳/(ρ𝒟im)'));
});

test('C3-10-07: lesson 11.3 uses script D for the diffusivity throughout', () => {
  const l67 = JSON.stringify(lessons[67]);
  assert.ok(!l67.includes('D_H2O,air'), 'plain D_H2O,air remains');
  assert.equal((l67.match(new RegExp(`${SCD}_H2O,air`, 'g')) ?? []).length, 3);
  assert.ok(l67.includes(`${SCD} は m²/s、T は K、p は atm`));
});

test('C11-3-01/03/04: eq (11.80) final term, eq (11.132) printed form, (11.137b) cross-reference', () => {
  const e1180 = section('11-8').blocks.find((b) => b.number === '11.80').expression;
  assert.equal((e1180.match(/\[∫₀\^δc dy\/\(ρ\(𝒟12 \+ ε2\)\)\]⁻¹/g) ?? []).length, 2, e1180);
  const b1132 = section('11-11').blocks.find((b) => b.number === '11.132');
  assert.ok(b1132.expression.includes('μ⦵(p, T)') && !b1132.expression.includes('μi⦵'), b1132.expression);
  assert.ok(allText(section('11-11').blocks).includes('式(11.137b) の Γ11 を Γ として'));
});

test('C11-3-02: lesson 11.11 worked example uses Đ (U+0110) for MS coefficients', () => {
  const prob = lessons[75].workedExample.problem;
  assert.ok(prob.includes(`${DSTR}_AB=1.0×10⁻⁵`) && prob.includes(`${DSTR}_AC=2.0×10⁻⁵`) && prob.includes(`${DSTR}_BC=1.5×10⁻⁵`), prob);
  assert.equal((JSON.stringify(lessons[75]).match(/Đ/g) ?? []).length, 15);
});

test('C05-05/C10-14: book.json chapter titles match the section headings', () => {
  const ch = Object.fromEntries(book.chapters.map((c) => [c.sourceTitle, c.title]));
  assert.equal(ch['Laminar and turbulent boundary layers'], '層流および乱流の境界層');
  assert.equal(ch['An introduction to mass transfer'], '物質移動の導入');
  assert.ok(section('6-1').blocks.some((b) => (b.text ?? '').includes('層流および乱流の境界層')));
  assert.ok(section('11-1').blocks.some((b) => (b.text ?? '').includes('第11章　物質移動の導入')));
});
