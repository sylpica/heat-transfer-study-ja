import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-4-3-bi-fo-similarity-scaling.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
function numeric(name){
  const match=svg.match(new RegExp(`\\b${name}="([^"]+)"`));
  assert.ok(match,`Missing ${name}`);
  const value=Number(match[1]);
  assert.ok(Number.isFinite(value),`Invalid ${name}`);
  return value;
}
const p={
  L0:numeric('data-length-base'),L1:numeric('data-length-scaled'),
  h0:numeric('data-h-base'),h1:numeric('data-h-scaled'),
  t0:numeric('data-time-base'),t1:numeric('data-time-scaled'),
  k:numeric('data-conductivity'),alpha:numeric('data-diffusivity')
};
const near=(actual,expect,tolerance=1e-11)=>assert.ok(Math.abs(actual-expect)<tolerance,`${actual} != ${expect}`);

// All assertions are structural or derived independently from the numeric
// parameters, rather than trusting visual annotations or the lecture's answer.
test('original self-contained, accessible SVG with light and dark colors',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 800 1230"/);
  assert.match(svg,/role="img" aria-labelledby="similarity-title similarity-description"/);
  assert.match(svg,/<title id="similarity-title">/);
  assert.match(svg,/<desc id="similarity-description">/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="4\.3"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('both physical cases reproduce section 4.3 Biot and Fourier values',()=>{
  assert.deepEqual(p,{L0:0.020,L1:0.040,h0:40,h1:20,t0:100,t1:400,k:8,alpha:2e-6});
  const Bi0=p.h0*p.L0/p.k, Bi1=p.h1*p.L1/p.k;
  const Fo0=p.alpha*p.t0/p.L0**2, Fo1=p.alpha*p.t1/p.L1**2;
  near(Bi0,0.10);near(Bi1,0.10);near(Fo0,0.50);near(Fo1,0.50);
  near(Bi0,Bi1);near(Fo0,Fo1);
  for(const label of ['Bi = hL/k','Fo = αt/L²','0.10','0.50','100 s','400 s'])assert.ok(svg.includes(label),label);
});

test('scaling law is imposed on geometry, h and time consistently',()=>{
  const lengthRatio=p.L1/p.L0;
  near(lengthRatio,2);
  near(p.h1/p.h0,1/lengthRatio);
  near(p.t1/p.t0,lengthRatio**2);
  const first=svg.match(/<rect id="slab-base" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/);
  const second=svg.match(/<rect id="slab-scaled" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/);
  assert.ok(first&&second,'Both slab geometry elements must exist');
  near(Number(second[3])/Number(first[3]),lengthRatio);
  near(Number(first[1])+Number(first[3])/2,400);
  near(Number(second[1])+Number(second[3])/2,400);
  near(Number(first[4]),Number(second[4]));
});

test('dimensionless similarity is conditional, not equal temperature assertion',()=>{
  assert.match(svg,/data-length-definition="slab-half-thickness"/);
  assert.match(svg,/幾何形状・無次元初期条件・境界条件も一致が必要/);
  assert.match(svg,/BiとFoだけで実温度や熱流束まで同じとは断定しない/);
  assert.match(svg,/冷却の前提：初期温度 T_i &gt; 周囲温度 T∞/);
  assert.match(svg,/集中熱容量の V\/A_s とは区別/);
  assert.match(svg,/原書の図版・転載ではない/);
});
