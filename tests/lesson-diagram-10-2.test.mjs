import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-10-2-kirchhoff-spectral-bands.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const num=(attribute)=>{
  const found=svg.match(new RegExp('\\b'+attribute+'="([^"]+)"'));
  assert.ok(found,'Missing data attribute '+attribute);
  const value=Number(found[1]);
  assert.ok(Number.isFinite(value),attribute+' must be finite');
  return value;
};
const p={
  sigma:num('data-sigma'),tsun:num('data-tsun'),tbody:num('data-tbody'),
  sunL1:num('data-sun-l1'),sunL2:num('data-sun-l2'),sunFrac:num('data-sun-frac'),
  bodyL1:num('data-body-l1'),bodyL2:num('data-body-l2'),bodyFrac:num('data-body-frac'),
  q:num('data-qsolar'),
  bA:num('data-black-alpha'),bE:num('data-black-eps'),bT:num('data-black-t'),
  wA:num('data-white-alpha'),wE:num('data-white-eps'),wT:num('data-white-t')
};
const near=(actual,expected,tolerance=1e-7)=>{
  assert.ok(Math.abs(actual-expected)<=tolerance,actual+' differs from '+expected);
};
// Blackbody radiation function F(0->lambda) by Simpson integration of Planck's law.
const F0=(lam,T)=>{
  const x=14387.7685/(lam*T),hi=60,n=6000,h=(hi-x)/n;
  const g=v=>v**3/(Math.exp(v)-1);
  let s=g(x)+g(hi);
  for(let i=1;i<n;i++)s+=(i%2?4:2)*g(x+i*h);
  return 15/Math.PI**4*s*h/3;
};

test('§10.2 independent SVG is accessible, offline-safe and supports dark mode',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/data-lesson="10\.2"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/viewBox="0 0 840 1156"/);
  assert.match(svg,/role="img" aria-labelledby="title10-2 desc10-2"/);
  assert.match(svg,/<title id="title10-2">/);
  assert.match(svg,/<desc id="desc10-2">/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('spectral band fractions match Planck integration (book: about 90% each)',()=>{
  const sun=F0(p.sunL2,p.tsun)-F0(p.sunL1,p.tsun);
  const body=F0(p.bodyL2,p.tbody)-F0(p.bodyL1,p.tbody);
  near(p.sunFrac,sun,1.5e-3);
  near(p.bodyFrac,body,1.5e-3);
  assert.ok(Math.abs(sun-0.90)<0.01,'sun band should be about 90%');
  assert.ok(Math.abs(body-0.90)<0.01,'300 K band should be about 90%');
  for(const s of ['89.96%','90.06%','0.33–2.2 μm','6.3–42 μm'])assert.ok(svg.includes(s),s);
});

test('radiation-only equilibrium separates black and white paint via alpha, not epsilon',()=>{
  for(const [a,e,t] of [[p.bA,p.bE,p.bT],[p.wA,p.wE,p.wT]]){
    near(t,(a*p.q/(e*p.sigma))**0.25,1e-3);
    near(a*p.q,e*p.sigma*t**4,0.05);
  }
  assert.ok(p.bE>0.9&&p.wE>0.85,'both paints emit well in the infrared');
  assert.ok(p.bA-p.wA>0.7,'solar absorptances differ strongly');
  assert.ok(p.bT-p.wT>120,'equilibrium temperatures differ by more than 120 K');
  for(const s of ['364.42 K','232.84 K','1000 W/m²'])assert.ok(svg.includes(s),s);
});

test('Kirchhoff forms are shown with their assumptions in order',()=>{
  for(const s of ['（10.8a）','（10.8b）','（10.8c）','ε_λ(T, θ, φ) = α_λ(T, θ, φ)','ε(T) = α(T)','灰色面でのみ正確'])assert.ok(svg.includes(s),s);
});
