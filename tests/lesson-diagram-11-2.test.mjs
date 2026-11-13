import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-11-2-air-composition-flux-decomposition.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const num=(name)=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'Missing '+name);
  const n=Number(m[1]);assert.ok(Number.isFinite(n));return n;
};
const width=(id)=>{
  const m=svg.match(new RegExp('<rect id="'+id+'" x="[\\d.]+" y="[\\d.]+" width="([\\d.]+)"'));
  assert.ok(m,'Missing '+id);return Number(m[1]);
};
const vals=()=>{
  const mN2=num('data-m-n2'),mO2=num('data-m-o2'),mAr=num('data-m-ar');
  const MN2=num('data-molar-mass-n2'),MO2=num('data-molar-mass-o2'),MAr=num('data-molar-mass-ar');
  const M=1/(mN2/MN2+mO2/MO2+mAr/MAr);
  return {mN2,mO2,mAr,MN2,MO2,MAr,M,
    xN2:(mN2/MN2)*M,xO2:(mO2/MO2)*M,xAr:(mAr/MAr)*M};
};

test('自作・代替説明・明暗モード・外部参照なし',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="air-title air-desc"/);
  assert.match(svg,/<title id="air-title">/);
  assert.match(svg,/<desc id="air-desc">/);
  assert.match(svg,/viewBox="0 0 760 1560"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="11\.2"/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)\s*=|@import|url\s*\(/i);
  assert.doesNotMatch(svg,/⁻|⁵|₀|₁/);
});

test('例題11.1：混合モル質量とモル分率を独立再計算',()=>{
  const v=vals();
  assert.equal(v.mN2,0.7552);assert.equal(v.mO2,0.2314);assert.equal(v.mAr,0.0128);
  assert.ok(Math.abs(v.M-28.97)<0.01);
  assert.ok(Math.abs(v.xO2-0.2095)<5e-4);
  assert.ok(Math.abs(v.xN2+v.xO2+v.xAr-1)<1e-9);
  assert.ok(svg.includes('M = 28.97 kg/kmol'));
  assert.ok(svg.includes('x_O2 = m_O2 M/M_O2 = 0.2095'));
});

test('例題11.1：酸素の分圧・モル濃度・部分密度を独立再計算',()=>{
  const v=vals(),p=num('data-pressure-pa'),T=num('data-temperature-k'),R=num('data-gas-constant-kmol');
  assert.equal(p,101325);assert.equal(T,300);assert.equal(R,8314.5);
  const pO2=v.xO2*p;
  assert.ok(Math.abs(pO2-2.123e4)<15);
  const cO2=pO2/(R*T)*1000;
  assert.ok(Math.abs(cO2-8.510)<0.002);
  const rhoO2=cO2/1000*v.MO2;
  assert.ok(Math.abs(rhoO2-0.2723)<5e-4);
  for(const t of ['2.123×10^4 Pa','8.510 mol/m³','0.2723 kg/m³','Dalton'])assert.ok(svg.includes(t),t);
});

test('組成バーの幅が質量分率・モル分率に比例',()=>{
  const v=vals();
  assert.ok(Math.abs(width('bar-m-n2')-560*v.mN2)<0.01);
  assert.ok(Math.abs(width('bar-m-o2')-560*v.mO2)<0.01);
  assert.ok(Math.abs(width('bar-m-ar')-560*v.mAr)<0.01);
  assert.ok(Math.abs(width('bar-x-n2')-560*v.xN2)<0.01);
  assert.ok(Math.abs(width('bar-x-o2')-560*v.xO2)<0.01);
  assert.ok(Math.abs(width('bar-x-ar')-560*v.xAr)<0.01);
});

test('流束分解の式と総和条件を表示',()=>{
  assert.match(svg,/n_i = m_i n \+ j_i/);
  assert.match(svg,/Σ j_i = 0（式\(11\.21\)）/);
  assert.match(svg,/Σ n_i = n（式\(11\.18\)）/);
  assert.match(svg,/N_i = x_i N \+ J_i/);
  assert.match(svg,/質量平均速度 v は、前章までの流体速度 u と同じもの/);
});
