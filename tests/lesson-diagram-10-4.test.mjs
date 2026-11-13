import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-10-4-gray-surface-radiation-network.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const num=(attribute)=>{
  const found=svg.match(new RegExp('\\b'+attribute+'="([^"]+)"'));
  assert.ok(found,'Missing data attribute '+attribute);
  const value=Number(found[1]);
  assert.ok(Number.isFinite(value),attribute+' must be finite');
  return value;
};
const p={
  sigma:num('data-sigma'),t1:num('data-t1'),t2:num('data-t2'),
  e1:num('data-e1'),e2:num('data-e2'),area:num('data-area'),
  f12:num('data-f12'),Eb1:num('data-eb1'),Eb2:num('data-eb2'),
  J1:num('data-j1'),J2:num('data-j2'),Q:num('data-q')
};
const near=(actual,expected,tolerance=1e-7)=>{
  assert.ok(Math.abs(actual-expected)<=tolerance,actual+' differs from '+expected);
};

test('§10.4 independent SVG is accessible, offline-safe and supports dark mode',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/data-lesson="10\.4"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/viewBox="0 0 840 1110"/);
  assert.match(svg,/role="img" aria-labelledby="title10-4 desc10-4"/);
  assert.match(svg,/<title id="title10-4">/);
  assert.match(svg,/<desc id="desc10-4">/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('blackbody emission and three radiation resistances are independently correct',()=>{
  assert.equal(p.sigma,5.670374419e-8);
  assert.equal(p.t1,400);
  assert.equal(p.t2,300);
  assert.equal(p.e1,0.8);
  assert.equal(p.e2,0.6);
  assert.equal(p.area,0.5);
  assert.equal(p.f12,1);
  near(p.Eb1,p.sigma*p.t1**4,1e-6);
  near(p.Eb2,p.sigma*p.t2**4,1e-6);
  const r1=(1-p.e1)/(p.area*p.e1);
  const rspace=1/(p.area*p.f12);
  const r2=(1-p.e2)/(p.area*p.e2);
  near(r1,0.5);near(rspace,2);near(r2,4/3);
  near(r1+rspace+r2,23/6);
  for(const s of ['0.500 m⁻²','2.000 m⁻²','1.333 m⁻²','3.833 m⁻²'])assert.ok(svg.includes(s),s);
});

test('net radiation power, flux and sign follow serial resistance law',()=>{
  const r1=(1-p.e1)/(p.area*p.e1),rs=1/(p.area*p.f12);
  const r2=(1-p.e2)/(p.area*p.e2);
  const power=(p.Eb1-p.Eb2)/(r1+rs+r2);
  near(p.Q,power);
  near(p.Q,258.86491912826085);
  const flux=p.Q/p.area;
  near(flux,517.7298382565217);
  assert.ok(power>0&&p.t1>p.t2);
  near(p.Eb1-p.J1,p.Q*r1);
  near(p.J1-p.J2,p.Q*rs);
  near(p.J2-p.Eb2,p.Q*r2);
  for(const s of ['258.86 W','517.73 W/m²','正味 1 → 2'])assert.ok(svg.includes(s),s);
});

test('each diffuse gray surface satisfies radiosity and irradiation balance',()=>{
  const G1=p.J2,G2=p.J1;
  near(p.J1,p.e1*p.Eb1+(1-p.e1)*G1);
  near(p.J2,p.e2*p.Eb2+(1-p.e2)*G2);
  near(p.J1-G1,p.Q/p.area);
  near(p.J2-G2,-p.Q/p.area);
  assert.ok(p.Eb1>p.J1&&p.J1>p.J2&&p.J2>p.Eb2);
  for(const s of ['1451.62 W/m²','1322.18 W/m²','804.45 W/m²','459.30 W/m²'])assert.ok(svg.includes(s),s);
});
