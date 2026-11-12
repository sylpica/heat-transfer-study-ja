import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-3-2-counterflow-lmtd.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const numeric=(key)=>{
  const match=svg.match(new RegExp('\\b'+key+'="([^"]+)"'));
  assert.ok(match,'missing parameter: '+key);
  const n=Number(match[1]);
  assert.ok(Number.isFinite(n),'invalid number for '+key);
  return n;
};
const p={
  Ch:numeric('data-ch-w-per-k'),Cc:numeric('data-cc-w-per-k'),
  H0:numeric('data-hot-in-c'),H1:numeric('data-hot-out-c'),
  C0:numeric('data-cold-in-c'),C1:numeric('data-cold-out-c'),
  Q:numeric('data-heat-w'),A:numeric('data-area-m2'),UA:numeric('data-ua-w-per-k')
};
const path=(id)=>{
  const match=svg.match(new RegExp('<path id="'+id+'"[^>]*d="([^"]+)"'));
  assert.ok(match,'missing path: '+id);
  return [...match[1].matchAll(/[ML]([0-9.]+),([0-9.]+)/g)].map(z=>[Number(z[1]),Number(z[2])]);
};

test('independent, accessible, self-contained SVG with light and dark colors',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 760 1240"/);
  assert.match(svg,/role="img" aria-labelledby="lmtd-title lmtd-desc"/);
  assert.match(svg,/<title id="lmtd-title">/);
  assert.match(svg,/<desc id="lmtd-desc">/);
  assert.match(svg,/data-lesson="3\.2"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/prefers-color-scheme:dark/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('energy balance, counterflow end differences, LMTD, UA and U',()=>{
  assert.equal(svg.includes('data-flow="counterflow"'),true);
  assert.equal(p.Ch,250);assert.equal(p.Cc,500);
  assert.equal(p.H0,100);assert.equal(p.H1,60);
  assert.equal(p.C0,20);assert.equal(p.C1,40);
  assert.equal(p.Q,10000);assert.equal(p.A,2);
  assert.equal(p.Ch*(p.H0-p.H1),p.Q);
  assert.equal(p.Cc*(p.C1-p.C0),p.Q);
  const dLeft=p.H0-p.C1,dRight=p.H1-p.C0;
  assert.equal(dLeft,60);assert.equal(dRight,40);
  const lmtd=(dLeft-dRight)/Math.log(dLeft/dRight);
  assert.ok(Math.abs(lmtd-49.326069247528636)<1e-10);
  assert.ok(Math.abs(p.UA-p.Q/lmtd)<1e-7);
  assert.ok(Math.abs(p.UA/p.A-101.3662770270411)<1e-7);
});

test('both 41-point plotted curves independently satisfy the counterflow energy solution',()=>{
  const hot=path('hot-profile'),cold=path('cold-profile');
  assert.equal(hot.length,41);assert.equal(cold.length,41);
  const D0=p.H0-p.C1,D1=p.H1-p.C0;
  const rate=Math.log(D0/D1);
  for(let i=0;i<41;i++){
    const s=i/40;
    const exp=Math.exp(-rate*s);
    const expectedHot=p.H0-(p.Q/p.Ch)*(1-exp)/(1-Math.exp(-rate));
    const expectedCold=expectedHot-D0*exp;
    const x=190+430*s;
    assert.ok(Math.abs(hot[i][0]-x)<0.011,'hot x '+i);
    assert.ok(Math.abs(cold[i][0]-x)<0.011,'cold x '+i);
    assert.ok(Math.abs(hot[i][1]-(800-2.25*expectedHot))<0.011,'hot temperature '+i);
    assert.ok(Math.abs(cold[i][1]-(800-2.25*expectedCold))<0.011,'cold temperature '+i);
    assert.ok(expectedHot>expectedCold,'positive temperature difference '+i);
    if(i){
      assert.ok(hot[i][1]>hot[i-1][1],'hot cools along x');
      assert.ok(cold[i][1]>cold[i-1][1],'cold cools along x, opposite its actual flow');
    }
  }
});

test('heat direction, field labels and local heat transfer derivative are consistent',()=>{
  for(const item of ['高温側：100 ℃ → 60 ℃','低温側：40 ℃ ← 20 ℃',
    '左端 ΔT = 60 K','右端 ΔT = 40 K','10,000 W',
    '49.326 K','202.733 W/K','101.37 W/(m²·K)'])assert.ok(svg.includes(item),item);
  const dLeft=p.H0-p.C1,rate=Math.log(dLeft/(p.H1-p.C0));
  const s=0.5, delta=dLeft*Math.exp(-rate*s),eps=1e-6;
  const H=x=>p.H0-(p.Q/p.Ch)*(1-Math.exp(-rate*x))/(1-Math.exp(-rate));
  const C=x=>H(x)-dLeft*Math.exp(-rate*x);
  assert.ok(Math.abs((H(s+eps)-H(s-eps))/(2*eps)+p.UA*delta/p.Ch)<1e-6);
  assert.ok(Math.abs((C(s+eps)-C(s-eps))/(2*eps)+p.UA*delta/p.Cc)<1e-6);
});
