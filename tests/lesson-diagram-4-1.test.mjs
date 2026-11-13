import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-4-1-well-posed-boundary-conditions.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const num=(attribute)=>{
  const found=svg.match(new RegExp('\\b'+attribute+'="([^"]+)"'));
  assert.ok(found,'Missing data attribute '+attribute);
  const value=Number(found[1]);
  assert.ok(Number.isFinite(value),attribute+' must be finite');
  return value;
};
const near=(actual,expected,tolerance=1e-7)=>{
  assert.ok(Math.abs(actual-expected)<=tolerance,actual+' differs from '+expected);
};

test('§4.1 independent SVG is accessible, offline-safe and supports dark mode',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/data-lesson="4\.1"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/viewBox="0 0 840 1180"/);
  assert.match(svg,/role="img" aria-labelledby="title4-1 desc4-1"/);
  assert.match(svg,/<title id="title4-1">/);
  assert.match(svg,/<desc id="desc4-1">/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('mixed Dirichlet-Neumann slab solution recomputes and balances',()=>{
  const slope=-num('data-qout')/num('data-k');
  near(slope,num('data-slope'),1e-12);
  near(num('data-t0')+slope*num('data-l'),num('data-tl'),1e-9);
  near(-num('data-k')*slope,num('data-qout'),1e-9);
});

test('21 plotted points match the linear profile',()=>{
  const m=svg.match(/<path id="temp-line-4-1"[^>]*d="([^"]+)"/);
  assert.ok(m,'profile path is missing');
  const coords=[...m[1].matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(([,x,y])=>[Number(x),Number(y)]);
  assert.equal(coords.length,21);
  const x0=num('data-plot-x0'),x1=num('data-plot-x1'),yT0=num('data-plot-y-t0'),ys=num('data-plot-yscale');
  for(let i=0;i<21;i++){
    const T=num('data-t0')+num('data-slope')*(num('data-l')*i/20);
    near(coords[i][0],x0+(x1-x0)*i/20,0.11);
    near(coords[i][1],yT0+(num('data-t0')-T)*ys,0.11);
    if(i)assert.ok(coords[i][1]>coords[i-1][1],'temperature falls monotonically');
  }
});

test('well-posed components and the three boundary condition types are shown',()=>{
  for(const s of ['適正問題','初期条件','第1種','第2種','第3種','−k ∂T/∂x = h(T−T∞)','T(L) = 90 ℃'])
    assert.ok(svg.includes(s),s);
});
