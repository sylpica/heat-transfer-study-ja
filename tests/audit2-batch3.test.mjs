// Regression tests for audit phase B-2 (register batch 3: science/wording fixes).
// Pins the FC leftovers (FC-11/16/21/25/26) and the re-audit "improvement" items
// that are resolvable by wording/notation edits. Each test names its finding ID.
// Data-level assertions read the published JSON directly.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=async file=>JSON.parse(await readFile(new URL('../'+file,import.meta.url),'utf8'));
const [lessonsData,notesData,glossary,questions,sectionQuestions]=await Promise.all([
  read('data/original-deep-lessons.json'),
  read('data/original-notes.json'),
  read('data/glossary.json'),
  read('data/questions.json'),
  read('data/original-section-questions.json')
]);
const lesson=id=>lessonsData.lessons.find(l=>l.sectionId===id);
const lessonText=id=>{
  const l=lesson(id);
  return l.blocks.map(b=>b.heading+'\n'+b.text).join('\n')+'\n'+l.equations.map(e=>e.label+': '+e.expression+' | '+e.meaning).join('\n')+'\n'+JSON.stringify(l.workedExample??{});
};
const note=id=>notesData.notes.find(n=>n.sectionId===id);
const term=id=>glossary.find(t=>t.id===id);
const q=id=>questions.find(x=>x.id===id);
const sq=id=>sectionQuestions.questions.find(x=>x.id===id);

// ---- Ch.1 / Ch.4 wording ----
test('R1-Y01: lesson 1.3 uses the vector form for the gradient law',()=>{
  const t=lessonText('1.3');
  assert.ok(t.includes('q⃗=−k∇T'),'Fourier law with a gradient must be the vector flux q⃗″');
  assert.ok(!lesson('1.3').blocks[0].text.includes('q″=−k∇T'),'scalar q″ must not be paired with ∇T');
});
test('R2-4.1-01: lesson 4.1 states the book calls it third-kind and never says Robin',()=>{
  const t=lessonText('4.1');
  assert.ok(t.includes('第3種境界条件'));
  assert.ok(t.includes('Robinという名称は使われていない'));
});
test('R2-4.3-04: lesson 4.3 notes Fo is introduced in the book at section 5.2',()=>{
  assert.ok(lessonText('4.3').includes('§5.2で導入'));
});
test('R2-4.4-03 (FC-10): lesson 4.4 relates Pi_gen to the book Gamma definitions',()=>{
  const t=lessonText('4.4');
  assert.ok(t.includes('Γ'));
  assert.ok(t.includes('Π_gen'));
  assert.ok(t.includes('式(4.17)'));
});
test('R2-4.4-01: lesson 4.4 discloses the shape-factor placement vs book 5.7',()=>{
  const t=lessonText('4.4');
  assert.ok(t.includes('§5.7'));
  assert.ok(t.includes('例題4.7'));
});
test('FC-11: lesson 4.5 states the transverse Biot condition Bi_fin = h-bar(A/P)/k << 1',()=>{
  const t=lessonText('4.5');
  // Overline restoration (Y3 adjudication): the fin coefficient carries the
  // mean-value bar in print, so the pinned string is the barred form.
  assert.ok(t.includes('Bi_fin=h̄(A/P)/k'));
  assert.ok(t.includes('R/2'));
});
test('R2-4.5-04: lesson 4.5 distinguishes tip coefficient h-bar_L and Biax',()=>{
  const t=lessonText('4.5');
  assert.ok(t.includes('h̄_L'));
  assert.ok(t.includes('Biax=h̄_L L/k'));
});

