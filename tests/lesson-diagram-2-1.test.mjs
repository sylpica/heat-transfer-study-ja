import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-2-1-heat-equation-control-volume.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
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

test('§2.1 independent SVG is accessible, offline-safe and supports dark mode',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/data-lesson="2\.1"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/viewBox="0 0 840 1290"/);
  assert.match(svg,/role="img" aria-labelledby="title2-1 desc2-1"/);
  assert.match(svg,/<title id="title2-1">/);
  assert.match(svg,/<desc id="desc2-1">/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('generating-slab results and the overall balance recompute',()=>{
  const L=num('data-l'),k=num('data-k'),qg=num('data-qgen'),Tw=num('data-tw');
  near(Tw+qg*L*L/(8*k),num('data-tmax'),1e-9);
  near(-qg*L/2,num('data-qleft'),1e-9);
  near(qg*L/2,num('data-qright'),1e-9);
  near(qg*L,num('data-gen-area'),1e-9);
  near(num('data-qright')-num('data-qleft'),num('data-gen-area'),1e-9);
});

test('41 plotted points match the parabolic profile and its symmetry',()=>{
  const m=svg.match(/<path id="temp-parabola"[^>]*d="([^"]+)"/);
  assert.ok(m,'parabola path is missing');
  const coords=[...m[1].matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(([,x,y])=>[Number(x),Number(y)]);
  assert.equal(coords.length,41);
  const L=num('data-l'),k=num('data-k'),qg=num('data-qgen'),Tw=num('data-tw');
  const x0=num('data-plot-x0'),x1=num('data-plot-x1'),yb=num('data-plot-ybase'),ys=num('data-plot-yscale');
  for(let i=0;i<41;i++){
    const x=L*i/40;
    const T=Tw+qg/(2*k)*x*(L-x);
    near(coords[i][0],x0+(x1-x0)*i/40,0.11);
    near(coords[i][1],yb-(T-Tw)*ys,0.11);
    near(coords[i][1],coords[40-i][1],0.11);
  }
  near(coords[20][1],yb-(num('data-tmax')-Tw)*ys,0.11);
  assert.ok(coords[20][1]<coords[0][1]&&coords[20][1]<coords[40][1],'center is the peak');
});

test('governing equations and applicability limits are shown',()=>{
  for(const s of ['∇·(k∇T) + q̇ = ρc ∂T/∂t','（2.10）','（2.11）','3200 W/m²','30.8 ℃','静止した媒体'])
    assert.ok(svg.includes(s),s);
});
