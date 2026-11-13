import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-11-1-introduction-flux-timescale.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
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

test('自作・代替説明・明暗モード・外部参照なし',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="intro-title intro-desc"/);
  assert.match(svg,/<title id="intro-title">/);
  assert.match(svg,/<desc id="intro-desc">/);
  assert.match(svg,/viewBox="0 0 760 1500"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="11\.1"/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)\s*=|@import|url\s*\(/i);
  assert.doesNotMatch(svg,/⁻|⁵|₀|₁/);
});

test('レッスン独立例題の拡散流束・移動率・質量移動率を独立再計算',()=>{
  const c=num('data-c-mol-m3'),D=num('data-diffusivity-m2-s'),L=num('data-length-m');
  const y0=num('data-y-a-left'),y1=num('data-y-a-right'),A=num('data-area-m2'),MA=num('data-molar-mass-a-kg-mol');
  assert.equal(c,50);assert.equal(D,2e-5);assert.equal(L,0.01);
  assert.equal(y0,0.3);assert.equal(y1,0.1);assert.equal(A,0.02);assert.equal(MA,0.02);
  const J=-c*D*(y1-y0)/L;
  assert.ok(Math.abs(J-0.020)<1e-12);
  assert.ok(Math.abs(J*A-4.0e-4)<1e-12);
  assert.ok(Math.abs(J*A*MA-8.0e-6)<1e-14);
  for(const v of ['J_A = +0.020','= +0.020 mol/(m²·s)','4.0×10^(-4) mol/s','8.0×10^(-6) kg/s','N_B = −0.020'])assert.ok(svg.includes(v),v);
});

test('モル分率プロファイルが直線で21点一致',()=>{
  const p=curve('profile-11-1');
  assert.equal(p.length,21);
  for(let i=0;i<=20;i++){
    const s=i/20;
    assert.ok(Math.abs(p[i][0]-(120+232*s))<0.0011);
    assert.ok(Math.abs(p[i][1]-(560+115*s))<0.0011);
    if(i)assert.ok(p[i][1]>p[i-1][1]);
  }
});

test('拡散時間尺度の対数バーが L^2/D と一致',()=>{
  const L=num('data-length-m'),D=num('data-diffusivity-m2-s'),Dl=num('data-d-liquid-m2-s');
  const tg=L*L/D,tl=L*L/Dl;
  assert.ok(Math.abs(tg-5.0)<1e-9);
  assert.ok(Math.abs(tl-1.0e5)<1e-3);
  assert.ok(Math.abs(width('bar-td-gas')-112*Math.log10(tg))<0.01);
  assert.ok(Math.abs(width('bar-td-liquid')-112*Math.log10(tl))<0.01);
  assert.ok(Math.abs(tl/3600-27.8)<0.05);
  assert.ok(svg.includes('約27.8時間'));
  assert.ok(svg.includes('厳密な完了時間ではない'));
});
