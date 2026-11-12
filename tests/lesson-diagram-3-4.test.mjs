import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const svg=readFileSync(new URL('../assets/lesson-diagrams/section-3-4-required-heat-transfer-area.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const numeric=(attribute)=>{
  const match=svg.match(new RegExp('\\b'+attribute+'="([^"]+)"'));
  assert.ok(match,'missing '+attribute);
  const num=Number(match[1]);
  assert.ok(Number.isFinite(num),'not finite '+attribute);
  return num;
};
const p={Q:numeric('data-q-w'),F:numeric('data-correction-f'),
  dT:numeric('data-lmtd-k'),U0:numeric('data-u-clean'),U1:numeric('data-u-reduced'),
  Cmin:numeric('data-c-min'),dTin:numeric('data-inlet-delta-k'),
  A0:numeric('data-area-clean'),A1:numeric('data-area-reduced')};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);

test('accessible independent offline SVG, dark mode, no external dependencies',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 800 1180"/);
  assert.match(svg,/role="img" aria-labelledby="area-title area-desc"/);
  assert.match(svg,/<title id="area-title">/);
  assert.match(svg,/<desc id="area-desc">/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="3\.4"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('section worked example: both area values reconstruct required heat transfer',()=>{
  assert.deepEqual(p,{Q:12000,F:.8,dT:25,U0:300,U1:150,Cmin:1000,dTin:30,A0:2,A1:4});
  near(p.Q/(p.U0*p.F*p.dT),p.A0);
  near(p.Q/(p.U1*p.F*p.dT),p.A1);
  near(p.U0*p.A0*p.F*p.dT,p.Q);
  near(p.U1*p.A1*p.F*p.dT,p.Q);
  near(p.U1/p.U0,.5);
  near(p.A1/p.A0,2);
});

test('chart bar areas preserve exact ratio and theoretical maximum matches 40%',()=>{
  const bar=id=>{
    const match=svg.match(new RegExp('<rect id="'+id+'"[^>]+x="([0-9.]+)" y="([0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"'));
    assert.ok(match,'missing bar '+id);
    return match.slice(1).map(Number);
  };
  const base=bar('bar-clean'),reduced=bar('bar-reduced');
  near(reduced[2]/base[2],p.A1/p.A0);
  near(base[3],reduced[3]);
  near(base[0],reduced[0]);
  near(p.Cmin*p.dTin,30000);
  near(p.Q/(p.Cmin*p.dTin),.4);
  const fraction=bar('required-fraction');
  near(fraction[2]/680,.4);
  for(const label of ['2.00 m²','4.00 m²','上限 30 kW','要求 12 kW'])assert.ok(svg.includes(label),label);
});

test('conditions and caveats prevent confusing a parametric comparison with real fouling design',()=>{
  for(const label of [
    '同じ熱負荷・温度差を仮定','装置の実寸図ではない',
    'FとΔT_lmが同一という仮想比較',
    '上限以下でも達成の保証ではない',
    '圧力損失、端末温度差、Uや補正係数の変化は別途検証',
    'アプリ作成の独自図'
  ])assert.ok(svg.includes(label),label);
});
