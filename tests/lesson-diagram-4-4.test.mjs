import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-4-4-shape-factor-scaling.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const num=(attribute)=>{
  const found=svg.match(new RegExp('\\b'+attribute+'="([^"]+)"'));
  assert.ok(found,'Missing data attribute '+attribute);
  const value=Number(found[1]);
  assert.ok(Number.isFinite(value),attribute+' must be finite');
  return value;
};
const widthOf=(id)=>{
  const found=svg.match(new RegExp('id="'+id+'"[^>]*width="([\\d.]+)"'));
  assert.ok(found,'Missing rect '+id);
  return Number(found[1]);
};
const near=(actual,expected,tolerance=1e-7)=>{
  assert.ok(Math.abs(actual-expected)<=tolerance,actual+' differs from '+expected);
};

test('§4.4 independent SVG is accessible, offline-safe and supports dark mode',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/data-lesson="4\.4"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/viewBox="0 0 840 1050"/);
  assert.match(svg,/role="img" aria-labelledby="title4-4 desc4-4"/);
  assert.match(svg,/<title id="title4-4">/);
  assert.match(svg,/<desc id="desc4-4">/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('shape-factor rate and the doubled-geometry rate recompute',()=>{
  near(num('data-s-ratio')*num('data-l'),num('data-s'),1e-12);
  near(num('data-k')*num('data-s')*num('data-dt'),num('data-q'),1e-9);
  near(num('data-s-ratio')*2*num('data-l'),num('data-s2'),1e-12);
  near(num('data-k')*num('data-s2')*num('data-dt'),num('data-q2'),1e-9);
  near(num('data-q2')/num('data-q'),2,1e-12);
  near((num('data-q2')/4)/num('data-q'),0.5,1e-12);
});

test('rate bars and body sketches keep the factor-two scaling',()=>{
  near(widthOf('bar-q2'),2*widthOf('bar-q1'),0.01);
  const bodies=[...svg.matchAll(/<rect class="body[12]"[^>]*width="([\d.]+)" height="([\d.]+)"/g)].map(([,w,h])=>[Number(w),Number(h)]);
  assert.equal(bodies.length,2);
  near(bodies[1][0],2*bodies[0][0],0.01);
  near(bodies[1][1],2*bodies[0][1],0.01);
});

test('scaling conclusions and the Gamma-definition caution are shown',()=>{
  for(const s of ['120 W','240 W','S/L = 2.50','Γ','平均流束は半分','次元解析だけで求めたとはしない'])
    assert.ok(svg.includes(s),s);
});
