import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const svg=readFileSync(new URL('../assets/lesson-diagrams/section-5-2-lumped-capacitance-exponential-cooling.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const num=name=>{
 const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
 assert.ok(m,'Missing '+name);
 const n=Number(m[1]);assert.ok(Number.isFinite(n));return n;
};
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,String(a)+' differs from '+String(b));
const p={
 m:num('data-mass'),c:num('data-heat-capacity'),rho:num('data-density'),
 k:num('data-conductivity-solid'),A:num('data-area-convection'),h:num('data-h-convection'),
 T0:num('data-temp-initial'),Tinf:num('data-temp-ambient'),t:num('data-time-eval'),
 V:num('data-volume'),Lc:num('data-characteristic-length'),Bi:num('data-biot'),
 C:num('data-thermal-capacitance'),G:num('data-conductance'),tau:num('data-tau'),
 T:num('data-temperature-at-tau'),Q:num('data-heat-released'),
 alpha:num('data-alpha-solid'),Fo:num('data-fourier-at-tau')
};
test('original offline self-contained SVG with accessible Japanese labels and dark mode',()=>{
 assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(svg,/viewBox="0 0 840 1230"/);
 assert.match(svg,/role="img" aria-labelledby="lumped-title lumped-desc"/);
 assert.match(svg,/<title id="lumped-title">/);
 assert.match(svg,/<desc id="lumped-desc">/);
 assert.match(svg,/data-origin="original-app-diagram"/);
 assert.match(svg,/data-lesson="5\.2"/);
 assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
 assert.match(svg,/原著図版の転載・トレースなし/);
 assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});
test('Biot criterion, consistent length, capacitance and time constant independently agree',()=>{
 assert.deepEqual([p.m,p.c,p.rho,p.k,p.A,p.h,p.T0,p.Tinf,p.t],[1,500,5000,50,.10,20,100,20,250]);
 near(p.V,p.m/p.rho);near(p.Lc,p.V/p.A);near(p.Lc,.002);
 near(p.Bi,p.h*p.Lc/p.k);near(p.Bi,.0008);assert.ok(p.Bi<.1);
 near(p.C,p.m*p.c);near(p.G,p.h*p.A);near(p.tau,p.C/p.G);near(p.tau,250);
});
test('exponential temperature, sensible heat and Bi-Fo identity are correct',()=>{
 const T=p.Tinf+(p.T0-p.Tinf)*Math.exp(-p.t/p.tau);
 near(p.T,T);near(p.T,49.43035529371539);
 near(p.Q,p.C*(p.T0-p.T),1e-6);near(p.Q,25284.822353142306,1e-6);
 near(p.alpha,p.k/(p.rho*p.c));near(p.Fo,p.alpha*p.t/p.Lc**2);
 near(p.Bi*p.Fo,p.t/p.tau);
 near((p.T-p.Tinf)/(p.T0-p.Tinf),1/Math.E);
 assert.ok(p.T0>p.T && p.T>p.Tinf);
});
test('all 41 SVG curve points and the tau marker agree with the analytic exponential',()=>{
 assert.equal(num('data-plot-points'),41);
 const match=svg.match(/<path id="lumped-exponential-curve"[^>]*d="([^"]+)"\/>/);
 assert.ok(match,'Missing exponential path');
 const pts=[...match[1].matchAll(/[ML]([0-9.]+) ([0-9.]+)/g)].map(v=>[Number(v[1]),Number(v[2])]);
 assert.equal(pts.length,41);
 pts.forEach(([x,y],i)=>{
  const u=i/40;
  near(x,195+504*u,.001);
  near(y,722-220*Math.exp(-4*u),.001);
  if(i)assert.ok(y>pts[i-1][1],'Curve must move downwards with time');
 });
 assert.match(svg,/<path id="tau-marker" class="event" d="M321 507 V722"\/>/);
 const circ=svg.match(/<circle class="mark" cx="([0-9.]+)" cy="([0-9.]+)" r="7"\/>/);
 assert.ok(circ);
 near(Number(circ[1]),321,.001);
 near(Number(circ[2]),722-220/Math.E,.001);
 assert.match(svg,/M195 641\.067 H699/);
});
test('visible annotations include approximation conditions and temperature-ratio warning',()=>{
 for(const s of ['L_c = V/A_s','Bi = hL_c/k_s','Bi &lt; 0.1','周囲温度 20 ℃',
  't = τ = 250 s','Θ = e^(−1) ≈ 0.368','摂氏温度そのものが36.8%になるという意味ではない',
  'T(250 s) = 20 + 80e^(−1) ≈ 49.43 ℃','Q_release = mc(T₀−T) ≈ 25.28 kJ',
  '放射、発熱、相変化を無視。'])assert.ok(svg.includes(s),s);
});
