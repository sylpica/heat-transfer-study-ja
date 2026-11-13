import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-11-6-naphthalene-sublimation-analogy.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const num=(name)=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'Missing '+name);
  const n=Number(m[1]);assert.ok(Number.isFinite(n));return n;
};
const chain=()=>{
  const A=num('data-antoine-a'),B=num('data-antoine-b'),T=num('data-temperature-k'),mm=num('data-mmhg-pa');
  const pv=Math.pow(10,A-B/T)*mm,p=num('data-pressure-pa');
  const MN=num('data-m-nap-kg-kmol'),MA=num('data-m-air-kg-kmol');
  const x=pv/p,m=x*MN/(x*MN+(1-x)*MA);
  const U=num('data-velocity-m-s'),L=num('data-length-m'),nu=num('data-nu-m2-s'),D=num('data-diffusivity-m2-s'),rho=num('data-density-kg-m3');
  const Re=U*L/nu,Sc=nu/D,Num=0.664*Math.sqrt(Re)*Math.pow(Sc,1/3),gm=rho*D/L*Num;
  return {pv,x,m,Bm:m/(1-m),Re,Sc,Num,gm,flux:gm*m};
};

test('自作・代替説明・明暗モード・外部参照なし',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="naph-title naph-desc"/);
  assert.match(svg,/<title id="naph-title">/);
  assert.match(svg,/<desc id="naph-desc">/);
  assert.match(svg,/viewBox="0 0 760 1520"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="11\.6"/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)\s*=|@import|url\s*\(/i);
  assert.doesNotMatch(svg,/⁻|⁵|₀|₁/);
});

test('例題11.11：蒸気圧・表面質量分率・駆動力を独立再計算',()=>{
  const c=chain();
  assert.ok(Math.abs(c.pv-18.49)<0.03);
  assert.ok(Math.abs(c.x-1.825e-4)<2e-7);
  assert.ok(Math.abs(c.m-8.074e-4)<2e-7);
  assert.ok(Math.abs(c.Bm-8.081e-4)<2e-7);
  assert.ok(c.Bm<0.2,'低移動率の条件(11.65)を満たす');
  assert.ok(svg.includes('m_nap,s = 8.074×10^(-4)'));
  assert.ok(svg.includes('B_m = 8.08×10^(-4) ≪ 0.2'));
});

test('例題11.11：Re・Sc・Num・g_m・損失流束を独立再計算',()=>{
  const c=chain();
  assert.ok(Math.abs(c.Re-1.339e4)<15);
  assert.ok(c.Re<5e5,'層流');
  assert.ok(Math.abs(c.Sc-2.17)<0.005);
  assert.ok(Math.abs(c.Num-99.5)<0.3);
  assert.ok(Math.abs(c.gm-0.0200)<1e-4);
  assert.ok(Math.abs(c.flux-1.61e-5)<1e-7);
  assert.ok(Math.abs(c.flux*3.6e6-58.0)<0.1);
  for(const t of ['Re_L = UL/ν = 1.339×10^4（層流）','Sc = ν/D = 2.17','Num,L = 0.664 Re^(1/2) Sc^(1/3) = 99.5','g_m = ρD Num/L = 0.0200 kg/(m²·s)','58.0 g/(m²·h)'])assert.ok(svg.includes(t),t);
});

test('類似の対応と昇華法の注意を表示',()=>{
  assert.match(svg,/Num = g_m L\/\(ρD\)/);
  assert.match(svg,/質量 Nusselt 数（Sherwood 数）/);
  assert.match(svg,/一様壁温/);
  assert.match(svg,/一様表面濃度/);
  assert.match(svg,/Sc ≠ Pr/);
  assert.match(svg,/低移動率の対流物質移動/);
});
