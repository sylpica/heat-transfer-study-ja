import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-1-3-three-modes-comparison.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
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

test('§1.3 independent SVG is accessible, offline-safe and supports dark mode',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/data-lesson="1\.3"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/viewBox="0 0 840 1162"/);
  assert.match(svg,/role="img" aria-labelledby="title1-3 desc1-3"/);
  assert.match(svg,/<title id="title1-3">/);
  assert.match(svg,/<desc id="desc1-3">/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('three mode rates recompute from the stated conditions',()=>{
  const A=num('data-area'),dT=num('data-dt');
  const qCond=num('data-k')*A*dT/num('data-l');
  near(qCond,num('data-qcond'),1e-9);
  near(qCond/A,num('data-qcond-flux'),1e-9);
  const qConv=num('data-h')*A*dT;
  near(qConv,num('data-qconv'),1e-9);
  near(qConv/A,num('data-qconv-flux'),1e-9);
  const qRad=num('data-eps')*num('data-sigma')*A*(num('data-t')**4-num('data-tsur')**4);
  near(qRad,num('data-qrad'),1e-6);
  near(qRad/A,num('data-qrad-flux'),1e-6);
  near(qRad,54.11,0.01);
});

test('comparison bars are proportional to the three rates',()=>{
  const scale=460/num('data-qcond');
  near(widthOf('bar-cond'),num('data-qcond')*scale,0.6);
  near(widthOf('bar-conv'),num('data-qconv')*scale,0.6);
  near(widthOf('bar-rad'),num('data-qrad')*scale,0.6);
});

test('visible values and the not-summable caution are present',()=>{
  for(const s of ['200 W','100 W','54.11 W','400 W/m²','108.2 W/m²','合計して一つの壁の収支にはできない','絶対温度'])
    assert.ok(svg.includes(s),s);
});
