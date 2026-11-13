import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-10-3-view-factor-reciprocity.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const number=(key)=>{
  const match=svg.match(new RegExp('\\b'+key+'="([^"]+)"'));
  assert.ok(match,`属性 ${key} が必要`);
  const value=Number(match[1]);
  assert.ok(Number.isFinite(value),`${key} は有限数`);
  return value;
};

test('§10.3 独立作図、読み上げ、オフラインと配色の契約',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 680 1100"/);
  assert.match(svg,/role="img" aria-labelledby="vf-title vf-description"/);
  assert.match(svg,/<title id="vf-title">/);
  assert.match(svg,/<desc id="vf-description">/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="10\.3"/);
  assert.match(svg,/@media \(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
  assert.doesNotMatch(svg,/[₀-₉⁻]/u,'実機未確認の下付き字・上付きマイナス字を使用しない');
});

test('相反則：面積で重み付けした形態係数が一致する',()=>{
  const A1=number('data-area-1'),A2=number('data-area-2'),F12=number('data-factor-12');
  assert.equal(A1,1);assert.equal(A2,4);assert.equal(F12,0.8);
  const F21=A1*F12/A2;
  assert.equal(F21,0.2);
  assert.equal(A1*F12,A2*F21);
  assert.ok(F12>=0&&F12<=1&&F21>=0&&F21<=1);
  for(const text of ['F_12 = 0.80','F_21 = 0.20','A_1 F_12 = A_2 F_21','0.80 m²'])assert.ok(svg.includes(text),text);
});

test('黒体間の放射交換：絶対温度・面積・向きを独立に検算する',()=>{
  const A1=number('data-area-1'),A2=number('data-area-2'),F12=number('data-factor-12');
  const T1=number('data-temperature-1'),T2=number('data-temperature-2'),sigma=number('data-sigma');
  assert.equal(T1,400);assert.equal(T2,300);assert.equal(sigma,5.67e-8);
  const rate=sigma*A1*F12*(T1**4-T2**4);
  const reversed=sigma*A2*(A1*F12/A2)*(T2**4-T1**4);
  assert.ok(Math.abs(rate-793.8)<1e-9);
  assert.ok(Math.abs(rate+reversed)<1e-9);
  assert.ok(rate>0 && T1>T2,'熱は高温面から低温面への正味移動');
  assert.match(svg,/正味 1 → 2/);
  assert.match(svg,/793\.8 W/);
  assert.match(svg,/400⁴ − 300⁴/);
  assert.match(svg,/class="exchange" d="M240 332 H438 M423 320 L439 332 L423 344"/);
});
