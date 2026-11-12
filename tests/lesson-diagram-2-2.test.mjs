import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-2-2-slab-method-linear-profile.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
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

test('§2.2 independent SVG is accessible, offline-safe and supports dark mode',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/data-lesson="2\.2"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/viewBox="0 0 840 1210"/);
  assert.match(svg,/role="img" aria-labelledby="title2-2 desc2-2"/);
  assert.match(svg,/<title id="title2-2">/);
  assert.match(svg,/<desc id="desc2-2">/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('slab slope, flux, rate and resistance recompute consistently',()=>{
  const slope=(num('data-t2')-num('data-t1'))/num('data-l');
  near(slope,num('data-slope'),1e-9);
  const qflux=-num('data-k')*slope;
  near(qflux,num('data-qflux'),1e-9);
  near(qflux*num('data-area'),num('data-q'),1e-9);
  const R=num('data-l')/(num('data-k')*num('data-area'));
  near(R,num('data-r'),1e-12);
  near((num('data-t1')-num('data-t2'))/R,num('data-q'),1e-9);
});

test('21 plotted points match the linear profile',()=>{
  const m=svg.match(/<path id="temp-line"[^>]*d="([^"]+)"/);
  assert.ok(m,'profile path is missing');
  const coords=[...m[1].matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(([,x,y])=>[Number(x),Number(y)]);
  assert.equal(coords.length,21);
  const x0=num('data-plot-x0'),x1=num('data-plot-x1'),yT1=num('data-plot-y-t1'),ys=num('data-plot-yscale');
  for(let i=0;i<21;i++){
    const T=num('data-t1')+num('data-slope')*(num('data-l')*i/20);
    near(coords[i][0],x0+(x1-x0)*i/20,0.11);
    near(coords[i][1],yT1+(num('data-t1')-T)*ys,0.11);
    if(i)assert.ok(coords[i][1]>coords[i-1][1],'temperature falls monotonically');
  }
});

test('the eight-step method and resistance cross-check are shown',()=>{
  for(const s of ['解法の8ステップ','60 − 200x','800 W/m²','1600 W','0.025 K/W','知り得ない情報'])
    assert.ok(svg.includes(s),s);
});
