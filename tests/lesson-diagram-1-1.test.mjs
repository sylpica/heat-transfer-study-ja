import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../assets/lesson-diagrams/section-1-1-heat-rate-flux-integrals.svg', import.meta.url), 'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const num = name => {
  const m = svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m, `missing SVG attribute: ${name}`);
  const x = Number(m[1]);
  assert.ok(Number.isFinite(x), `nonfinite SVG attribute: ${name}`);
  return x;
};
const close = (got, expected, tol=1e-9) => assert.ok(Math.abs(got-expected) < tol, `${got} vs ${expected}`);
const p = {
  b:num('data-width'), L:num('data-length'), intercept:num('data-flux-intercept'),
  slope:num('data-flux-slope-per-m'), left:num('data-flux-start'),
  right:num('data-flux-end'), avg:num('data-flux-average'),
  area:num('data-area'), rate:num('data-heat-rate-out'),
  duration:num('data-duration'), Q:num('data-energy-out'),
  dU:num('data-internal-energy-change'), points:num('data-curve-points'),
};

test('standalone original accessible SVG and responsive dark theme', () => {
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 900 1260"/);
  assert.match(svg, /role="img" aria-labelledby="heat-title heat-desc"/);
  assert.match(svg, /<title id="heat-title">/);
  assert.match(svg, /<desc id="heat-desc">/);
  assert.match(svg, /data-lesson="1\.1"/);
  assert.match(svg, /data-origin="original-app-diagram"/);
  assert.match(svg, /@media\(prefers-color-scheme:dark\)/);
  assert.doesNotMatch(svg, /<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('surface area integration reconstructs heat rate and area-averaged flux independently', () => {
  assert.deepEqual([p.b,p.L,p.intercept,p.slope,p.duration],[.5,1,100,200,20]);
  close(p.area,p.b*p.L);
  close(p.left,p.intercept);
  close(p.right,p.intercept+p.slope*p.L);
  const analytic = p.b*(p.intercept*p.L + p.slope*p.L*p.L/2);
  close(p.rate,analytic);
  close(p.rate,100);
  close(p.avg,p.rate/p.area);
  close(p.avg, (p.left+p.right)/2);
  close(p.avg,200);
  assert.ok(p.avg<p.right && p.avg>p.left);
});

test('41-point heat-flux graph is dimensionally consistent and monotonic with correct plot scales', () => {
  const d=svg.match(/<path id="flux-profile" class="profile" d="([^"]+)"\/>/)?.[1];
  assert.ok(d,'profile path missing');
  const pts=[...d.matchAll(/[ML]([0-9.]+),([0-9.]+)/g)].map(m=>[+m[1],+m[2]]);
  assert.equal(p.points,41); assert.equal(pts.length,p.points);
  let sum=0;
  pts.forEach(([x,y],i)=>{
    const u=i/(p.points-1), q=p.intercept+p.slope*p.L*u;
    close(x,152+608*u,0.0006);
    close(y,482-0.59*q,0.0006);
    if(i)assert.ok(x>pts[i-1][0] && y<pts[i-1][1]);
    sum+=(i===0||i===p.points-1?0.5:1)*q;
  });
  close(p.b*p.L*sum/(p.points-1),p.rate,0.00001);
  assert.match(svg, /id="flux-under-curve"/);
});

test('time integral and sign convention are not confused with internal energy', () => {
  close(p.Q,p.rate*p.duration);
  close(p.Q,2000);
  close(p.dU,-p.Q);
  assert.match(svg,/data-boundary-convention="outward-positive"/);
  assert.match(svg,/data-heat-time-dependence="constant"/);
  assert.match(svg,/閉じた系・仕事なし・他の流出入なし/);
  assert.match(svg,/ΔU = −2,000 J/);
  assert.match(svg,/時間積分 = 2,000 J/);
  assert.match(svg,/Q_out = ∫Q̇ dt/);
});

test('annotations explicitly distinguish W, J, W/m², average vs local maximum and model boundaries', () => {
  for(const expected of [
    'J・W・W/m²を区別する',
    '外向き熱流束 q″ [W/m²]',
    '面積 A = 0.50 m²',
    '最大300とは違う',
    '熱移動率　Q̇_out = 100 W',
    '移動熱量　Q_out = 2,000 J',
    '局所流束を面積積分',
    '内部エネルギーUは状態量',
    '原著図版の転載やトレースなし',
  ]) assert.ok(svg.includes(expected), `missing caveat ${expected}`);
});
