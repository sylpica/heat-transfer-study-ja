import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-10-6-solar-roof-balance.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const num=(attribute)=>{
  const found=svg.match(new RegExp('\\b'+attribute+'="([^"]+)"'));
  assert.ok(found,'Missing data attribute '+attribute);
  const value=Number(found[1]);
  assert.ok(Number.isFinite(value),attribute+' must be finite');
  return value;
};
const p={
  sigma:num('data-sigma'),q:num('data-qsolar'),tair:num('data-tair'),h:num('data-h'),tsky:num('data-tsky'),
  bA:num('data-black-alpha'),bE:num('data-black-eps'),bT:num('data-black-t'),
  wA:num('data-white-alpha'),wE:num('data-white-eps'),wT:num('data-white-t'),
  sc:num('data-solar-constant'),frac:num('data-surface-frac'),avg:num('data-surface-avg')
};
const near=(actual,expected,tolerance=1e-7)=>{
  assert.ok(Math.abs(actual-expected)<=tolerance,actual+' differs from '+expected);
};
const solve=(a,e)=>{
  const f=T=>a*p.q+e*p.sigma*p.tsky**4-p.h*(T-p.tair)-e*p.sigma*T**4;
  let lo=250,hi=400;
  for(let i=0;i<200;i++){const mid=(lo+hi)/2;if(f(mid)>0)lo=mid;else hi=mid;}
  return (lo+hi)/2;
};

test('§10.6 independent SVG is accessible, offline-safe and supports dark mode',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/data-lesson="10\.6"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/viewBox="0 0 840 1154"/);
  assert.match(svg,/role="img" aria-labelledby="title10-6 desc10-6"/);
  assert.match(svg,/<title id="title10-6">/);
  assert.match(svg,/<desc id="desc10-6">/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('roof temperatures solve the Example 10.12 surface balance',()=>{
  near(p.bT,solve(p.bA,p.bE),0.02);
  near(p.wT,solve(p.wA,p.wE),0.02);
  near(p.bT-273.15,65.0,0.1);
  near(p.wT-273.15,39.4,0.1);
  assert.ok(p.bT-p.wT>25,'paints differ by more than 25 K');
  for(const s of ['338.12 K（65.0 ℃）','312.59 K（39.4 ℃）','407.45 W/m²'])assert.ok(svg.includes(s),s);
});

test('balance components close for both paints',()=>{
  const sky=p.bE*p.sigma*p.tsky**4;
  near(sky,366.7,0.2);
  const close=(a,e,t,solarIn,conv,emit)=>{
    near(a*p.q,solarIn,0.15);
    near(p.h*(t-p.tair),conv,0.15);
    near(e*p.sigma*t**4,emit,0.3);
    near(solarIn+sky,conv+emit,0.5);
  };
  close(p.bA,p.bE,p.bT,540.0,239.7,667.0);
  close(p.wA,p.wE,p.wT,156.0,35.5,487.2);
});

test('earth-scale figures match the book values',()=>{
  assert.equal(p.sc,1361);
  assert.equal(p.avg,235);
  assert.ok(p.frac>0.44&&p.frac<0.46);
  for(const s of ['1361 W/m²','約45%','約235 W/m²','0.95 / 0.09','0.96 / 0.16','0.26 / 0.90'])assert.ok(svg.includes(s),s);
});