// ---- Ch.5 wording ----
test('R2-5.4-01: lesson 5.4 gives the chart useful range and the Fig. 5.7 equivalence',()=>{
  const t=lessonText('5.4');
  assert.ok(t.includes('0.05≲Fo≲0.2'));
  assert.ok(t.includes('Bi≳0.1'));
  assert.ok(t.includes('図5.7'));
});
test('R2-5.5-03: lesson 5.5 gives the quantitative one-term criteria',()=>{
  const t=lessonText('5.5');
  assert.ok(t.includes('Fo≧0.28'));
  assert.ok(t.includes('Fo≧0.43'));
  assert.ok(t.includes('0.1%'));
});
test('R2-5.5-01: section 5.5 questions carry the corrected given values and v2',()=>{
  const a=q('supp-transient-gap-one-term-average-factor-v1');
  assert.ok(a.prompt.includes('0.881124'));
  assert.ok(!a.prompt.includes('0.881119'));
  assert.equal(a.revision,'v2');
  const b=q('supp-transient-gap-one-term-mode-decay-v1');
  assert.ok(b.prompt.includes('0.00409762'));
  assert.ok(!b.prompt.includes('0.0040977を'));
  assert.equal(b.revision,'v2');
});
test('R2-5.6-03: lesson and note 5.6 distinguish delta_99 = 3.64 sqrt(alpha t)',()=>{
  assert.ok(lessonText('5.6').includes('3.64√(αt)'));
  assert.ok(note('5.6').relation.includes('3.64√(αt)'));
  assert.ok(sq('supp-section-5-6').explanation.includes('3.64√(αt)'),'note change must be mirrored into the section question');
  assert.equal(sq('supp-section-5-6').revision,'v2');
  assert.equal(q('supp-section-5-6').revision,'v2');
});
test('R2-5.7-03: lesson 5.7 states the correspondence with book 5.7 (shape factors / flux plots)',()=>{
  const t=lessonText('5.7');
  assert.ok(t.includes('フラックスプロット'));
  assert.ok(t.includes('形状係数'));
});
test('R2-5.8-03: lesson 5.8 states the equivalence with the book Phi composition (5.72c)',()=>{
  const t=lessonText('5.8');
  assert.ok(t.includes('Φ=Φ₁+Φ₂(1−Φ₁)'));
  assert.ok(t.includes('(5.72c)'));
});

// ---- Ch.6 wording ----
test('R3-I-01: coefficient 5 for delta_99 is flagged as an approximation of the exact 4.92',()=>{
  assert.ok(lessonText('6.2').includes('4.92'));
  assert.ok(note('6.2').relation.includes('4.92'));
  assert.ok(q('supp-laminar-velocity-thickness-v1').explanation.includes('4.92'));
  assert.ok(sq('supp-section-6-2').explanation.includes('4.92'));
});
test('FC-16: lesson 6.5 includes the uniform-heat-flux correlations (6.71)/(6.72)',()=>{
  const t=lessonText('6.5');
  assert.ok(t.includes('0.4587'));
  assert.ok(t.includes('0.688'));
});
test('FC-21: lesson 6.5 states the Mach and Eckert premises of the flat-plate analysis',()=>{
  const t=lessonText('6.5');
  assert.ok(t.includes('Ma≲0.3'));
  assert.ok(t.includes('Ec=u∞²/[c_p(T_w−T∞)]'));
});
test('R3-I-02: the Pr range of (6.58) is stated as Pr>=0.6 with no book upper bound',()=>{
  const t=lessonText('6.5');
  assert.ok(t.includes('Pr≧0.6'));
  assert.ok(!t.includes('Pr≈0.6〜50'));
  assert.ok(q('supp-applied-6-5-v1').explanation.includes('Pr≧0.6'));
  assert.ok(q('supp-laminar-plate-local-average-v1').explanation.includes('Pr≧0.6'));
});
test('R3-I-03: analogy limits (isothermal wall origin) are stated in lesson, note and the scope question',()=>{
  assert.ok(lessonText('6.6').includes('0.4587'));
  assert.ok(lessonText('6.6').includes('等温壁'));
  assert.ok(note('6.6').limits.includes('一様熱流束壁'));
  assert.ok(sq('supp-section-6-6').explanation.includes('一様熱流束壁'));
  const scope=q('supp-turbulence-analogy-scope-v1');
  assert.ok(scope.explanation.includes('0.4587'));
  assert.equal(scope.revision,'v2');
});
test('R3-I-04: lesson 6.7 distinguishes the book log-law line from the 1/5-power integral forms',()=>{
  const t=lessonText('6.7');
  assert.ok(t.includes('0.455/[ln(0.06 Re_x)]²'));
  assert.ok(t.includes('1/7'));
});
test('R3-I-05: lesson 6.7 records the book log-law constant B ~= 5.5',()=>{
  assert.ok(lessonText('6.7').includes('B≅5.5'));
});
test('R3-I-07: the two transition questions name the sudden-transition approximation and (6.120)',()=>{
  for(const id of ['supp-turbulence-transition-corrected-nu-v1','supp-turbulence-transition-heat-rate-v1']){
    assert.ok(q(id).explanation.includes('(6.120)'),id);
    assert.ok(q(id).explanation.includes('急切替'),id);
    assert.equal(q(id).revision,'v2',id);
  }
});

