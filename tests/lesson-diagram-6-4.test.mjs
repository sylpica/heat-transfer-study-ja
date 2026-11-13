import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-6-4-prandtl-thickness-ratio.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const n=(name)=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'missing '+name);
  const value=Number(m[1]);
  assert.ok(Number.isFinite(value),name+' must be numeric');
  return value;
};
const approx=(a,b,eps=1e-8)=>{
  assert.ok(Math.abs(a-b)<eps,'expected '+a+' to be '+b);
};
const profile=(id)=>{
  const m=svg.match(new RegExp('<path id="'+id+'"[^>]*d="([^"]+)"\\s*/>'));
  assert.ok(m,'missing '+id);
  return [...m[1].matchAll(/[ML]([0-9.]+) ([0-9.]+)/g)].map(z=>[Number(z[1]),Number(z[2])]);
};
const rectWidth=(id)=>{
  const m=svg.match(new RegExp('<rect id="'+id+'"[^>]*width="([0-9.]+)"'));
  assert.ok(m,'missing rect '+id);
  return Number(m[1]);
};

test('original, accessible, responsive and offline-safe SVG',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 820 1160"/);
  assert.match(svg,/role="img" aria-labelledby="title64 desc64"/);
  assert.match(svg,/<title id="title64">/);
  assert.match(svg,/<desc id="desc64">/);
  assert.match(svg,/data-lesson="6\.4"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/style="max-width:100%"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('worked example: Pr, Re, delta and the cube-root scale agree',()=>{
  const U=n('data-uinf'),x=n('data-x'),nu=n('data-nu'),alpha=n('data-alpha-fluid');
  approx(U,1);approx(x,.4);approx(nu,8e-6);approx(alpha,1e-6);
  const Pr=nu/alpha;
  approx(Pr,8);approx(n('data-pr'),Pr);
  const Rex=U*x/nu;
  approx(Rex,50000);approx(n('data-re-x'),Rex);
  const delta=5*x/Math.sqrt(Rex);
  approx(n('data-delta'),delta,1e-10);
  approx(n('data-ratio'),Math.pow(Pr,-1/3),1e-9);
  approx(n('data-ratio'),0.5,1e-9);
  approx(n('data-delta-t'),delta*Math.pow(Pr,-1/3),1e-10);
  approx(n('data-static-ratio'),Math.pow(Pr,-1/2),1e-9);
  for(const str of ['速度層 δ_99 ≈ 8.94 mm','温度層の尺度 ≈ 4.47 mm（概略）','Pr^(−1/2) ≈ 0.354'])
    assert.ok(svg.includes(str),str);
});

test('both layer curves follow sqrt growth with the stated ratio',()=>{
  const U=n('data-uinf'),nu=n('data-nu'),ratio=n('data-ratio');
  const d=profile('delta-curve'),t=profile('delta-t-curve');
  assert.equal(d.length,21);assert.equal(t.length,21);
  for(let i=0;i<21;i++){
    const x=0.4*i/20;
    approx(d[i][0],150+(x/0.4)*520,0.011);
    approx(t[i][0],150+(x/0.4)*520,0.011);
    const delta=x===0?0:5*Math.sqrt(nu*x/U);
    approx(d[i][1],430-(delta/0.010)*250,0.6);
    approx(t[i][1],430-(ratio*delta/0.010)*250,0.6);
  }
});

test('thickness-ratio bars use Pr^(-1/3) with one scale',()=>{
  const scale=n('data-bar-scale');
  approx(rectWidth('bar-pr07'),Math.pow(0.7,-1/3)*scale,0.6);
  approx(rectWidth('bar-pr1'),1*scale,0.001);
  approx(rectWidth('bar-pr8'),Math.pow(8,-1/3)*scale,0.001);
  assert.ok(rectWidth('bar-pr07')>rectWidth('bar-pr1'));
  assert.ok(rectWidth('bar-pr1')>rectWidth('bar-pr8'));
  for(const s of ['h = k_f/δ_t と厳密に置くことはしない','極低Pr（液体金属）へ三乗根尺度を外挿しない'])
    assert.ok(svg.includes(s),s);
});
