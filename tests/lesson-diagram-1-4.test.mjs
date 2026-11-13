import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-1-4-roadmap-series-resistance.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
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

test('§1.4 independent SVG is accessible, offline-safe and supports dark mode',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/data-lesson="1\.4"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/viewBox="0 0 840 1090"/);
  assert.match(svg,/role="img" aria-labelledby="title1-4 desc1-4"/);
  assert.match(svg,/<title id="title1-4">/);
  assert.match(svg,/<desc id="desc1-4">/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('series-resistance example recomputes both ways to the surface temperature',()=>{
  const rCond=num('data-l')/(num('data-k')*num('data-area'));
  const rConv=1/(num('data-h')*num('data-area'));
  near(rCond,num('data-rcond'),1e-12);
  near(rConv,num('data-rconv'),1e-12);
  near(rCond+rConv,num('data-rtot'),1e-12);
  const q=(num('data-tin')-num('data-tfluid'))/(rCond+rConv);
  near(q,num('data-q'),1e-9);
  near(q*rCond,num('data-drop-cond'),1e-9);
  near(q*rConv,num('data-drop-conv'),1e-9);
  near(num('data-drop-cond')+num('data-drop-conv'),num('data-tin')-num('data-tfluid'),1e-9);
  near(num('data-tin')-num('data-drop-cond'),num('data-ts'),1e-9);
  near(num('data-tfluid')+num('data-drop-conv'),num('data-ts'),1e-9);
});

test('temperature-drop bars share one scale',()=>{
  const total=num('data-tin')-num('data-tfluid');
  near(widthOf('drop-cond'),480*num('data-drop-cond')/total,0.5);
  near(widthOf('drop-conv'),480*num('data-drop-conv')/total,0.5);
});

test('the book roadmap of three tasks is shown',()=>{
  for(const s of ['課題1','課題2','課題3','285.7 W','77.14','Part II','Part III','Part IV'])
    assert.ok(svg.includes(s),s);
});