// ---- Ch.7 wording ----
test('R3-I-08: entry-length source values (0.03 / 0.034 / 0.043) are recorded',()=>{
  assert.ok(lessonText('7.1').includes('0.03 Re_D'));
  assert.ok(lessonText('7.2').includes('0.034'));
  assert.ok(q('supp-batch2-hydraulic-entry-length-v1').explanation.includes('0.03'));
  assert.ok(q('supp-batch2-thermal-entry-length-v1').explanation.includes('0.034'));
  assert.ok(q('supp-batch2-thermal-entry-length-v1').explanation.includes('0.043'));
  assert.ok(q('supp-batch2-pipe-entry-judgment-v1').explanation.includes('0.034'));
  assert.ok(q('supp-internal-flow-entrance-state-v1').explanation.includes('0.03'));
});
test('R3-I-10: the six section 7.2 questions no longer carry the unrelated radiation boilerplate pitfall',()=>{
  for(const id of ['supp-batch2-pipe-h-wall-temperature-v1','supp-batch2-local-wall-flux-v1','supp-batch2-constant-flux-pipe-h-v1','supp-batch2-hydraulic-entry-length-v1','supp-batch2-thermal-entry-length-v1','supp-batch2-pipe-entry-judgment-v1']){
    assert.ok(!q(id).beginnerPitfall.includes('黒体と灰色体'),id);
  }
});
test('FC-25: lesson 7.3 includes Sieder-Tate (7.40) and distinguishes the separate property corrections',()=>{
  const t=lessonText('7.3');
  assert.ok(t.includes('Sieder–Tate'));
  assert.ok(t.includes('(μ_b/μ_w)^0.14'));
  assert.ok(t.includes('(7.44)'));
});
test('FC-26: lesson 7.3 includes the liquid-metal correlations (7.52)/(7.54)/(7.55)',()=>{
  const t=lessonText('7.3');
  assert.ok(t.includes('0.625 Pe_D^0.4'));
  assert.ok(t.includes('5.0+0.025'));
  assert.ok(t.includes('4.82+0.0185'));
});
test('R3-I-09: lesson 7.3 states the book nominal Gnielinski range',()=>{
  const t=lessonText('7.3');
  assert.ok(t.includes('2300'));
  assert.ok(t.includes('10⁵'));
});
test('R3-I-11: question 7.6 no longer references the absent Nu=50 example',()=>{
  for(const src of [q('supp-section-7-6'),sq('supp-section-7-6')]){
    assert.ok(!src.explanation.includes('Nu=50'));
    assert.ok(!src.beginnerPitfall.includes('Nu=50'));
    assert.equal(src.revision,'v3');
  }
  assert.ok(!note('7.6').limits.includes('Nu=50'));
});
test('R3-I-12: the square-duct 56.91 value is attributed to Shah & London, not the book table',()=>{
  assert.ok(lessonText('7.5').includes('Shah'));
  assert.ok(q('supp-geometry-correlation-square-pressure-v1').explanation.includes('Shah'));
});

// ---- Ch.8 / Ch.9 wording ----
test('R4-8-003: the film-Re definition conversions (28 / 1600 / example Re_c) are stated',()=>{
  assert.ok(lessonText('8.2').includes('28'));
  assert.ok(lessonText('8.5').includes('1600'));
  assert.ok(JSON.stringify(lesson('8.5').workedExample).includes('5.5'));
});
test('R4-8-004: lesson 8.2 writes the interface condition as a derivative',()=>{
  const t=lessonText('8.2');
  assert.ok(t.includes('∂u/∂y|_{y=δ}=0'));
  assert.ok(!t.includes('膜表面でu_y=0'));
});
test('R4-8-005: the corrected-latent-heat question flags its out-of-range Ja in the prompt',()=>{
  const target=q('supp-condensation-corrected-latent-v1');
  assert.ok(target.prompt.includes('0.02'));
  assert.equal(target.revision,'v3');
});
test('R4-9-001: lesson 9.3 distinguishes lambda_d1 from lambda_d2',()=>{
  const t=lessonText('9.3');
  assert.ok(t.includes('λ_d1'));
  assert.ok(t.includes('λ_d2=√2 λ_d1'));
});
test('R4-9-002: note and question 9.4 use the weighted (3/4)h_rad form of (9.31)',()=>{
  assert.ok(note('9.4').relation.includes('(3/4)h_rad'));
  const target=sq('supp-section-9-4');
  assert.ok(target.explanation.includes('(3/4)h_rad'));
  assert.ok(!target.explanation.includes('q″_total≈q″_film+q″_radiation'));
  assert.equal(target.revision,'v3');
  assert.equal(q('supp-section-9-4').revision,'v3');
});

