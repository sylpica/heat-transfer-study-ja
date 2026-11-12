import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-11-4-species-balance-raoult-henry.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
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
const psat=(Tc)=>{
  const A=num('data-antoine-a'),B=num('data-antoine-b'),C=num('data-antoine-c'),mm=num('data-mmhg-pa');
  return Math.pow(10,A-B/(C+Tc))*mm;
};
const mH2O=(Tc)=>{
  const p=num('data-pressure-pa'),MH=num('data-m-h2o-kg-kmol'),MA=num('data-m-air-kg-kmol');
  const x=Math.min(psat(Tc)/p,1);
  return x*MH/(x*MH+(1-x)*MA);
};

test('自作・代替説明・明暗モード・外部参照なし',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="species-title species-desc"/);
  assert.match(svg,/<title id="species-title">/);
  assert.match(svg,/<desc id="species-desc">/);
  assert.match(svg,/viewBox="0 0 760 1560"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="11\.4"/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)\s*=|@import|url\s*\(/i);
  assert.doesNotMatch(svg,/⁻|⁵|₀|₁/);
});

test('例題11.5：炭酸飲料のモル分率とHenry分圧を独立再計算',()=>{
  const g=num('data-co2-g-per-l'),w=num('data-water-g-per-l');
  const MC=num('data-m-co2-kg-kmol'),MH=num('data-m-h2o-kg-kmol'),H=num('data-henry-pa');
  assert.equal(g,7);assert.equal(w,997);assert.equal(MC,44.01);assert.equal(MH,18.02);assert.equal(H,1.63e8);
  const x=(g/MC)/(g/MC+w/MH);
  assert.ok(Math.abs(x-0.00287)<5e-6);
  const pco2=H*x;
  assert.ok(Math.abs(pco2-467248)<5);
  assert.ok(Math.abs(pco2-468e3)<1000,'本書の468 kPaとは丸めの範囲');
  assert.ok(svg.includes('467 kPa'));
  assert.ok(svg.includes('本書は x の丸めで 468 kPa'));
  assert.ok(Math.abs(width('bar-pco2')-pco2/1000)<0.01);
  assert.ok(Math.abs(width('bar-atm')-101.325)<0.01);
});

test('蒸気質量分率曲線がAntoine式と(11.48)で21点一致',()=>{
  const p=curve('vapor-curve-11-4');
  assert.equal(p.length,21);
  for(let i=0;i<=20;i++){
    const T=5*i,m=mH2O(T);
    assert.ok(Math.abs(p[i][0]-(120+560*T/100))<0.0011);
    assert.ok(Math.abs(p[i][1]-(1290-340*m))<0.06,'T='+T);
    if(i)assert.ok(p[i][1]<p[i-1][1]);
  }
  assert.ok(Math.abs(mH2O(100)-1)<1e-12);
});

test('54°Cマーカーと本書の10%未満の記述',()=>{
  const m=svg.match(/<circle id="marker-54c" cx="([\d.]+)" cy="([\d.]+)"/);
  assert.ok(m);
  const m54=mH2O(54);
  assert.ok(m54<0.10);
  assert.ok(Math.abs(m54-0.0973)<0.001);
  assert.ok(Math.abs(Number(m[1])-(120+560*54/100))<0.01);
  assert.ok(Math.abs(Number(m[2])-(1290-340*m54))<0.01);
  assert.ok(svg.includes('54°C 未満では 10% 未満（本書）'));
  assert.ok(svg.includes('Antoine 式による近似'));
});

test('保存式の構造と界面の不連続、Raoult/Henryの表示',()=>{
  assert.match(svg,/蓄積 = 出入り（対流\+拡散）\+ 反応生成/);
  assert.match(svg,/温度は連続でも濃度は跳びうる/);
  assert.match(svg,/Raoult の法則：p_i = p_sat,i x_i（液に富む成分、式\(11\.45\)）/);
  assert.match(svg,/Henry の法則：p_i = H x_i（希薄成分、式\(11\.46\)）/);
});
