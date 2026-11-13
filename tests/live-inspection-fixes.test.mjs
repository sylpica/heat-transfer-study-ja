// Regression tests for the 2026-11-12 live-site inspection fixes.
// Root cause: math notation conversion existed only on the quiz path and in a
// narrow form, so the reader, glossary and given-formula blocks showed raw
// "_"/"^" characters (problem 9.34 was unreadable). See
// docs/audit-final/LIVE_INSPECTION_20261112.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatMathText, renderTermLinks, renderTermSheet} from '../term-links.mjs';

test('formatMathText converts the full corpus notation set', () => {
  const cases = [
    ['ĥ_in', 'ĥ<sub>in</sub>'],
    ['ĥ_{f,sat}', 'ĥ<sub>f,sat</sub>'],
    ['∫_0^L', '∫<sub>0</sub><sup>L</sup>'],
    ['Pr^(2/3)', 'Pr<sup>2/3</sup>'],
    ['Pr^{2/3}', 'Pr<sup>2/3</sup>'],
    ['Re^m Pr^n', 'Re<sup>m</sup> Pr<sup>n</sup>'],
    ['L^(m−1)', 'L<sup>m−1</sup>'],
    ['A_iF_ij=A_jF_ji', 'A<sub>i</sub>F<sub>ij</sub>=A<sub>j</sub>F<sub>ji</sub>'],
    ['q″_CHF', 'q″<sub>CHF</sub>'],
    ['dT/dx|_(x=L)=0', 'dT/dx|<sub>x=L</sub>=0'],
    ['m_H2O,e', 'm<sub>H2O,e</sub>'],
    ['T_∞i', 'T<sub>∞i</sub>'],
    ['T_h,in', 'T<sub>h,in</sub>'],
    ['T^2', 'T<sup>2</sup>'],
  ];
  for (const [input, expected] of cases) assert.equal(formatMathText(input), expected, input);
});

test('formatMathText leaves URLs and plain prose untouched', () => {
  assert.equal(formatMathText('参照 https://example.com/a_b?q=x_y のこと'), '参照 https://example.com/a_b?q=x_y のこと');
  assert.equal(formatMathText('熱伝導の基礎'), '熱伝導の基礎');
});

test('formatMathText turns combining overlines into styled spans', () => {
  assert.equal(formatMathText('Nū'), 'N<span class="math-overline">u</span>');
  assert.equal(formatMathText('h̄'), '<span class="math-overline">h</span>');
});

test('reader path (renderTermLinks) converts math in prose', () => {
  const html = renderTermLinks('代表式は Nu_L≈0.664 Re_L^(1/2) Pr^(1/3) です', []);
  assert.ok(html.includes('Nu<sub>L</sub>'));
  assert.ok(html.includes('Re<sub>L</sub><sup>1/2</sup>'));
  assert.ok(!html.includes('^('));
});

test('term sheet formula is math-converted', () => {
  const html = renderTermSheet({id: 'x', ja: '試験', en: 'test', meaning: '意味', formula: 'q″_CHF≈0.131h_fg'}, []);
  assert.ok(html.includes('q″<sub>CHF</sub>≈0.131h<sub>fg</sub>'));
});

test('app wiring: given formulas, term formulas and figure pages use the converter', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("renderMathText(formula.expression || '', ui.readerQuery || '')"));
  assert.ok(app.includes('${renderMathText(term.formula)}'));
  assert.ok(app.includes('pageRef'));
  assert.ok(!app.includes("?? 'unrecorded'"));
});

test('figure 11.19 caption/description and footnote 18 carry real subscripts', () => {
  const sec = JSON.parse(readFileSync(new URL('../data/sections/11-8-ja.json', import.meta.url), 'utf8'));
  const fig = sec.blocks.find(b => b.type === 'figure' && b.figureNumber === '11.19');
  assert.ok(fig.caption.includes('n_salt = ρ_salt·v + j_salt = 0'));
  assert.ok(fig.description.includes('m_H2O,e → m_H2O,s'));
  assert.ok(fig.description.includes('j_salt・v・n_H2O,s'));
  assert.ok(fig.description.includes('u_e'));
  const text = JSON.stringify(sec);
  assert.ok(text.includes('CaCO₃'));
  assert.ok(text.includes('CaSO₄·2H₂O'));
});

test('modifier-letter f (U+1DA0) is gone from learner data; fluid subscripts use markup', () => {
  for (const rel of ['data/glossary.json', 'data/questions.json']) {
    const raw = readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
    assert.ok(!raw.includes('\u1da0'), rel);
  }
  const glossary = JSON.parse(readFileSync(new URL('../data/glossary.json', import.meta.url), 'utf8'));
  const pr = glossary.find(t => t.formula && t.formula.startsWith('Pr='));
  assert.ok(pr && pr.meaning.includes('α_f') && pr.meaning.includes('k_f'));
});

