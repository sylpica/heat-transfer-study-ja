import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Fixes for Codex round-5 findings C5-S01..S04 (P2) and C5-N01 (P3),
// implemented by Muse on audit/integration-loop3, 2026-11-10.
// Each finding was verified against the original page image before the
// fix (PDF 322/323, 453/454, 459-461, 506/507, 435/436, 515/516).
// Codex's report: docs/audit/codex-round-05/REPORT.md on branch
// audit/codex-round-05 (b6c919a).

const section=async id=>JSON.parse(await readFile(new URL(`../data/sections/${id}-ja.json`,import.meta.url),'utf8'));
const MAC='\u0304';
const close=(actual,expected,tol)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} != ${expected} (tol ${tol})`);

test('C5-S01: §6.5 average-coefficient paragraph keeps local h local (PDF 322/323)',async()=>{
  const s=await section('6-5');
  const t=s.blocks[32].text;
  // First sentence of the printed paragraph defines the LOCAL coefficient.
  assert.ok(t.startsWith('熱伝達係数 h は、q と ΔT という2つの量の比であり'), t.slice(0,40));
  // The designates sentence: h̄ = q̄/ΔT (uniform Tw), h̄ = q/ΔT̄ (uniform qw).
  assert.ok(t.includes(`h${MAC} という用語は、壁温一様問題における q${MAC}/ΔT、または壁熱流束一様問題における q/ΔT${MAC} のどちらかを指す`));
  // The displayed definitions (6.65)/(6.66) were already correct and stay so.
  assert.ok(s.blocks[33].expression.includes(`h${MAC} ≡ q${MAC}/ΔT`));
  assert.ok(s.blocks[34].expression.includes(`h${MAC} ≡ q/ΔT${MAC}`));
});

test('C5-S02: Example 8.5 carries the 6/5 power on both left-hand terms (PDF 453)',async()=>{
  const s=await section('8-4');
  const t=s.blocks[29].text;
  assert.ok(t.includes(`(Nu${MAC}D)^(6/5) = (qwD/(ΔT${MAC}k))^(6/5) = 0.82(Ra*_D)^(1/5)Pr^0.034`), t.slice(t.indexOf('置き換える'), t.indexOf('置き換える')+110));
  assert.ok(!t.includes('の変換形'));
  // Downstream displays use the same mean temperature difference.
  assert.ok(t.includes(`ΔT${MAC} = [1.18·qwD/k]`));
  assert.ok(t.includes(`補正された ΔT${MAC} = ((1.18)(577)(0.17)/0.03136)`));
  assert.ok(t.includes('= 131 K となる'));
  // Numeric: the book's rounded substitution reproduces ΔT = 144 K.
  const qw=661, D=0.17, k=0.02623, beta=1/300, nu=1.578e-5, alpha=2.213e-5, Pr=0.713, g=9.8;
  const dT=(1.18*qw*D/k)/(((g*beta*qw*D**4/(k*nu*alpha))**(1/6))*Pr**0.028);
  close(dT,144,1.5);
  // And the transformed identity is consistent: NūD from the 6/5 form
  // equals qwD/(ΔT̄k) at that ΔT.
  const RaStar=g*beta*qw*D**4/(k*nu*alpha);
  const NuFromPower=(0.82*RaStar**(1/5)*Pr**0.034)**(5/6);
  const NuFromDT=qw*D/(dT*k);
  close(NuFromPower/NuFromDT,1,0.01);
});

test('C5-S03: eq. (8.60) stays as printed, with a translator note separating the two normalizations (PDF 459-461)',async()=>{
  const s=await section('8-5');
  const b859=s.blocks.find(b=>b.number==='8.59');
  const e=b859.explanation;
  // Printed (8.60) claim is kept verbatim in the translation.
  assert.ok(e.includes('Nux/Π_4^(1/4) = fn(Ja, Pr) → Ja → 0 のとき 1（式(8.60)）'));
  // The note records the book's own inconsistency and the figure's form.
  assert.ok(e.includes('訳注：式(8.60)の「Ja → 0 のとき 1」は式(8.59)（Nux = 0.707·Π_4^(1/4)）と整合しない'));
  assert.ok(e.includes('Nux/(Π_4/4)^(1/4)'));
  assert.ok(e.includes('原典の印刷上の不整合であり、式(8.60)自体は原典どおりに掲げている'));
  // The note's arithmetic: 4^(-1/4) = 0.70711 = the (8.59) coefficient.
  close(4**(-1/4),0.7071,0.0001);
  // Eq. (8.59) itself (this block's expression) is the 0.707 form.
  assert.ok(b859.expression.startsWith('Nux = 0.707·'));
});

test('C5-S04: §9.3 intermediate substitution keeps the nested radical and the pi/16 area ratio (PDF 506/507)',async()=>{
  const s=await section('9-3');
  const e=s.blocks[17].explanation;
  assert.ok(e.includes('qmax = ρghfg·√{(2πσ/ρg)·(1/(2π√3))·√(g(ρf − ρg)/σ)}·(π/16)'), e.slice(e.indexOf('式(9.9)は'), e.indexOf('式(9.9)は')+130));
  assert.ok(!e.includes('√(2πσ/(ρgλd1))'));
  // Numeric: the printed intermediate equals eq. (9.11) up to the
  // unrounded coefficient (pi/16)*3^(-1/4) = 0.149193... vs 0.149.
  const rhoG=0.5976, rhoF=958.4, hfg=2.257e6, sigma=0.0589, g=9.81;
  const intermediate=rhoG*hfg*(Math.PI/16)*Math.sqrt((2*Math.PI*sigma/rhoG)*(1/(2*Math.PI*Math.sqrt(3)))*Math.sqrt(g*(rhoF-rhoG)/sigma));
  const eq911=0.149*Math.sqrt(rhoG)*hfg*(g*(rhoF-rhoG)*sigma)**(1/4);
  close(intermediate/eq911,(Math.PI/16)*3**(-1/4)/0.149,0.003);
});

test('C5-N01: residual mean-symbol overlines restored per-instance (PDF 435/436, 515/516)',async()=>{
  const s83=await section('8-3');
  const t=s83.blocks[16].text;
  assert.ok(t.includes(`式(8.13a)から h${MAC} を得る。Nu${MAC}L が`));
  assert.ok(t.includes(`h${MAC} = 0.67(k/L)`));
  assert.ok(t.includes(`h${MAC} ∝ ΔT^(1/4) であり`));
  assert.ok(t.includes(`自然対流における h${MAC} の温度依存性は、一定の h${MAC} から生じた`));

  const s94=await section('9-4');
  assert.ok(s94.blocks[1].text.includes(`Nu${MAC}D ≡ h${MAC}D/kg`));
  assert.ok(s94.blocks[2].expression.startsWith(`Nu${MAC}D = 0.62·`));
  assert.ok(s94.blocks[4].expression.startsWith(`Nu${MAC}D = 0.67·`));
  const e4=s94.blocks[4].explanation;
  assert.ok(e4.includes(`h${MAC}total = h${MAC}boiling + (3/4)h${MAC}rad（h${MAC}rad < h${MAC}boiling の場合）`));
  assert.ok(e4.includes(`放射熱伝達係数 h${MAC}rad を`));
  assert.ok(e4.includes(`垂直板に対する h${MAC} の非常に満足のいく予測`));
  assert.ok(s94.blocks[5].expression.startsWith(`Nu${MAC}D = [`));
  assert.ok(s94.blocks[5].expression.includes(`Nu${MAC}D,Bromley`));
});
