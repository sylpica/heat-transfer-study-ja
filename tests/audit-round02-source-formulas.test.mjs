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
  close(value(curvature.expression.split('=')[1],{'NuD,Bromley':100,'R′':.25}),100*(.715+.263/.25)*.25**.25);
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
