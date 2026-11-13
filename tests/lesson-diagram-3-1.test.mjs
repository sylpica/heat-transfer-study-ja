import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-3-1-hx-configurations-balance.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
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

test('§3.1 independent SVG is accessible, offline-safe and supports dark mode',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/data-lesson="3\.1"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/viewBox="0 0 840 1130"/);
  assert.match(svg,/role="img" aria-labelledby="title3-1 desc3-1"/);
  assert.match(svg,/<title id="title3-1">/);
  assert.match(svg,/<desc id="desc3-1">/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('energy balance, maximum rate and effectiveness recompute',()=>{
  near(num('data-mh')*num('data-cp'),num('data-ch'),1e-9);
  near(num('data-mc')*num('data-cp'),num('data-cc'),1e-9);
  const q=num('data-ch')*(num('data-th-in')-num('data-th-out'));
  near(q,num('data-q'),1e-9);
  near(num('data-tc-in')+q/num('data-cc'),num('data-tc-out'),1e-9);
  const qmax=Math.min(num('data-ch'),num('data-cc'))*(num('data-th-in')-num('data-tc-in'));
  near(qmax,num('data-qmax'),1e-9);
  near(q/qmax,num('data-eps'),1e-12);
  assert.ok(num('data-eps')>=0&&num('data-eps')<=1);
  assert.ok(num('data-tc-out')<num('data-th-out'),'outlets stay consistent with parallel flow');
});

test('rate bars keep the effectiveness ratio',()=>{
  near(widthOf('bar-q')/widthOf('bar-qmax'),num('data-eps'),0.005);
});

test('three configurations and balance figures are shown',()=>{
  for(const s of ['並流・向流','シェル＆チューブ','直交流','48.0 kW','35 ℃','ε = 0.40','フィン'])
    assert.ok(svg.includes(s),s);
});
