import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-6-8-turbulent-gas-liquid-correlations.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const n=(name)=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'missing '+name);
  const value=Number(m[1]);
  assert.ok(Number.isFinite(value),name+' must be numeric');
  return value;
};
const approx=(a,b,eps=1e-8)=>{
  assert.ok(Math.abs(a-b)<eps,'expected '+a+' to be '+b);
};
const rectWidth=(id)=>{
  const m=svg.match(new RegExp('<rect id="'+id+'"[^>]*width="([0-9.]+)"'));
  assert.ok(m,'missing rect '+id);
  return Number(m[1]);
};

test('original, accessible, responsive and offline-safe SVG',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 820 1200"/);
  assert.match(svg,/role="img" aria-labelledby="title68 desc68"/);
  assert.match(svg,/<title id="title68">/);
  assert.match(svg,/<desc id="desc68">/);
  assert.match(svg,/data-lesson="6\.8"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/style="max-width:100%"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('book correlations use fluid-specific Pr exponents (FC-18: no uniform Pr^(1/3))',()=>{
  assert.ok(svg.includes('気体：Nu_x ≈ 0.0296 Re_x^0.8 Pr^0.6（6.112）'));
  assert.ok(svg.includes('非金属液体：Nu_x ≈ 0.032 Re_x^0.8 Pr^0.43'));
  assert.ok(svg.includes('（6.113、Pr ≤ 85 で ±15%程度）'));
  assert.ok(svg.includes('Pr の指数は 1/3 ではなく流体種で異なる'));
  assert.ok(svg.includes('Pr^(1/3) を一律に使う形は他系統の式で、原書の2式とは一致しない'));
  // the turbulent correlations themselves must not be written with Pr^(1/3)
  assert.doesNotMatch(svg,/0\.0296 Re_x\^0\.8 Pr\^\(1\/3\)/);
  assert.doesNotMatch(svg,/0\.032 Re_x\^0\.8 Pr\^\(1\/3\)/);
  assert.doesNotMatch(svg,/0\.037 Re_L\^0\.8 Pr\^\(1\/3\)/);
});

test('worked example (gas): average Nu, h, Q and the 5/4 factor agree',()=>{
  const U=n('data-uinf'),L=n('data-length'),W=n('data-width'),nu=n('data-nu');
  const Pr=n('data-pr-gas'),kf=n('data-k-fluid'),dT=n('data-dt');
  approx(U,10);approx(L,1);approx(W,.2);approx(nu,1.5e-5);
  approx(Pr,.7);approx(kf,.026);approx(dT,40);
  const ReL=U*L/nu;
  approx(n('data-re-l'),ReL,1e-3);
  const NuBar=0.037*Math.pow(ReL,0.8)*Math.pow(Pr,0.6);
  approx(n('data-nu-avg-gas'),NuBar,1e-7);
  const hBar=NuBar*kf/L;
  approx(n('data-h-avg'),hBar,1e-8);
  approx(n('data-q-total'),hBar*W*L*dT,1e-7);
  // local end value from (6.112); average is 5/4 of it, not the laminar factor 2
  const Nux=0.0296*Math.pow(ReL,0.8)*Math.pow(Pr,0.6);
  approx(n('data-nux-gas'),Nux,1e-7);
  approx(n('data-nu-avg-gas'),Nux*5/4,1e-6);
  approx(n('data-hx-end'),hBar*4/5,1e-8);
  for(const str of ['Nū_L = 0.037 Re_L^0.8 Pr^0.6 ≈ 1362.7','h̄_L ≈ 35.43 W/(m²·K)、片面 Q̇ ≈ 283.4 W','末端局所 h_x(L) = (4/5)h̄_L ≈ 28.34 W/(m²·K)'])
    assert.ok(svg.includes(str),str);
});

test('liquid local Nu_x at the same Re uses (6.113), bars proportional',()=>{
  const ReL=n('data-re-l'),PrL=n('data-pr-liquid');
  approx(PrL,7,1e-12);
  const NuxL=0.032*Math.pow(ReL,0.8)*Math.pow(PrL,0.43);
  approx(n('data-nux-liquid'),NuxL,1e-6);
  const scale=n('data-bar-scale');
  approx(rectWidth('bar-nux-gas'),n('data-nux-gas')*scale,0.6);
  approx(rectWidth('bar-nux-liquid'),n('data-nux-liquid')*scale,0.6);
  for(const s of ['乱流Pr Pr_t = ν_t/α_t は分子Prとは別のモデル量','前半が層流の板では §6.9 の履歴を含む積分が必要'])
    assert.ok(svg.includes(s),s);
});
