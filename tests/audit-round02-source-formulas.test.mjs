import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const section=async id=>JSON.parse(await readFile(new URL(`../data/sections/${id}-ja.json`,import.meta.url),'utf8'));
const equation=async(id,number)=>(await section(id)).blocks.find(b=>b.number===number);
// Interpret the actual displayed arithmetic, not a second hard-coded copy
// of the translation. Only the small notation subset used below is accepted.
function value(text,scope){
  let code=text.replace(/sin²φ/g,'(sin(φ))^2').replace(/sin φ/g,'sin(φ)')
    .replace(/tan⁻¹/g,'atan').replace(/√([A-Za-z]+)/g,'sqrt($1)').replace(/√\[/g,'sqrt[').replace(/√\(/g,'sqrt(')
    .replace(/²/g,'^2').replace(/³/g,'^3');
  const functions=['sqrt','sin','atan','ln'];
  const escaped=Object.keys(scope).sort((a,b)=>b.length-a.length).map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  code=code.replace(new RegExp([...functions,...escaped].join('|'),'g'),name=>functions.includes(name)?name:`(${scope[name]})`);
  code=code.replace(/π/g,'PI').replace(/·/g,'*').replace(/−/g,'-').replace(/[\[{]/g,'(').replace(/[\]}]/g,')').replace(/\s/g,'')
    .replace(/(\d|\))\(/g,'$1*(').replace(/PI\(/g,'PI*(').replace(/(\d|\))(?=(?:sqrt|sin|atan|ln)\()/g,'$1*').replace(/\^/g,'**');
  assert.ok(!/[^\w.+*/(),-]/.test(code),code);
  for(const word of code.match(/[A-Za-z_]\w*/g)||[])assert.ok(['sqrt','sin','atan','ln','PI'].includes(word),word);
  return Function('sqrt','sin','atan','ln','PI',`return (${code});`)(Math.sqrt,Math.sin,Math.atan,Math.log,Math.PI);
}
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);

test('translated liquid-metal tube-bank geometry multiplies the whole Nu term and places C under the root',async()=>{
  const b=await equation('7-6','7.74');
  const actual=value(b.expression.split('=')[1],{PeD:100,C:.8,P:1.5,D:1,φ:Math.PI/2});
  close(actual,(4.60+.193*100**.614)*Math.sqrt(.8/3));
  assert.equal(b.pdfPage,410);
});
test('uniform-flux natural convection retains Pr and distinguishes printed mean coefficient from independent derivation',async()=>{
  const a=await equation('8-4','8.44a'),b=await equation('8-4','8.44b');
  const factor=(1e6*7/(4+9*Math.sqrt(7)+70))**.2;
  close(value(a.expression.split('=')[1],{'Ra*_x':1e6,Pr:7}),.630*factor);
  close(value(b.expression.split('=')[1],{'Ra*_L':1e6,Pr:7}),1.2*factor);
  assert.match(b.explanation,/原典印刷式/);assert.match(b.explanation,/独立導出/);assert.match(b.explanation,/0\.630/);
});
test('natural-convection integral balances agree and thickness grows as x to the one-quarter power',async()=>{
  const coefficient=await equation('8-3','8.23'),thickness=await equation('8-3','8.22');
  const Pr=.7,G=1e9;
  const C1=value(coefficient.expression.split('=')[1],{Pr});
  // Independent momentum and energy integral balances must predict the
  // same derivative of delta^4, not just plausible positive coefficients.
  close(84*(1/3-C1)/(C1*C1*G),80/(C1*Pr*G));
  // Reduce the dimensional G factor before interpreting displayed algebra.
  const displayed=thickness.expression.split('=')[1].replace('gβ(Tw − T∞)/ν²','G');
  const a=value(displayed,{C1,Pr,G,x:.1}),b=value(displayed,{C1,Pr,G,x:.2});
  close(b/a,2);close(a,80/(C1*Pr*G)*.1);
  let integral=0;const n=10000;
  for(let i=0;i<n;i++){const eta=(i+.5)/n;integral+=eta**2*(1-eta)**4/n;}
  close(integral,1/105);
});
test('film-boiling curvature and jet CHF retain the distinct powers and geometric factor',async()=>{
  const curvature=await equation('9-4','9.32'),jet=await equation('9-7','9.40');
  close(value(curvature.expression.split('=')[1],{'NūD,Bromley':100,'R′':.25}),100*(.715+.263/.25)*.25**.25);
  close(value(jet.expression.split('=')[1],{r:100,djet:.01,D:.04,WeD:10,A:.3}),(.21+.17)*.25**(1/3));
});
test('crossflow effectiveness stays bounded and multiple shell passes exponentiate the entire ratio',async()=>{
  const list=(await section('3-3')).blocks.find(b=>b.type==='list'&&b.items[0].startsWith('表3.1'));
  const rhs=list.items[1].split('≃')[1].split('（')[0];
  const e=value(rhs,{R:.5,NTU:2});
  assert.ok(e>0&&e<1,`effectiveness ${e}`);
  close(e,1.22*(1-(.92+(Math.PI*.5**.15*2)**1.25)**(-.4)));
  const z=value(list.items[6].split('Z = ')[1].split(' と置く')[0],{'ε_p':.5,R:.5,N:2});
  close((z-1)/(z-.5),5/7);
});
test('view-factor table retains positive perpendicular-strip and cylinder-strip factors',async()=>{
  const list=(await section('10-3')).blocks.find(b=>b.type==='list'&&b.items[0].startsWith('表10.2'));
  const corner=value(list.items[3].split('=')[1],{h:1,w:1});
  close(corner,1-1/Math.sqrt(2));assert.ok(corner>0&&corner<1);
  const cylinder=value(list.items[5].split('=')[1].split('。')[0],{r:.1,b:1,a:0,c:1});
  // Integrate the cylinder-strip kernel independently by midpoint quadrature.
  const n=10000;let integral=0;for(let i=0;i<n;i++){const x=(i+.5)/n;integral+=.1/(1+x*x)/n;}
  assert.ok(Math.abs(cylinder-integral)<1e-10);
});
test('the completed perpendicular-rectangle table agrees with independent view-factor integration',async()=>{
  const list=(await section('10-3')).blocks.find(b=>b.type==='list'&&b.items[0].startsWith('表10.3'));
  const actual=value(list.items[2].split('F1–2 = ')[1].split('。')[0],{H:1,W:1,S:2});
  close(actual,.20004377607540316);
  // Analytically integrate the common-edge coordinate first; integrate the
  // remaining two physical coordinates with midpoints (corner singularity).
  const n=256;let integral=0;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
    const y=(i+.5)/n,z=(j+.5)/n,a=Math.hypot(y,z);
    integral+=y*z*Math.atan(1/a)/(Math.PI*a**3*n*n);
  }
  assert.ok(Math.abs(actual-integral)<.001,'independent geometric quadrature');
});
test('gray-body transfer reciprocity and insulated third-wall resistance are evaluable',async()=>{
  const transfer=await equation('10-4','10.29'),network=await equation('10-4','10.35');
  close(value(transfer.expression.split('=').at(-1),{A1:1,A2:4,'ε1':.8,'ε2':.6}),3/17);
  const actual=value(network.expression.split('=')[1],{eb1:100,eb2:0,A1:1,A2:1,'ε1':.5,'ε2':.5,'F1–3':.8,'F2–3':.8,'F1–2':.2});
  // Eliminate the adiabatic radiosity J3=(J1+J2)/2 from the node equations.
  const difference=100/(1+2*(.2+.8/2)),j1=(100+difference)/2;
  close(actual,100-j1);
});
test('Churchill-Chu full-range correlation (8.13b) applies the 8/27 power to the denominator bracket only',async()=>{
  const b=await equation('8-3','8.13b');
  const actual=value(b.expression.split('=')[1],{RaL:6.78e7,Pr:.710});
  close(actual,(0.825+0.387*6.78e7**(1/6)/(1+(0.492/.710)**(9/16))**(8/27))**2);
  close(actual,54.40653390374691);
});
test('film-condensation velocity profile (8.51) keeps the factor 2 in the bracket and integrates to (8.53)',async()=>{
  const b=await equation('8-5','8.51');
  const rhs=b.expression.split('=')[1];
  // Water film at 100 °C (ρf = 958, ρg = 0.6 kg/m³, ν = 2.94e-7 m²/s),
  // δ = 0.1 mm: the printed profile gives u(δ) = 0.1667 m/s; the former
  // half-size bracket gave exactly half of this. The interpreter cannot
  // take e-notation literals, so δ and ν are scaled ×10 and ×1000 here
  // (u ∝ δ²/ν), making the evaluated value exactly 1/10 of 0.16673 m/s.
  close(value(rhs,{ρf:958,ρg:.6,ν:2.94e-4,g:9.81,δ:1e-3,y:1e-3}),0.01667322440458438);
  // With a unit prefactor the displayed shape is 2s − s² (s = y/δ):
  // 3/4 at s = 1/2, and Simpson integration reproduces eqn. (8.53).
  const unit={ρf:1,ρg:0,ν:.5,g:1,δ:1};
  close(value(rhs,{...unit,y:.5}),.75);
  const n=1000;let sum=0;
  for(let i=0;i<=n;i++){const w=i===0||i===n?1:(i%2?4:2);sum+=w*value(rhs,{...unit,y:i/n});}
  const massFlow=value((await equation('8-5','8.53')).expression.split('=').at(-1),unit);
  close(massFlow,2/3);
  close(sum/(3*n),massFlow);
});
test('integral energy equation (6.51) multiplies by u∞(Tw − T∞) instead of dividing by it',async()=>{
  const b=(await section('6-5')).blocks.find(b=>b.text&&b.text.includes('式(6.51)'));
  assert.ok(!b.text.includes('(1/(u∞(Tw − T∞)))'));
  const factor=b.text.split('まず(6.47)を、')[1].split('·d/dx')[0];
  assert.equal(factor,'(u∞(Tw − T∞))');
  close(value(factor,{'u∞':2,Tw:310,'T∞':300}),20);
});
test('the (6.5) φ relation divides 0.9638 by a square root, solving to φ ≈ 1.0001 at Pr = 1 and ≈ 0.4551 at Pr = 10',async()=>{
  const b=(await section('6-5')).blocks.find(b=>b.text&&b.text.includes('0.9638'));
  const rhs=b.text.split('φ = ')[1].split(' の関係')[0];
  assert.equal(rhs,'0.9638/√(Pr·φ·(1 − φ²/14))');
  // Solve the displayed implicit relation φ = rhs(φ) by bisection; the
  // right side decreases monotonically on the bracket for both Pr values.
  const solve=Pr=>{
    let lo=.01,hi=1.4;
    for(let i=0;i<200;i++){const mid=(lo+hi)/2;if(value(rhs,{Pr,φ:mid})>mid)lo=mid;else hi=mid;}
    return (lo+hi)/2;
  };
  assert.ok(Math.abs(solve(1)-1.0001282603667153)<1e-9,`${solve(1)}`);
  assert.ok(Math.abs(solve(10)-0.45514456154851755)<1e-9,`${solve(10)}`);
});
test('Table 9.3 small flat heater row is linear in λd1²Nj/Aheater with no square root',async()=>{
  const list=(await section('9-3')).blocks.find(b=>b.type==='list'&&b.items[0].startsWith('表9.3'));
  const rhs=list.items[2].split('：')[1].split('（')[0];
  assert.equal(rhs,'1.14·(λd1²Nj/Aheater)');
  // Printed form: ratio 0.25 → 0.285 and ratio 0.04 → 0.0456 (the former
  // spurious square root gave 0.570 and 0.228, 2× and 5× too large).
  close(value(rhs,{'λd1':.5,Nj:4,Aheater:4}),1.14*.25);
  close(value(rhs,{'λd1':.2,Nj:1,Aheater:1}),1.14*.04);
});
test('mean-quantity overlines are restored in (4.49) and in the sphere correlations (8.32) and (8.33)',async()=>{
  const fin=await equation('4-5','4.49');
  assert.ok(fin.expression.includes('√(kAh̄P)'),fin.expression);
  const yuge=await equation('8-4','8.32'),churchill=await equation('8-4','8.33');
  assert.ok(yuge.expression.startsWith('NūD'),yuge.expression);
  assert.ok(churchill.expression.startsWith('NūD'),churchill.expression);
});
test('Churchill-Ozoe correlations (6.63) and (6.73) apply the 1/4 power to the denominator bracket only',async()=>{
  const a=await equation('6-5','6.63'),b=await equation('6-5','6.73');
  const rhsA=a.expression.split('、')[0].split('=')[1],rhsB=b.expression.split('、')[0].split('=')[1];
  // Printed forms (PDF 322/326): at Rex = 1e5, Pr = 0.7 the values are
  // 91.62 and 127.36; the former whole-quotient power gave 3.01 and 3.30.
  close(value(rhsA,{Rex:1e5,Pr:.7}),91.62408717594467);
  close(value(rhsB,{Rex:1e5,Pr:.7}),127.35894296017538);
});
test('uniform-heat-flux correlation (8.43b) raises Ra* to the 1/5 power and applies 16/45 to the denominator bracket only',async()=>{
  const b=await equation('8-4','8.43b');
  const rhs=b.expression.split('=')[1];
  close(value(rhs,{'Ra*_L':1e8,Pr:.7}),23.487954894159863);
  // At fixed Pr the Ra* scaling must be the 1/5 power: a factor 100 in Ra*
  // multiplies Nu by 100^(1/5) (the former whole-bracket form scaled as
  // 100^(16/45) and gave 505.09 at Ra* = 1e8).
  close(value(rhs,{'Ra*_L':1e10,Pr:.7})/value(rhs,{'Ra*_L':1e8,Pr:.7}),100**(1/5));
  assert.ok(b.expression.startsWith('NūL'),b.expression);
});
test('Bergles-Rohsenow superposition (9.37) squares the whole product (qB/qFC)(1 − qi/qB)',async()=>{
  const b=await equation('9-7','9.37');
  const rhs=b.expression.split('=')[1];
  // Printed form (PDF 523): q/qFC = sqrt(1 + [(qB/qFC)(1 − qi/qB)]^2);
  // qB/qFC = 2 with qi/qB = 1/2 gives sqrt(2) (the former narrowed square
  // gave sqrt(3) for the same inputs).
  close(value(rhs,{qFC:1,qB:2,qi:1}),Math.SQRT2);
  close(value(rhs,{qFC:1,qB:3,qi:1.5}),Math.sqrt(3.25));
});
test('Reynolds-Colburn grouping (6.74) and the uniform-flux case (6.78) put plain Rex in the left denominator',async()=>{
  const a=await equation('6-6','6.74'),b=await equation('6-6','6.78');
  const derive=expr=>{
    const [lhs,rest]=expr.split('=');
    const den=lhs.trim().replace(/^Nux\/\(/,'').replace(/\)$/,'');
    return value(rest.split('≠')[0],{Rex:1e5,Pr:.7})*value(den,{Rex:1e5,Pr:.7});
  };
  // Printed forms (PDF 327): Nux/(Rex·Pr^(1/3)) = 0.332/√Rex, hence
  // Nux = 0.332·Rex^(1/2)·Pr^(1/3). The former √(Rex) denominator made
  // Nux independent of Rex (316x too small at Rex = 1e5).
  close(derive(a.expression),.332*1e5**.5*.7**(1/3));
  close(derive(b.expression),.4587*1e5**.5*.7**(1/3));
});
test('the (6.110d) step of the log-law subtraction carries sqrt(Cf/2) in its first term',async()=>{
  const b=await equation('6-8','6.109');
  const seg=b.explanation.split('したがって ')[1].split('（式(6.110d)）')[0];
  assert.ok(seg.includes('·√(Cf/2) − √(2/Cf)'),seg);
  const radical=seg.match(/·(√\([^)]*\))/)[1];
  // Printed form (PDF 339): substituting u*/u∞ = √(Cf/2) from (6.110c)
  // puts √(Cf/2) in the first term; the former √(2/Cf) is ~619x larger
  // at the section example's Cf = 0.003232.
  close(value(radical,{Cf:.003232}),Math.sqrt(.003232/2));
});
test('mean-quantity overlines are restored in the Fig. 7.5 prose (7.3) and in Example 11.11 (11.6)',async()=>{
  const prose=(await section('7-3')).blocks[9];
  assert.equal((prose.text.match(/Nu\u0304D/g)||[]).length,5);
  assert.ok(!prose.text.includes('NuD'),prose.text);
  const ex=(await section('11-6')).blocks[19];
  assert.ok(ex.text.includes('(\u1E21m,iL)'),ex.text);
  assert.equal((ex.text.match(/\u1E21m,nap/g)||[]).length,2);
  assert.ok(ex.text.includes('n\u0304nap,s'),ex.text);
});
