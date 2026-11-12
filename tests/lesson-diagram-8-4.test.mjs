import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg = readFileSync(new URL('../assets/lesson-diagrams/section-8-4-natural-convection-orientation.svg', import.meta.url), 'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const numeric = name => {
  const match = svg.match(new RegExp('\\b' + name + '="([^"]+)"'));
  assert.ok(match, 'Missing ' + name);
  const result = Number(match[1]);
  assert.ok(Number.isFinite(result), 'Nonfinite ' + name);
  return result;
};
const near = (actual, expected, tolerance=1e-6) => assert.ok(
  Math.abs(actual-expected)<tolerance, String(actual)+' !== '+String(expected));
const p = {
  g: numeric('data-g'), beta: numeric('data-beta'), dT: numeric('data-dt'),
  L: numeric('data-length'), nu: numeric('data-nu'), alpha: numeric('data-alpha'),
  k: numeric('data-fluid-k'), A: numeric('data-area'),
  Gr: numeric('data-gr'), Pr: numeric('data-pr'), Ra: numeric('data-ra'),
  Nu: numeric('data-nusselt'), h: numeric('data-h'), Q: numeric('data-q'),
  low: numeric('data-correlation-min-ra'), high: numeric('data-correlation-max-ra')
};

test('accessible independent SVG, responsive layout and offline-only dependencies', () => {
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 820 1260"/);
  assert.match(svg, /role="img" aria-labelledby="natural-title natural-desc"/);
  assert.match(svg, /<title id="natural-title">/);
  assert.match(svg, /<desc id="natural-desc">/);
  assert.match(svg, /data-lesson="8\.4"/);
  assert.match(svg, /data-origin="original-app-diagram"/);
  assert.match(svg, /prefers-color-scheme:dark/);
  assert.match(svg, /アプリ作成の独自模式図/);
  assert.doesNotMatch(svg, /<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('independently recomputed Gr, Pr, and Ra match the values embedded in the diagram', () => {
  assert.deepEqual([p.g,p.beta,p.dT,p.L,p.nu,p.alpha,p.k,p.A],
    [9.81,.003,10,.20,1.5e-5,2e-5,.026,.50]);
  const Gr = p.g*p.beta*p.dT*p.L**3/p.nu**2;
  const Pr = p.nu/p.alpha;
  const Ra = p.g*p.beta*p.dT*p.L**3/(p.nu*p.alpha);
  near(p.Gr,Gr,1e-6);
  near(p.Pr,Pr,1e-12);
  near(p.Ra,Ra,1e-6);
  near(p.Gr*p.Pr,p.Ra,1e-6);
  near(p.Ra,7848000,1e-6);
  assert.ok(p.Ra>=p.low && p.Ra<=p.high);
});

test('vertical isothermal plate example uses the stated Churchill-Chu correlation', () => {
  const nuAvg=.68+.670*p.Ra**.25/(1+(.492/p.Pr)**(9/16))**(4/9);
  const hAvg=nuAvg*p.k/p.L;
  const q=hAvg*p.A*p.dT;
  near(p.Nu,nuAvg,1e-7);
  near(p.h,hAvg,1e-7);
  near(p.Q,q,1e-7);
  near(p.Q,18.2420036,1e-7);
  for(const token of ['7.848×10⁶','28.06','3.65 W/(m²·K)','18.24 W']) {
    assert.ok(svg.includes(token),token);
  }
  assert.ok(svg.includes('Ra ≲ 10⁹（層流）'));
});

test('geometries are distinguished and a vertical-plate Nu is not transferred to horizontal faces', () => {
  for(const token of [
    'A. 加熱された垂直平板','B. 水平板の熱い上面',
    'C. 水平板の熱い下面','壁面近くの流体が上昇',
    '上昇流が発達しやすい','暖気が下側に滞留',
    '抑えられる場合がある','水平板・円柱に上式を流用しない',
    '対流成分のみ','放射損失は含めない'
  ]) assert.ok(svg.includes(token),token);
  assert.doesNotMatch(svg, /data-correlation-geometry="horizontal"/);
});