// ---- Ch.10 / Ch.11 wording ----
test('R5-10-002: glossary optical thickness uses tau_o, distinct from transmittance tau_lambda',()=>{
  assert.ok(term('beer-lambert-radiative-law').formula.includes('τ_o'));
  assert.ok(!term('non-gray-gas').formula.includes('τ_λ=κ_λL'));
  assert.ok(term('isothermal-radiating-layer-solution').formula.includes('τ_o'));
});
test('R5-10-003: glossary emissivity formula is the definition epsilon = E/E_b',()=>{
  assert.ok(term('emissivity').formula.includes('E/E_b'));
});
test('R5-10-004: the app kappa is identified with the book rho*kappa_lambda',()=>{
  assert.ok(lessonText('10.5').includes('ρκ_λ'));
  assert.ok(note('10.5').relation.includes('ρκ_λ'));
  assert.ok(term('radiative-absorption-coefficient').detail.includes('ρκ_λ'));
  assert.equal(sq('supp-section-10-5').revision,'v2');
});
test('R5-11-001: symbol correspondence y<->x_i and w<->m_i is stated',()=>{
  assert.ok(lessonText('11.1').includes('x_i'));
  assert.ok(lessonText('11.1').includes('m_i'));
  assert.ok(lessonText('11.11').includes('x_i'));
  assert.ok(term('fick-law').detail.includes('x_i'));
});
test('R5-11-002: g_m and the conversion g_m = rho k_c are introduced',()=>{
  assert.ok(lessonText('11.6').includes('g_m'));
  assert.ok(lessonText('11.6').includes('g_m=ρk_c'));
  assert.ok(term('convective-mass-transfer-coefficient').detail.includes('g_m'));
});
test('R5-11-003: Couette entries state the stagnant-film main line of book 11.8',()=>{
  assert.ok(note('11.8').relation.includes('指数型'));
  assert.ok(term('couette-flow').detail.includes('停滞膜'));
  assert.ok(term('couette-linear-velocity-profile').detail.includes('停滞膜'));
  assert.equal(sq('supp-section-11-8').revision,'v2');
});
test('R5-11-004: supplement glossary entries tied to book sections disclose they are beyond the book',()=>{
  for(const id of ['knudsen-number-pores','knudsen-diffusion','bosanquet-diffusion-approximation','porous-medium-porosity','porous-medium-tortuosity','effective-diffusion-porous-medium','turbulent-schmidt-number','turbulent-species-diffusivity']){
    assert.ok(term(id).detail.includes('原典第11章の本文にはない'),id);
  }
});
test('R5-11-005: lesson 11.6 marks the Sc upper bound as an app operational range, not a physical limit',()=>{
  assert.ok(lessonText('11.6').includes('物理的な上限ではない'));
});
test('batch3 guards: totals unchanged and changed section questions are versioned consistently in both files',()=>{
  assert.equal(questions.length,751);
  // 470 at batch-3 time; B-4 added five source-verified terms (475);
  // the 2026-11-07 expansion added 29 more source-verified terms (504).
  assert.equal(glossary.length,504);
  const changed=['supp-section-5-6','supp-section-6-2','supp-section-6-6','supp-section-7-6','supp-section-9-4','supp-section-10-5','supp-section-11-8'];
  for(const id of changed){
    assert.equal(q(id).revision,sq(id).revision,id);
    assert.ok(q(id).reportHistory.length>0,id);
  }
});