test('strouhal entry matches the book: Str for Strouhal, St stays Stanton', () => {
  const glossary = JSON.parse(readFileSync(new URL('../data/glossary.json', import.meta.url), 'utf8'));
  const s = glossary.find(t => t.id === 'strouhal-number');
  assert.equal(s.formula, 'Str=f_v·D/u∞（渦放出の定義）');
  assert.ok(s.unit.startsWith('Str:'));
  assert.deepEqual(s.aliases, ['Str（渦放出）']);
  assert.ok(s.example.includes('Str=0.20'));
  assert.ok(s.detail.includes('u∞は主流速'));
});

test('round 2: guide lessons carry real subscript markup, no modifier f anywhere', () => {
  const guide = readFileSync(new URL('../guide.mjs', import.meta.url), 'utf8');
  assert.ok(!guide.includes('\u1da0'));
  assert.ok(guide.includes('ρ<sub>f</sub>'));
  assert.ok(!/html:"[^"]*\^\d/.test(guide));
});

test('round 2: lesson diagram SVGs have no raw math notation left in text', async () => {
  const {readdirSync} = await import('node:fs');
  const dir = new URL('../assets/lesson-diagrams/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.svg'));
  assert.ok(files.length >= 76);
  for (const f of files) {
    const raw = readFileSync(new URL(f, dir), 'utf8');
    const textOnly = raw.replace(/<[^>]*>/g, '');
    assert.ok(!/\^\(|\^\{|_\{|\^[0-9]|[A-Za-z]_[A-Za-z0-9]/.test(textOnly), f);
  }
});

test('round 2: unit fields are math-converted in card, flashcard and sheet', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('${renderMathText(term.unit)}'));
  assert.ok(!app.includes('${escapeHTML(term.unit)}'));
  const links = readFileSync(new URL('../term-links.mjs', import.meta.url), 'utf8');
  assert.ok(links.includes('${mathText(term.unit)}'));
  const sheet = renderTermSheet({id: 'u', ja: '試験', en: 't', meaning: '意味', unit: 'q″_CHF: W/m²'}, []);
  assert.ok(sheet.includes('q″<sub>CHF</sub>'));
});

test('round 2: block source labels omit unrecorded pages instead of printing 未記録', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("if(block.bookPage!=null&&block.bookPage!=='')"));
  assert.ok(!app.includes("first??'未記録'"));
});

test('round 2: the Re question no longer merges the velocity into the subscript', () => {
  const qs = JSON.parse(readFileSync(new URL('../data/questions.json', import.meta.url), 'utf8'));
  const q = qs.find(x => x.id === 'supp-expanded-re-calc');
  assert.ok(q.prompt.includes('Re=ρ_f·uL/μ'));
  assert.ok(!JSON.stringify(q).includes('ρ_fu'));
});

test('round 3: fraction and infinity superscripts convert (t^½, ∫₀^∞)', () => {
  assert.equal(formatMathText('t^½'), 't<sup>½</sup>');
  assert.equal(formatMathText('∫₀^∞ε_λ dλ'), '∫₀<sup>∞</sup>ε<sub>λ</sub> dλ');
  assert.equal(formatMathText('x^2 + y^n'), 'x<sup>2</sup> + y<sup>n</sup>');
});

test('round 3: no spelled-out Qdot remains in lesson diagrams; Q with dot above is used', () => {
  for (const f of ['section-10-3-view-factor-reciprocity.svg', 'section-10-4-gray-surface-radiation-network.svg']) {
    const svg = readFileSync(new URL('../assets/lesson-diagrams/' + f, import.meta.url), 'utf8');
    assert.ok(!svg.includes('Qdot'), f);
    assert.ok(svg.includes('Q̇'), f);
  }
});

test('campaign-3 C03 w05 gap closure: section 4.1 carries the t-max/region clause and the Example 2.5 cross-reference', () => {
  const sec = JSON.parse(readFileSync(new URL('../data/sections/4-1-ja.json', import.meta.url), 'utf8'));
  const texts = sec.blocks.map((b) => b.text || '').join('\n');
  assert.match(texts, /0 < t ⩽ t_max（t_max は ∞ になりうる）/);
  assert.match(texts, /例題2\.5のステップ4ですでに用いており、1\.3節でも論じている/);
  // the third-kind formula keeps the printed macron on h (PDF 156, 600 dpi)
  const formula = sec.blocks.find((b) => b.type === 'formula' && b.expression.includes('∂T/∂x'));
  assert.ok(formula.expression.includes('h̄'));
});

test('dynamic lab: short material names and separated graph label rows', () => {
  const presets = readFileSync(new URL('../dynamic/presets.mjs', import.meta.url), 'utf8');
  assert.ok(presets.includes("name:'アルミニウム6061-T6'"));
  assert.ok(!presets.includes('（20℃の一定物性近似）'));
  const lab = readFileSync(new URL('../dynamic/lab.mjs', import.meta.url), 'utf8');
  assert.ok(lab.includes("ctx.fillText('物理時間 [s]',W-20,H-3)"));
  const plots = readFileSync(new URL('../dynamic/field-plots.mjs', import.meta.url), 'utf8');
  assert.ok(plots.includes('W-20,198'));
});
