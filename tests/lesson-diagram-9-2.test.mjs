import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg = readFileSync(new URL('../assets/lesson-diagrams/section-9-2-spherical-bubble-laplace-pressure.svg', import.meta.url), 'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const attr = name => {
  const match = svg.match(new RegExp('\\b' + name + '="([^"]+)"'));
  assert.ok(match, 'Missing SVG attribute ' + name);
  const value = Number(match[1]);
  assert.ok(Number.isFinite(value), 'Nonfinite SVG attribute ' + name);
  return value;
};
const near = (x, y, eps = 1e-8) => assert.ok(Math.abs(x-y) < eps, String(x) + ' != ' + String(y));
const circle = id => {
  const tag = svg.match(new RegExp('<circle id="' + id + '"[^>]+/>'))?.[0];
  assert.ok(tag, 'Missing circle ' + id);
  const get = name => Number(tag.match(new RegExp('\\b' + name + '="([^"]+)"'))?.[1]);
  return {cx: get('cx'), cy: get('cy'), radius: get('r')};
};

test('SVG is original, accessible, dark-mode aware and offline self-contained', () => {
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 880 1470"/);
  assert.match(svg, /role="img" aria-labelledby="bubble-title bubble-description"/);
  assert.match(svg, /<title id="bubble-title">/);
  assert.match(svg, /<desc id="bubble-description">/);
  assert.match(svg, /data-origin="original-app-diagram"/);
  assert.match(svg, /data-lesson="9\.2"/);
  assert.match(svg, /@media\(prefers-color-scheme:dark\)/);
  assert.match(svg, /原著図版の転載・トレースなし/);
  assert.doesNotMatch(svg, /<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('Laplace pressure and radius agree under the given SI conditions', () => {
  const sigma = attr('data-surface-tension-nm');
  const p1 = attr('data-pressure-a-pa');
  const p2 = attr('data-pressure-b-pa');
  const r1 = attr('data-radius-a-m');
  const r2 = attr('data-radius-b-m');
  assert.deepEqual([sigma,p1,p2],[.05,2500,5000]);
  near(r1, 2*sigma/p1, 1e-13);
  near(r2, 2*sigma/p2, 1e-13);
  near(r1*1e6, 40, 1e-9);
  near(r2*1e6, 20, 1e-9);
  near(p2/p1, 2);
  near(r1/r2, 2);
  assert.ok(p1>0 && p2>0 && r1>0 && r2>0);
});

test('schematic bubble radii have a 2:1 ratio, not false full-size geometry', () => {
  const a = circle('bubble-a');
  const b = circle('bubble-b');
  near(a.radius, attr('data-drawing-radius-a'));
  near(b.radius, attr('data-drawing-radius-b'));
  near(a.radius/b.radius, 2);
  near(a.cx, 235);
  near(b.cx, 637);
  near(a.cy, b.cy);
  assert.match(svg, /半径の比だけを正しく描画/);
  assert.match(svg, /実寸・壁付着泡ではない/);
  assert.match(svg, /data-equilibrium-model="static-spherical-laplace"/);
});

test('pressure versus radius graph has 21 correct and strictly declining points', () => {
  assert.equal(attr('data-graph-points'), 21);
  const d = svg.match(/<path id="laplace-pressure-curve" class="curve" d="([^"]+)"\/>/)?.[1];
  assert.ok(d, 'Missing Laplace pressure curve');
  const pts = [...d.matchAll(/[ML]([0-9.]+) ([0-9.]+)/g)].map(x => [Number(x[1]),Number(x[2])]);
  assert.equal(pts.length, 21);
  for(let i=0;i<pts.length;i++) {
    const r = 20+4*i;
    const dpKpa = 2*attr('data-surface-tension-nm')/(r*1e-6)/1000;
    near(pts[i][0], 140+6.6*(r-20), .00051);
    near(pts[i][1], 1010-50*dpKpa, .00051);
    if(i) {
      assert.ok(pts[i][0] > pts[i-1][0]);
      assert.ok(pts[i][1] > pts[i-1][1]);
    }
  }
  const a = circle('point-a');
  const b = circle('point-b');
  near(a.cx, 272); near(a.cy, 885);
  near(b.cx, 140); near(b.cy, 760);
  assert.ok(b.cy<a.cy, 'larger pressure is higher on the chart');
});

test('annotations preserve dimensions, pressure convention and physical limitations', () => {
  for(const needle of [
    'Δp = p_v − p_l = 2σ/R',
    'A. Δp = 2.5 kPa → R = 40 μm',
    'B. Δp = 5.0 kPa → R = 20 μm',
    '2.5 kPa = 2500 Pa',
    'R_A = 0.100/2500 m = 40 μm',
    'R_B = 0.100/5000 m = 20 μm',
    '球形・静止・表面張力一定の力学モデルのみ',
    '実際の核生成開始・離脱径・CHF・安全条件は予測しない'
  ]) assert.ok(svg.includes(needle), needle);
  assert.doesNotMatch(svg, /CHF\s*(?:=|≃|≈)\s*\d/i);
});
