import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-6-6-reynolds-colburn-analogy.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
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
const rectWidth=(id)=>{
  const m=svg.match(new RegExp('<rect id="'+id+'"[^>]*width="([0-9.]+)"'));
  assert.ok(m,'missing rect '+id);
  return Number(m[1]);
};

test('original, accessible, responsive and offline-safe SVG',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 820 1100"/);
  assert.match(svg,/role="img" aria-labelledby="title66 desc66"/);
  assert.match(svg,/<title id="title66">/);
  assert.match(svg,/<desc id="desc66">/);
  assert.match(svg,/data-lesson="6\.6"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/style="max-width:100%"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('worked example: Cf -> j_H -> St -> h -> q chain agrees',()=>{
  const Cf=n('data-cf'),rho=n('data-rho'),cp=n('data-cp'),U=n('data-uinf');
  const Pr=n('data-pr'),dT=n('data-dt');
  approx(Cf,.004);approx(rho,1.2);approx(cp,1000);approx(U,5);
  approx(Pr,.7);approx(dT,50);
  const jH=Cf/2;
  approx(n('data-jh'),jH,1e-12);
  const St=jH*Math.pow(Pr,-2/3);
  approx(n('data-st'),St,1e-11);
  const h=rho*cp*U*St;
  approx(n('data-h'),h,1e-8);
  approx(n('data-q'),h*dT,1e-7);
  // without the Pr correction (Pr=1) the result is different, not a rounding issue
  approx(n('data-h-pr1'),rho*cp*U*jH,1e-9);
  approx(n('data-h-pr1'),12,1e-9);
  assert.ok(n('data-h')>n('data-h-pr1')*1.2);
  for(const str of ['j_H = St Pr^(2/3) = C_f/2','St = j_H Pr^(−2/3) ≈ 0.0025369','h ≈ 15.22 W/(m²·K)'])
    assert.ok(svg.includes(str),str);
});

test('comparison bars are proportional to the two h values',()=>{
  const scale=n('data-bar-scale');
  approx(rectWidth('bar-corrected'),n('data-h')*scale,0.6);
  approx(rectWidth('bar-naive'),n('data-h-pr1')*scale,0.001);
});

test('validity limits of the analogy are stated (book list)',()=>{
  for(const s of ['St ≈ C_f/2 そのものは Pr = 1・等温壁などの対応条件でのみ成立',
    '等熱流束壁では熱境界層の成長率自体が違い、成立しない（6.78）',
    '圧力勾配のある流れ、液体金属（極低Pr）でも崩れる',
    'h = C_f という次元の違う等置ではない'])
    assert.ok(svg.includes(s),s);
});
