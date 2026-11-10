import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Fixes for the full-page collation campaign #2, line A (chapters 1-5),
// implemented by Muse on branch audit/fix-campaign2-a, 2026-11-10.
// Fix list: docs/audit-final/campaign2/CAMPAIGN2_FIX_LIST_20261110.md
// Record:   docs/audit-collation/CAMPAIGN2_FIX_A_20261110.md
// Every displayed form below was verified against the original page
// image (AHTTv600.pdf) before the fix.

const section=async id=>JSON.parse(await readFile(new URL(`../data/sections/${id}-ja.json`,import.meta.url),'utf8'));
const chapter=async id=>JSON.parse(await readFile(new URL(`../data/chapter-problems/chapter-${id}.json`,import.meta.url),'utf8'));
const close=(actual,expected,tol)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} != ${expected} (tol ${tol})`);

test('CF2-001: Drake effectiveness formula (problem 3.38) is the printed product form, not a quotient',async()=>{
  const ch=await chapter('03');
  const pr=ch.problems.blocks.find(p=>p.id==='problem-3-38');
  const expr=pr.formulaBlocks[0].expression;
  assert.equal(expr,'ε ≃ 1 − exp{[exp(−NTU^0.78 R) − 1](NTU^0.22/R)}');
  // Evaluate both candidate forms at NTU = 2, R = 0.5.
  const eps=(NTU,R,product)=>{
    const inner=Math.exp(-(NTU**0.78)*R)-1;
    const factor=product?(NTU**0.22)/R:(NTU**0.22)*R;
    return 1-Math.exp(product?inner*factor:inner/factor);
  };
  close(eps(2,0.5,true),0.7386,2e-3);   // printed product form
  close(eps(2,0.5,false),0.6281,2e-3);  // former (wrong) quotient form
  assert.ok(Math.abs(eps(2,0.5,true)-eps(2,0.5,false))>0.05);
});

test('CF2-009: problem 5.63 asymptotic is e^{x^2} erfc x, which the stated limit actually describes',async()=>{
  const ch=await chapter('05');
  const pr=ch.problems.blocks.find(p=>p.id==='problem-5-63');
  assert.ok(pr.text.includes('e^{x²} erfc x ∼ 1/(√π x)'));
  assert.ok(!pr.text.includes('e^x erfc x'));
  // Abramowitz & Stegun 7.1.26 (|error| <= 1.5e-7).
  const erfc=x=>{
    const t=1/(1+0.3275911*x);
    const poly=((((1.061405429*t-1.453152027)*t+1.421413741)*t-0.284496736)*t+0.254829592)*t;
    return poly*Math.exp(-x*x);
  };
  const relErr=(f,x)=>Math.abs(f(x)-1/(Math.sqrt(Math.PI)*x))/(1/(Math.sqrt(Math.PI)*x));
  const good=x=>Math.exp(x*x)*erfc(x);
  const bad=x=>Math.exp(x)*erfc(x);
  assert.ok(relErr(good,3)<0.06,`e^{x^2} form at x=3: ${relErr(good,3)}`);
  assert.ok(relErr(good,4)<relErr(good,3),'asymptotic improves with x');
  assert.ok(relErr(bad,3)>0.9,`e^x form at x=3: ${relErr(bad,3)}`);
});

test('CF2-007: eq. (5.32) display exists in section 5.3 and its orthogonality content evaluates correctly',async()=>{
  const s=await section('5-3');
  const f=s.blocks.find(b=>b.type==='formula'&&b.number==='5.32');
  assert.ok(f,'eq. (5.32) formula block present');
  assert.equal(f.expression,'∫₀² sin((mπ/2)ξ) dξ = Σ(n=1→∞) Gn ∫₀² sin((mπ/2)ξ) sin((nπ/2)ξ) dξ');
  // Simpson integration on [0, 2].
  const simpson=(g,n=2000)=>{
    const h=2/n; let sum=g(0)+g(2);
    for(let i=1;i<n;i++) sum+=(i%2?4:2)*g(i*h);
    return sum*h/3;
  };
  close(simpson(x=>Math.sin(Math.PI*x/2)*Math.sin(2*Math.PI*x/2)),0,1e-9); // m=1, n=2 -> 0
  close(simpson(x=>Math.sin(3*Math.PI*x/2)**2),1,1e-9);                    // m=n=3 -> 1
  close(simpson(x=>Math.sin(Math.PI*x/2)),4/Math.PI,1e-9);                 // LHS for m=1 -> Gn = 4/(n pi)
});

test('CF2-045/C03-33: section 4.5 intermediate display reduces to eq. (4.41)',async()=>{
  const s=await section('4-5');
  const f=s.blocks.find(b=>b.type==='formula'&&b.expression.startsWith('Θ = [e^{−mL(1−ξ)}'));
  assert.ok(f,'intermediate display present');
  const mid=(mL,xi)=>(Math.exp(-mL*(1-xi))+(2*Math.cosh(mL))*Math.exp(-mL*xi)-Math.exp(-mL*(1+xi)))/(2*Math.cosh(mL));
  const fin=(mL,xi)=>Math.cosh(mL*(1-xi))/Math.cosh(mL);
  for(const [mL,xi] of [[0.8656,0],[0.8656,0.5],[0.8656,1],[2.3,0.25]]) close(mid(mL,xi),fin(mL,xi),1e-12);
});

test('CF2-048: eqs. (4.20)/(4.22) carry subscripts on the temperature factors and no inserted product dots',async()=>{
  const s=await section('4-4');
  const e420=s.blocks.find(b=>b.number==='4.20');
  assert.equal(e420.expression,'h̄₁(T₁ − T)_{x=0} = −k (dT/dx)|_{x=0}、　h̄₂(T − T₂)_{x=L} = −k (dT/dx)|_{x=L}');
  const e422=s.blocks.find(b=>b.number==='4.22');
  assert.equal(e422.expression,'Bi₁(1 − Θ_{ξ=0}) = −Θ′_{ξ=0}、　Bi₂Θ_{ξ=1} = −Θ′_{ξ=1}');
});

test('CF2-047: eq. (5.43) has no product dot before exp, while eq. (5.42) keeps its printed dots',async()=>{
  const s=await section('5-5');
  const e543=s.blocks.find(b=>b.number==='5.43');
  assert.ok(e543.expression.includes('D₁ exp(−λ̂₁²Fo)'));
  assert.ok(!e543.expression.includes('D₁·exp'));
  const e542=s.blocks.find(b=>b.number==='5.42');
  assert.ok(e542.expression.includes('·exp'),'eq. (5.42) printed dots retained');
});

test('CF2-045: campaign-2 restored intermediate displays are present (4.2 annotated forms, 5.2 O-1/O-2)',async()=>{
  const s42=await section('4-2');
  assert.ok(s42.blocks.some(b=>b.type==='formula'&&b.expression.startsWith('∂²T/∂x² + ∂²T/∂y²')));
  assert.ok(s42.blocks.some(b=>b.type==='formula'&&b.expression.startsWith('(1/r) ∂/∂r (r ∂T/∂r)')));
  assert.ok(s42.blocks.some(b=>b.type==='formula'&&b.expression.startsWith('∇²T + q̇/k')));
  const s52=await section('5-2');
  assert.ok(s52.blocks.some(b=>b.type==='formula'&&b.expression.startsWith('𝒯₁𝒯₂ d²T₁/dt²')));
  assert.ok(s52.blocks.some(b=>b.type==='formula'&&b.expression.startsWith('0 = [−b/2 + √((b/2)² − c)]C₁')));
});
