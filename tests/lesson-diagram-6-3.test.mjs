import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-6-3-energy-equation-integral-balance.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
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
  assert.match(svg,/viewBox="0 0 820 1090"/);
  assert.match(svg,/role="img" aria-labelledby="title63 desc63"/);
  assert.match(svg,/<title id="title63">/);
  assert.match(svg,/<desc id="desc63">/);
  assert.match(svg,/data-lesson="6\.3"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/style="max-width:100%"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('integral balance: heat in equals downstream sensible-heat gain',()=>{
  const rho=n('data-rho'),cp=n('data-cp'),integ=n('data-integral');
  const W=n('data-width'),L=n('data-length'),dT=n('data-dt');
  approx(rho,1.2);approx(cp,1000);approx(integ,0.04);
  approx(W,.2);approx(L,.5);approx(dT,60);
  approx(n('data-t-wall')-n('data-t-inf'),dT);
  const qPerWidth=rho*cp*integ;
  approx(qPerWidth,48);
  approx(n('data-q-per-width'),qPerWidth);
  const Q=qPerWidth*W;
  approx(Q,9.6);
  approx(n('data-q-total'),Q);
  const qbar=Q/(W*L);
  approx(qbar,96);
  approx(n('data-qbar'),qbar);
  approx(n('data-hbar'),qbar/dT);
  approx(n('data-hbar'),1.6);
  // equal bars: the balance closes
  approx(rectWidth('bar-in'),rectWidth('bar-out'),0.001);
  assert.ok(svg.includes('平均 h̄ = 96.0/60 = 1.60 W/(m²·K)'));
});

test('energy-equation reduction and wall Fourier law are stated with limits',()=>{
  for(const s of ['u∂T/∂x + v∂T/∂y = α_f ∂²T/∂y²（原書 6.40）',
    'q_w″ = −k_f (∂T/∂y)_w',
    '対流熱伝達でFourier則が消えるわけではない',
    '局所 h_x は壁面勾配が必要で、この積分値だけからは決まらない',
    '粘性散逸 Φ、低Peでは軸方向伝導を再検討する'])
    assert.ok(svg.includes(s),s);
});
