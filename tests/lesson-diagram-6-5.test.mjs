import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-6-5-laminar-local-average-nusselt.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
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
const profile=(id)=>{
  const m=svg.match(new RegExp('<path id="'+id+'"[^>]*d="([^"]+)"\\s*/>'));
  assert.ok(m,'missing '+id);
  return [...m[1].matchAll(/[ML]([0-9.]+) ([0-9.]+)/g)].map(z=>[Number(z[1]),Number(z[2])]);
};

test('original, accessible, responsive and offline-safe SVG',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 820 1120"/);
  assert.match(svg,/role="img" aria-labelledby="title65 desc65"/);
  assert.match(svg,/<title id="title65">/);
  assert.match(svg,/<desc id="desc65">/);
  assert.match(svg,/data-lesson="6\.5"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/style="max-width:100%"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('worked example: average Nu, h, total heat and end local h agree',()=>{
  const U=n('data-uinf'),L=n('data-length'),W=n('data-width'),nu=n('data-nu');
  const Pr=n('data-pr'),kf=n('data-k-fluid'),dT=n('data-dt');
  approx(U,3);approx(L,.3);approx(W,.2);approx(nu,1.5e-5);
  approx(Pr,.7);approx(kf,.026);approx(dT,40);
  const ReL=U*L/nu;
  approx(ReL,60000);approx(n('data-re-l'),ReL);
  const NuBar=0.664*Math.sqrt(ReL)*Math.pow(Pr,1/3);
  approx(n('data-nu-avg'),NuBar,1e-9);
  const hBar=NuBar*kf/L;
  approx(n('data-h-avg'),hBar,1e-8);
  approx(n('data-q-total'),hBar*W*L*dT,1e-8);
  approx(n('data-hx-end'),hBar/2,1e-8);
  for(const str of ['Nū_L = 0.664 Re_L^(1/2) Pr^(1/3) ≈ 144.4','片面 Q̇ = h̄_L W L ΔT ≈ 30.04 W'])
    assert.ok(svg.includes(str),str);
});

test('h_x curve points follow the local correlation (book 6.58)',()=>{
  const U=n('data-uinf'),nu=n('data-nu'),Pr=n('data-pr'),kf=n('data-k-fluid');
  const pts=profile('hx-curve');
  assert.equal(pts.length,29);
  for(let i=0;i<pts.length;i++){
    const x=0.02+0.28*i/28;
    approx(pts[i][0],120+(x/0.3)*600,0.011);
    const hx=0.332*Math.sqrt(U*x/nu)*Math.pow(Pr,1/3)*kf/x;
    approx(pts[i][1],470-(hx/26)*290,0.75);
    if(i)assert.ok(pts[i][1]>pts[i-1][1],'h_x must decrease downstream');
  }
  // curve endpoint equals the stated end local value
  const lastY=470-(n('data-hx-end')/26)*290;
  approx(pts[pts.length-1][1],lastY,0.05);
});

test('conditions and the factor-of-two warning are stated',()=>{
  for(const s of ['Nu_x = 0.332 Re_x^(1/2) Pr^(1/3)（原書 6.58、Pr ≳ 0.6）',
    '末端の局所 h を全板に使うと熱流を半分に見積もる',
    '等熱流束では係数が変わる（原書 6.71）',
    'x→0 の発散は近似の産物'])
    assert.ok(svg.includes(s),s);
});
