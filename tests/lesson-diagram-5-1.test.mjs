import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const svg=readFileSync(new URL('../assets/lesson-diagrams/section-5-1-time-scales-model-selection.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const scalar=name=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'missing '+name);const n=Number(m[1]);assert.ok(Number.isFinite(n));return n;
};
const alpha=scalar('data-alpha'),a=scalar('data-half-thickness'),k=scalar('data-k'),h=scalar('data-h'),rhocp=scalar('data-rho-cp');
const tD=scalar('data-diffusion-time'),tau=scalar('data-external-time-constant'),Bi=scalar('data-biot'),Fo=scalar('data-fourier');
test('original SVG with Japanese alt text, offline-safe dependencies, adaptable color contrast',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="timescale-title timescale-desc"/);
  assert.match(svg,/<title id="timescale-title">/);
  assert.match(svg,/<desc id="timescale-desc">/);
  assert.match(svg,/viewBox="0 0 840 1340"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.match(svg,/data-lesson="5\.1"/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});
test('section 5.1 worked example: two time scales and Bi from base properties',()=>{
  assert.equal(alpha,1e-6);assert.equal(a,0.01);assert.equal(k,1);assert.equal(h,5);assert.equal(rhocp,1e6);
  assert.ok(Math.abs(k/rhocp-alpha)<1e-18);
  assert.ok(Math.abs(a*a/alpha-tD)<1e-9,'diffusion scale a^2/alpha = 100 s');
  assert.ok(Math.abs(rhocp*a/h-tau)<1e-6,'external scale rho*c*a/h = 2000 s');
  assert.ok(Math.abs(h*a/k-Bi)<1e-12,'Bi = 0.05');
  assert.ok(Bi<0.1,'lumped-capacitance guideline');
  assert.ok(Math.abs(alpha*200/(a*a)-Fo)<1e-12,'Fo at 200 s = 2');
  assert.ok(Math.abs(Bi*Fo-200/tau)<1e-12,'t/tau = Bi*Fo = 0.1');
  assert.ok(tD<tau,'internal smoothing faster than external exchange');
});
test('log-scale time bars encode 100 s, 200 s and 2000 s with one shared mapping',()=>{
  const width=id=>{
    const m=svg.match(new RegExp('<rect id="'+id+'"[^>]*width="([\\d.]+)"'));
    assert.ok(m,id);return Number(m[1]);
  };
  const xlog=t=>660*Math.log10(t)/4;
  assert.ok(Math.abs(width('bar-diffusion')-xlog(100))<0.02);
  assert.ok(Math.abs(width('bar-eval')-xlog(200))<0.02);
  assert.ok(Math.abs(width('bar-external')-xlog(2000))<0.02);
  assert.ok(width('bar-diffusion')<width('bar-eval')&&width('bar-eval')<width('bar-external'));
});
test('lumped response curve is exp(-t/tau) at 41 points and decays monotonically',()=>{
  const m=svg.match(/<path id="theta-exp"[^>]*d="([^"]+)"/);
  assert.ok(m);
  const pts=[...m[1].matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(z=>[Number(z[1]),Number(z[2])]);
  assert.equal(pts.length,41);
  for(let i=0;i<pts.length;i++){
    const t=i*50;
    assert.ok(Math.abs(pts[i][0]-(150+t/2000*640))<0.02,'x t='+t);
    assert.ok(Math.abs(pts[i][1]-(850-Math.exp(-t/2000)*260))<0.02,'y t='+t);
    if(i>0)assert.ok(pts[i][1]>pts[i-1][1],'theta decreases');
  }
  assert.ok(Math.abs(Math.exp(-1)-0.36787944117144233)<1e-15);
});
test('pinned lumped value at 200 s matches lesson answer 92.39 C',()=>{
  const th=scalar('data-lumped-theta'),T=scalar('data-lumped-temperature');
  assert.ok(Math.abs(th-Math.exp(-0.1))<1e-12);
  assert.ok(Math.abs(th-0.9048374180359595)<1e-12);
  assert.ok(Math.abs(T-(20+80*th))<1e-9);
  assert.ok(Math.abs(T-92.38699344287677)<1e-9);
  const c=svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)"/);
  assert.ok(c);
  assert.ok(Math.abs(Number(c[1])-(150+200/2000*640))<0.02);
  assert.ok(Math.abs(Number(c[2])-(850-th*260))<0.02);
});
