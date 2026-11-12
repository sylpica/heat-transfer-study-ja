import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-11-7-coffee-cup-wet-bulb.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const num=(name)=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'Missing '+name);
  const n=Number(m[1]);assert.ok(Number.isFinite(n));return n;
};
const width=(id)=>{
  const m=svg.match(new RegExp('<rect id="'+id+'" x="[\\d.]+" y="[\\d.]+" width="([\\d.]+)"'));
  assert.ok(m,'Missing '+id);return Number(m[1]);
};
const losses=()=>{
  const R=num('data-gas-constant-kmol'),MH=num('data-m-h2o-kg-kmol'),MA=num('data-m-air-kg-kmol');
  const Ts=num('data-t-surface-k'),Te=num('data-t-room-k'),p=num('data-pressure-pa');
  const rp=(pp,M,T)=>pp*M/(R*T);
  const ms=rp(num('data-psat-surface-pa'),MH,Ts)/(rp(num('data-psat-surface-pa'),MH,Ts)+rp(p-num('data-psat-surface-pa'),MA,Ts));
  const pe=num('data-psat-room-pa')*num('data-relative-humidity');
  const me=rp(pe,MH,Te)/(rp(pe,MH,Te)+rp(p-pe,MA,Te));
  const A=Math.PI*Math.pow(num('data-diameter-m'),2)/4;
  const Qnc=A*num('data-h-w-m2k')*(Ts-Te);
  const Qrad=A*num('data-emissivity')*num('data-sigma')*(Math.pow(Ts,4)-Math.pow(Te,4));
  const Qev=A*num('data-gm-kg-m2s')*(ms-me)*num('data-hfg-j-kg');
  return {ms,me,Bm:(ms-me)/(1-ms),Qnc,Qrad,Qev,Qtot:Qnc+Qrad+Qev};
};

test('自作・代替説明・明暗モード・外部参照なし',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="coffee-title coffee-desc"/);
  assert.match(svg,/<title id="coffee-title">/);
  assert.match(svg,/<desc id="coffee-desc">/);
  assert.match(svg,/viewBox="0 0 760 1560"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="11\.7"/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)\s*=|@import|url\s*\(/i);
  assert.doesNotMatch(svg,/⁻|⁵|₀|₁/);
});

test('例題11.12：表面・周囲の質量分率と駆動力を独立再計算',()=>{
  const l=losses();
  assert.ok(Math.abs(l.ms-0.1323)<5e-4);
  assert.ok(Math.abs(l.me-0.00980)<5e-5);
  assert.ok(Math.abs(l.Bm-0.1412)<5e-4);
  assert.ok(l.Bm<0.2);
  assert.ok(svg.includes('m_H2O,s = 0.1323、m_H2O,e = 0.00980'));
  assert.ok(svg.includes('B_m = 0.1412 &lt; 0.2（低移動率）'));
});

test('例題11.12：三つの熱損失と内訳バーを独立再計算',()=>{
  const l=losses();
  assert.ok(Math.abs(l.Qnc-1.53)<0.02);
  assert.ok(Math.abs(l.Qrad-1.43)<0.02);
  assert.ok(Math.abs(l.Qev-13.4)<0.15);
  assert.ok(Math.abs(l.Qtot-16.33)<0.1);
  assert.ok(Math.abs(l.Qev/l.Qtot*100-81.8)<0.3);
  const scale=440/l.Qev;
  assert.ok(Math.abs(width('bar-q-evap')-l.Qev*scale)<0.01);
  assert.ok(Math.abs(width('bar-q-conv')-l.Qnc*scale)<0.01);
  assert.ok(Math.abs(width('bar-q-rad')-l.Qrad*scale)<0.01);
  for(const t of ['13.4 W・81.8%','1.53 W・9.4%','1.43 W・8.8%','合計 16.33 W'])assert.ok(svg.includes(t),t);
});

test('例題11.13：湿球方程式(11.74)とLewis関係式を独立再計算',()=>{
  const p=num('data-pressure-pa'),MH=num('data-m-h2o-kg-kmol');
  const x=num('data-psat-wetbulb-pa')/p;
  const mwb=x*MH/(x*MH+(1-x)*28.97);
  assert.ok(Math.abs(mwb-num('data-m-wetbulb'))<1e-5,'質量分率の連鎖は本書の丸め値と一致');
  const Le=num('data-lewis');
  assert.ok(Math.abs(Math.pow(Le,2/3)-0.895)<0.001);
  const dT=num('data-hfg-wetbulb-j-kg')*num('data-m-wetbulb')/(num('data-cp-air')*Math.pow(Le,2/3));
  assert.ok(Math.abs(dT-28.86)<0.01);
  assert.ok(Math.abs(num('data-wet-bulb-c')+dT-43.86)<0.01);
  for(const t of ['Le^(2/3) = 0.895','m_H2O,s = 0.01054','28.86 K → 乾球 43.9°C','乾球 = 湿球 = 15°C'])assert.ok(svg.includes(t),t);
  assert.match(svg,/Lewis 関係式/);
});
