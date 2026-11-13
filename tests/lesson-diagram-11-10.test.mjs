import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-11-10-transport-properties-kinetic-theory.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const num=(name)=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'Missing '+name);
  const n=Number(m[1]);assert.ok(Number.isFinite(n));return n;
};
const curve=(id)=>{
  const m=svg.match(new RegExp('<polyline id="'+id+'" points="([^"]+)"'));
  assert.ok(m,'Missing '+id);
  return m[1].split(/\s+/).map(pair=>pair.split(',').map(Number));
};
const width=(id)=>{
  const m=svg.match(new RegExp('<rect id="'+id+'" x="[\\d.]+" y="[\\d.]+" width="([\\d.]+)"'));
  assert.ok(m,'Missing '+id);return Number(m[1]);
};
const lj=r=>4*(Math.pow(r,-12)-Math.pow(r,-6));
const X=r=>130+(r-0.95)*(550/2.05), Y=p=>390-100*p;

test('自作・代替説明・明暗モード・外部参照なし',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="props-title props-desc"/);
  assert.match(svg,/<title id="props-title">/);
  assert.match(svg,/<desc id="props-desc">/);
  assert.match(svg,/viewBox="0 0 760 1560"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="11\.10"/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)\s*=|@import|url\s*\(/i);
  assert.doesNotMatch(svg,/⁻|⁵|₀|₁/);
});

test('Lennard-Jones曲線が42点一致し最小とゼロ交点を確認',()=>{
  const p=curve('lj-curve-11-10');
  assert.equal(p.length,42);
  for(let i=0;i<42;i++){
    const r=0.95+0.05*i;
    assert.ok(Math.abs(p[i][0]-X(r))<0.0011,'i='+i);
    assert.ok(Math.abs(p[i][1]-Y(lj(r)))<0.06,'i='+i);
  }
  const rmin=Math.pow(2,1/6);
  assert.ok(Math.abs(lj(rmin)+1)<1e-9);
  assert.ok(Math.abs(lj(1))<1e-12);
  const mMin=svg.match(/<circle id="marker-lj-min" cx="([\d.]+)" cy="([\d.]+)"/);
  const mZero=svg.match(/<circle id="marker-lj-zero" cx="([\d.]+)" cy="([\d.]+)"/);
  assert.ok(mMin&&mZero);
  assert.ok(Math.abs(Number(mMin[1])-X(rmin))<0.01);
  assert.ok(Math.abs(Number(mMin[2])-Y(-1))<0.01);
  assert.ok(Math.abs(Number(mZero[1])-X(1))<0.01);
  assert.ok(Math.abs(Number(mZero[2])-Y(0))<0.01);
});

test('例題11.16：結合則とChapman-Enskog式(11.108)を独立再計算',()=>{
  const sA=num('data-sigma-a-angstrom'),sB=num('data-sigma-b-angstrom');
  const eA=num('data-eps-a-k'),eB=num('data-eps-b-k'),Om=num('data-omega-d');
  const T=num('data-temperature-k'),p=num('data-pressure-atm');
  const MA=num('data-m-a-kg-kmol'),MB=num('data-m-b-kg-kmol');
  const sAB=(sA+sB)/2,eAB=Math.sqrt(eA*eB);
  assert.ok(Math.abs(sAB-3.305)<1e-9);
  assert.ok(Math.abs(eAB-56.1)<0.05);
  assert.ok(Math.abs(T/eAB-5.027)<0.005);
  assert.equal(Om,0.8410);
  const D=1.8583e-7*Math.pow(T,1.5)*Math.sqrt(1/MB+1/MA)/(p*sAB*sAB*Om);
  assert.ok(Math.abs(D-6.98e-5)<3e-8);
  const Dexp=num('data-d-experimental-m2-s');
  assert.ok(Math.abs((D/Dexp-1)*100-6)<0.2,'実測より約6%高い');
  assert.ok(Math.abs(width('bar-d-pred')-D*7e6)<0.05);
  assert.ok(Math.abs(width('bar-d-exp')-Dexp*7e6)<0.01);
  for(const t of ['3.305 Å','56.1 K','Ω_D = 0.8410','6.98×10^(-5) m²/s'])assert.ok(svg.includes(t),t);
});

test('Sutherland-Einstein式(11.114)の両極限と比を独立再計算',()=>{
  const kB=num('data-k-boltzmann'),RA=num('data-radius-a-m');
  const ns=kB/(6*Math.PI*RA),sl=kB/(4*Math.PI*RA);
  assert.ok(Math.abs(ns-3.66e-15)<0.01e-15);
  assert.ok(Math.abs(sl-5.49e-15)<0.01e-15);
  assert.ok(Math.abs(sl/ns-1.5)<1e-12);
  assert.ok(Math.abs(width('bar-se-slip')-420)<0.01);
  assert.ok(Math.abs(width('bar-se-noslip')-ns/sl*420)<0.01);
  assert.ok(svg.includes('3.66×10^(-15) と 5.49×10^(-15) kg·m/(K·s²)'));
  assert.match(svg,/Blanc の法則（式\(11\.109\)）/);
});
