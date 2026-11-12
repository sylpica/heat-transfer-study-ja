import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg = readFileSync(new URL('../assets/lesson-diagrams/section-1-2-energy-balance-vs-heat-equation.svg', import.meta.url), 'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
function val(name) {
  const m = svg.match(new RegExp('\\b' + name + '="([^"]+)"'));
  assert.ok(m, `Missing ${name}`);
  const number = Number(m[1]);
  assert.ok(Number.isFinite(number), `Not numeric: ${name}`);
  return number;
}
function near(a,b,tol=1e-8) {
  assert.ok(Math.abs(a-b) <= tol, `${a} differs from ${b} (tolerance ${tol})`);
}
const p={
  m:val('data-mass-kg'),c:val('data-heat-capacity-j-kg-k'),
  T0:val('data-t-in-c'),Ttarget:val('data-t-target-c'),
  P:val('data-heater-power-w'),loss:val('data-loss-power-w'),
  C:val('data-capacity-j-k'),net:val('data-net-power-w'),
  dU:val('data-stored-energy-j'),time:val('data-heating-time-s'),
  noLossTime:val('data-no-loss-time-s'),pts:val('data-graph-points')
};

test('standalone original SVG is accessible, responsive and dark-mode aware',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 880 1350"/);
  assert.match(svg,/role="img" aria-labelledby="heating-title heating-desc"/);
  assert.match(svg,/<title id="heating-title">/);
  assert.match(svg,/<desc id="heating-desc">/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="1\.2"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
  assert.ok(svg.includes('独自作図'));
});

test('first law, thermal storage, net rate and two heating durations independently agree',()=>{
  assert.deepEqual([p.m,p.c,p.T0,p.Ttarget,p.P,p.loss],[2,500,20,30,200,50]);
  near(p.C,p.m*p.c);near(p.C,1000);
  near(p.net,p.P-p.loss);near(p.net,150);
  near(p.dU,p.C*(p.Ttarget-p.T0));near(p.dU,10000);
  near(p.time,p.dU/p.net);near(p.time,66.66666666666667);
  near(p.noLossTime,p.dU/p.P);near(p.noLossTime,50);
  near(p.net*p.time,p.dU);near(p.P*p.noLossTime,p.dU);
  assert.ok(p.time>p.noLossTime);
});

test('41 points on both curves match independent constant-power energy balances',()=>{
  assert.equal(p.pts,41);
  const data=[['fixed-loss-curve',p.net],['no-loss-curve',p.P]];
  for(const [id,power] of data){
    const d=svg.match(new RegExp('<path id="'+id+'" class="[^"]+" d="([^"]+)"\\/>'))?.[1];
    assert.ok(d,`Missing ${id}`);
    const pts=[...d.matchAll(/[ML]([0-9.]+),([0-9.]+)/g)].map(m=>[Number(m[1]),Number(m[2])]);
    assert.equal(pts.length,41);
    pts.forEach(([px,py],i)=>{
      const t=75*i/40;
      const T=p.T0+power*t/p.C;
      near(px,185+545*t/75,0.00051);
      near(py,862-250*(T-20)/16,0.00051);
      if(i)assert.ok(py<pts[i-1][1],`${id} must warm monotonically`);
    });
  }
});

test('30-degree event markers coincide with analytical intersection times',()=>{
  const y30=862-250*(30-20)/16;
  for(const [id,circle,time] of [
    ['time-50','no-loss-30c',p.noLossTime],
    ['time-66','with-loss-30c',p.time]
  ]){
    const d=svg.match(new RegExp('<path id="'+id+'" class="event" d="M([0-9.]+) ([0-9.]+) V862"\\/>'));
    const c=svg.match(new RegExp('<circle id="'+circle+'" class="[^"]+" cx="([0-9.]+)" cy="([0-9.]+)" r="7"\\/>'));
    assert.ok(d,`${id} missing`);assert.ok(c,`${circle} missing`);
    near(Number(d[1]),185+545*time/75,0.00051);
    near(Number(d[2]),y30,0.00051);
    near(Number(c[1]),Number(d[1]));near(Number(c[2]),y30,0.00051);
  }
});

test('distinguishes conservation, transport law and applicability of two separate models',()=>{
  assert.match(svg,/data-heating-model="lumped-fixed-power-fixed-loss"/);
  assert.match(svg,/data-local-equation-model="constant-properties-conduction"/);
  for(const sentence of [
    '閉じた金属塊：入力・損失・蓄積を分ける',
    '同じ10,000 Jでも、加熱時間は違う',
    '損失なし（200 W）',
    '損失50 W（正味150 W）',
    '仕事・質量出入り・他の熱経路なし',
    'ΔU = m c ΔT = 10,000 J',
    't = ΔU/(P − Q_loss) ≈ 66.67 s',
    '局所保存則＋Fourier則',
    'ρc ∂T/∂t = k ∂²T/∂x² + q_gen',
    'q_gen は体積発熱率 [W/m³]',
    '温度一様の物体モデルと局所PDEを混同しない'
  ])assert.ok(svg.includes(sentence),`Missing physical limitation: ${sentence}`);
  // A heat capacity equation and spatial PDE apply to distinct, documented assumptions.
  assert.ok(svg.includes('1次元・均質・一定 k, ρ, c'));
});
