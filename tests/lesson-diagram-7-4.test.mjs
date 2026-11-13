import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-7-4-constant-wall-temperature-ntu.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const num=(name)=>{
  const match=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(match,'missing numeric field: '+name);
  const n=Number(match[1]);
  assert.ok(Number.isFinite(n),'nonfinite field: '+name);
  return n;
};
const p={Ts:num('data-ts'),Tin:num('data-tin'),mdot:num('data-mdot'),
  cp:num('data-cp'),C:num('data-c'),h:num('data-h'),Ph:num('data-ph'),
  L:num('data-length'),As:num('data-as'),NTU:num('data-ntu'),
  Tout:num('data-tout'),Q:num('data-q'),eps:num('data-eps'),
  LMTD:num('data-lmtd'),dTin:num('data-dtin'),dTout:num('data-dtout')};
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),a+' != '+b);

test('SVG is independent, accessible and does not depend on the network',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 840 1180"/);
  assert.match(svg,/role="img" aria-labelledby="title74 desc74"/);
  assert.match(svg,/<title id="title74">/);
  assert.match(svg,/<desc id="desc74">/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="7\.4"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('NTU response, outlet temperature and effectiveness agree with section 7.4',()=>{
  near(p.C,p.mdot*p.cp);
  near(p.As,p.Ph*p.L);
  near(p.NTU,p.h*p.As/p.C);
  near(p.Tout,p.Ts-(p.Ts-p.Tin)*Math.exp(-p.NTU));
  near(p.Q,p.C*(p.Tout-p.Tin));
  near(p.eps,1-Math.exp(-p.NTU));
  near(p.eps,p.Q/(p.C*(p.Ts-p.Tin)));
  assert.ok(p.Tin<p.Tout&&p.Tout<p.Ts,'outlet stays between inlet and wall');
  for(const text of ['NTU = h A_s / C = 1.0','T_out = 80 − 60 exp(−1) = 57.93 ℃',
    '3792.72 W'])assert.ok(svg.includes(text),text);
});

test('LMTD reproduces the same heat rate (book eqs. 7.57-7.58 model)',()=>{
  near(p.dTin,p.Ts-p.Tin);
  near(p.dTout,p.Ts-p.Tout);
  near(p.LMTD,(p.dTin-p.dTout)/Math.log(p.dTin/p.dTout));
  near(p.h*p.As*p.LMTD,p.Q);
  const naive=p.h*p.As*p.dTin;
  near(naive,6000);
  assert.ok(naive>p.Q*1.5,'inlet difference alone overestimates strongly');
  for(const text of ['LMTD = (60 − 22.07) / ln(60 / 22.07) = 37.93 K',
    '入口差 60 K だけを全長に使うと 6000 W と過大になる。'])assert.ok(svg.includes(text),text);
});

test('plotted curve is the exponential bulk-temperature response at 21 points',()=>{
  const tag=svg.match(/<polyline id="tb-curve"[^>]*points="([^"]+)"/)?.[1];
  assert.ok(tag,'missing curve');
  const pts=tag.trim().split(/\s+/).map(s=>s.split(',').map(Number));
  assert.equal(pts.length,21);
  pts.forEach(([px,py],i)=>{
    const x=i*0.5;
    const T=p.Ts-(p.Ts-p.Tin)*Math.exp(-p.NTU*x/p.L);
    near(px,90+70*x,0.6);
    near(py,470-(T-10)*4,0.6);
  });
  near(pts[0][1],470-(p.Tin-10)*4,0.6);
  near(pts[20][1],470-(p.Tout-10)*4,0.6);
  for(let i=1;i<pts.length;i++)assert.ok(pts[i][1]<pts[i-1][1],'curve rises monotonically');
});
