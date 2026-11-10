import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Fix batch F-B (chapters 6-8) of the full-page collation campaign,
// 2026-11-10. Each test reads the actual section data and checks the
// displayed form against the printed original (A Heat Transfer
// Textbook, 6th ed.) or the campaign record value.

const section=async id=>JSON.parse(await readFile(new URL(`../data/sections/${id}-ja.json`,import.meta.url),'utf8'));
const raw=async id=>await readFile(new URL(`../data/sections/${id}-ja.json`,import.meta.url),'utf8');
const MAC='\u0304', ARROW='\u20d7';

// Evaluate a displayed arithmetic segment written in the app's linear
// notation. Only the small subset used by the displays below is handled.
function value(text,scope={}){
  let code=text
    .replace(/×/g,'*').replace(/·/g,'*').replace(/−/g,'-')
    .replace(/10\^\((-?\d+)\)/g,'10**($1)')
    .replace(/10⁻⁷/g,'1e-7')
    .replace(/[\[{]/g,'(').replace(/[\]}]/g,')')
    .replace(/\s/g,'');
  for(const [name,val] of Object.entries(scope)) code=code.replaceAll(name,`(${val})`);
  code=code.replace(/(\d|\))\(/g,'$1*(').replace(/\^/g,'**');
  assert.ok(!/[^0-9a-zA-Z.+*/(),eE-]/.test(code),code);
  for(const word of code.match(/[A-Za-z]+/g)||[]) assert.ok(word==='tanh'||word==='e',word);
  return Function('tanh',`return (${code});`)(Math.tanh);
}
const close=(actual,expected,tol)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} != ${expected} (tol ${tol})`);

test('CF-002: eq. (7.29) puts the 1.7*Gz^(-2/3) term inside the tanh and reproduces the recorded values',async()=>{
  const b=(await section('7-2')).blocks.find(x=>x.number==='7.29');
  assert.ok(b.expression.includes('tanh[2.264·Gz^(−1/3) + 1.7·Gz^(−2/3)]'),b.expression);
  assert.ok(!b.expression.includes('{1 + 1.7'),b.expression);
  const rhs=b.expression.split('=')[1];
  // Printed form recorded in CAMPAIGN_W3C2 (W3C2-02, PDF 376 image):
  // Nu_D = 3.657/tanh(2.264 Gz^-1/3 + 1.7 Gz^-2/3) + 0.0499 Gz tanh(Gz^-1)
  close(value(rhs,{Gz:11.8}),4.2659,5e-4);
  close(value(rhs,{Gz:50}),3.657/Math.tanh(2.264*50**(-1/3)+1.7*50**(-2/3))+0.0499*50*Math.tanh(1/50),1e-9);
});

test('CF-004: Example 7.1 rearrangement multiplies the bracketed difference by uav*k/(4*qw*alpha)',async()=>{
  const t=(await section('7-2')).blocks[38].text;
  assert.ok(t.includes('L/D = [54 − 11qwD/(48k)]·[uav·k/(4qwα)]'),t.slice(0,60));
  assert.ok(!t.includes('[11qwD/(48k)]/[4qwα/(uav·k)]'));
  const seg=t.split('数値的には L/D = ')[1].split(' = 1788')[0];
  const v=value(seg);
  close(v,1787.59,0.01); // printed result 1788; the old bracketing gave -20.12
  assert.ok(v>0);
});

test('CF-014: Example 7.7 overall coefficient carries the printed prefactor 1/A_inside',async()=>{
  const t=(await section('7-5')).blocks[9].text;
  assert.ok(t.includes('U = (1/Ainside)[1/(hA)inside + Rt,wall + 1/(hA)outside]^{−1}'));
  // Printed form U = (1/A_i)[1/(hA)_i + R_t,wall + 1/(hA)_o]^-1 with
  // A_i = A_o = A, R_t,wall neglected, h_i = 4.371, h_o = 5 must give
  // the value the same paragraph states, 2.332 W/m^2 K, for any A.
  const A=2.3, hi=4.371, ho=5;
  const U=(1/A)*(1/(hi*A)+1/(ho*A))**(-1);
  close(U,2.332,1e-3);
});

test('CF-003: section 6.8 opening display defines the constant by underbrace and has no trailing equality',async()=>{
  const t=(await section('6-8')).blocks[3].text;
  assert.ok(t.includes('−（乱流混合を反映する別の定数 ≡ ρcp·εh）(∂T̄/∂y)。'),t);
  assert.ok(!t.includes('= −ρcp·εh(∂T̄/∂y) の形'));
});

test('CF-030: section 6.4 restores all nine C-bar (mean molecular speed) instances, constants C1/C2 unbarred',async()=>{
  const text=await raw('6-4');
  assert.equal((text.match(new RegExp(`C${MAC}`,'g'))||[]).length,9);
  const d=await section('6-4');
  assert.ok(d.blocks[11].expression.includes(`C₁·ρC${MAC}ℓ`));
  assert.ok(d.blocks[13].expression.includes(`ν = C₁·C${MAC}ℓ`));
});

test('CF-048/CF-052: section 6.2 vector arrows and held-variable subscripts restored',async()=>{
  const text=await raw('6-2');
  assert.equal((text.match(new RegExp(ARROW,'g'))||[]).length,17);
  const d=await section('6-2');
  assert.equal(d.blocks[12].expression,'v ≡ −(∂ψ/∂x)|_y、u ≡ (∂ψ/∂y)|_x');
  assert.ok(d.blocks[15].expression.startsWith(`∇·u${ARROW} ≡`));
  assert.ok(d.blocks[3].text.includes(`u${ARROW} = u·ı${ARROW} + v·ȷ${ARROW} + w·k${ARROW}`));
  // CF2-045/C05-13: the (6.9) differential now stands as its own display block
  // (print juxtaposition, no inserted dots) following the split paragraph.
  assert.equal(d.blocks.find(b=>b.number==='6.9').expression,'dψ = (∂ψ/∂x)|_y dx + (∂ψ/∂y)|_x dy = 0');
  assert.ok(d.blocks[17].text.includes('u∞ = (∂ψ/∂y)|_x、0 = −(∂ψ/∂x)|_y'));
});

test('CF-049: section 6.3 vector arrows restored in eqs. (6.36)-(6.38) and prose, RHS components stay plain',async()=>{
  const text=await raw('6-3');
  assert.equal((text.match(new RegExp(ARROW,'g'))||[]).length,18);
  const d=await section('6-3');
  assert.equal(d.blocks[12].expression,`∂T/∂t + u${ARROW}·∇T = ∂T/∂t + u·∂T/∂x + v·∂T/∂y + w·∂T/∂z ≡ DT/Dt`);
  assert.ok(d.blocks[8].expression.includes(`ρĥ(u${ARROW}·n${ARROW})dS`));
  assert.ok(d.blocks[6].items[1].includes(`∇·u${ARROW} = 0`));
});

test('CF-046 (6.3/6.7 instances): printed glyph is U+2245, not U+224A',async()=>{
  const d3=await section('6-3');
  assert.ok(d3.blocks[22].text.includes('ν ≅ α'));
  assert.ok(!d3.blocks[22].text.includes('≊'));
  const d7=await section('6-7');
  assert.ok(d7.blocks[19].text.includes('u′ ≅ ℓ(∂ū/∂y)'));
  assert.ok(!d7.blocks[19].text.includes('≊'));
});

test('CF-013/CF-031/CF-054/CF-055/CF-077/CF-078: section 6.7 symbol and wording fixes',async()=>{
  const d=await section('6-7');
  assert.equal(d.blocks[7].expression,'ū ≡ (1/T)∫₀^T u dt');           // CF-055
  assert.ok(d.blocks[9].text.includes('ここで u は実際の局所速度'));        // CF-013
  assert.ok(d.blocks[12].text.includes(`ρC${MAC}·ℓ(∂u/∂y)`));            // CF-031
  assert.ok(d.blocks[13].items[2].startsWith(`C${MAC} は、`));            // CF-031
  assert.ok(d.blocks[19].text.includes('ū が y 方向に増加し'));            // CF-031 (ū first occurrence)
  assert.equal(d.blocks[15].expression,'τyx′ =（定数）·ρ[(v̄ + v′)·u′]'); // CF-077
  assert.ok(d.blocks[15].explanation.includes('(v̄u′ + v′u′)'));           // CF-078
  assert.ok(!d.blocks[15].explanation.includes('の平均項'));
  assert.ok(d.blocks[41].text.includes('10⁶ ≤ Rex ≤ 10⁹'));               // CF-054
  assert.ok(!d.blocks[41].text.includes('≲'));
});

test('CF-032: section 7.3 prose bars exactly one Nu_D (Bhatti-Shah sentence); other correlations stay unbarred',async()=>{
  const d=await section('7-3');
  assert.equal((d.blocks[4].text.match(new RegExp(MAC,'g'))||[]).length,1);
  assert.ok(d.blocks[4].text.includes(`に対する Nu${MAC}D に対して`));
});

test('CF-033/CF-034: h-bar restored in 7.4 introduction (x4) and in the single 7.5 instance',async()=>{
  const d4=await section('7-4');
  assert.equal((d4.blocks[1].text.match(new RegExp(MAC,'g'))||[]).length,4);
  assert.ok(d4.blocks[1].text.includes(`= h${MAC}A(LMTD)`));
  const text5=await raw('7-5');
  assert.equal((text5.match(new RegExp(MAC,'g'))||[]).length,1);
  const d5=await section('7-5');
  assert.ok(d5.blocks[9].text.includes(`式(7.59b)で h${MAC} を U に`));
});

test('CF-084/CF-085: section 6.1 mu wording and Fig. 6.19 caption duplication',async()=>{
  const d1=await section('6-1');
  assert.ok(d1.blocks[13].text.includes('kg/(m·s) の粘度（dynamic viscosity）'));
  assert.ok(!d1.blocks[13].text.includes('の動粘度（dynamic viscosity）'));
  const d8=await section('6-8');
  assert.ok(d8.blocks[14].caption.includes('u′r は自由流れにおける'));
  assert.ok(!d8.blocks[14].caption.includes('自由流れ流れ'));
});
