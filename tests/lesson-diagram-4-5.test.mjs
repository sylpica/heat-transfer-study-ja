import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-4-5-adiabatic-fin-efficiency-effectiveness.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const numeric=(field)=>{
 const m=svg.match(new RegExp('\\b'+field+'="([^"]+)"'));
 assert.ok(m,'missing data attribute '+field);
 const number=Number(m[1]);
 assert.ok(Number.isFinite(number),'invalid numeric '+field);
 return number;
};
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,String(a)+' != '+String(b));
const p={
 k:numeric('data-k-solid'),h:numeric('data-h'),P:numeric('data-perimeter'),
 Ac:numeric('data-cross-section'),L:numeric('data-length'),
 Tb:numeric('data-base-temperature'),Tinf:numeric('data-ambient-temperature'),
 m:numeric('data-m-parameter'),mL:numeric('data-m-l'),
 q:numeric('data-base-heat'),qideal:numeric('data-ideal-side-heat'),
 qbare:numeric('data-unfinned-heat'),eta:numeric('data-efficiency'),
 eps:numeric('data-effectiveness'),Ttip:numeric('data-tip-temperature')
};

test('independent, accessible, dark-aware SVG without external resources',()=>{
 assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(svg,/viewBox="0 0 840 1360"/);
 assert.match(svg,/role="img" aria-labelledby="fin-title fin-description"/);
 assert.match(svg,/<title id="fin-title">/);
 assert.match(svg,/<desc id="fin-description">/);
 assert.match(svg,/data-origin="original-app-diagram"/);
 assert.match(svg,/data-lesson="4\.5"/);
 assert.match(svg,/data-tip-condition="adiabatic"/);
 assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
 assert.match(svg,/原著図版の転載・トレース・逐文訳なし/);
 assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('the insulated-tip fin model matches the lecture example independently',()=>{
 assert.deepEqual([p.k,p.h,p.P,p.Ac,p.L,p.Tb,p.Tinf],[200,25,.04,.0001,.1,80,20]);
 const m=Math.sqrt(p.h*p.P/(p.k*p.Ac)), mL=m*p.L,delta=p.Tb-p.Tinf;
 near(p.m,m);near(p.mL,mL);
 near(p.m,Math.sqrt(50));
 near(p.q,p.k*p.Ac*m*delta*Math.tanh(mL));
 near(p.q,5.166343029483286);
 near(p.qideal,p.h*p.P*p.L*delta);
 near(p.qideal,6);
 near(p.qbare,p.h*p.Ac*delta);
 near(p.qbare,.15);
 near(p.eta,p.q/p.qideal);
 near(p.eta,Math.tanh(mL)/mL);
 near(p.eps,p.q/p.qbare);
 near(p.Ttip,p.Tinf+delta/Math.cosh(mL));
 near(p.Ttip,67.5966909047832);
 assert.ok(p.Ttip<p.Tb && p.Ttip>p.Tinf);
});

test('41 points follow the exact cosh ratio; insulated tip has zero gradient',()=>{
 assert.equal(numeric('data-curve-points'),41);
 const d=svg.match(/<path id="fin-temperature-profile" class="curve" d="([^"]+)"\/>/)?.[1];
 assert.ok(d,'missing fin profile');
 const pts=[...d.matchAll(/[ML]([0-9.]+) ([0-9.]+)/g)].map(a=>[Number(a[1]),Number(a[2])]);
 assert.equal(pts.length,41);
 const ratio=u=>Math.cosh(p.mL*(1-u))/Math.cosh(p.mL);
 pts.forEach(([x,y],i)=>{
  const u=i/40;
  near(x,145+548*u,.0008);
  near(y,542+1032*(1-ratio(u)),.0008);
  if(i)assert.ok(y>=pts[i-1][1],'curve must cool monotonically');
 });
 near(ratio(0),1);near(ratio(1),1/Math.cosh(p.mL));
 const eps=1e-5;
 near((ratio(1)-ratio(1-eps))/eps,0,.0001);
 const point=svg.match(/<circle class="tipmark" cx="([0-9.]+)" cy="([0-9.]+)" r="7"\/>/);
 assert.ok(point);
 near(Number(point[1]),693,.001);
 near(Number(point[2]),542+1032*(1-ratio(1)),.001);
});

test('side-area efficiency has correctly proportioned bars, unlike fin effectiveness',()=>{
 const getWidth=id=>{
  const tag=svg.match(new RegExp('<rect id="'+id+'"[^>]*\\/>'))?.[0];
  assert.ok(tag,id+' missing');
  const width=tag.match(/width="([0-9.]+)"/);
  assert.ok(width);
  return Number(width[1]);
 };
 const ideal=getWidth('ideal-side-bar'),actual=getWidth('real-side-bar');
 near(ideal,610);
 near(actual/ideal,p.eta,1e-7);
 assert.ok(p.eta>0&&p.eta<1);
 assert.ok(p.eps>1);
 assert.ok(p.eps>p.eta);
 for(const t of ['理想上限','効率 η_f = 5.166/6.000 ≈ 86.1%',
 'フィンなし：基部断面 A_c からの対流は 0.150 W',
 '有効度 ε_f = 5.166/0.150 ≈ 34.44']) assert.ok(svg.includes(t),t);
});

test('physical boundary conditions and model exclusions remain clear',()=>{
 for(const t of ['先端：断熱（dT/dx = 0）','先端で曲線の勾配は0',
   '定常、放射・接触抵抗・先端対流なし。',
   '側面から対流で放熱','0.100 m',
   'T∞ = 20 ℃'])assert.ok(svg.includes(t),t);
 assert.doesNotMatch(svg,/\btip heat rate > 0\b/);
});
