import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-7-3-turbulent-pipe-correlations-friction.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const num=(name)=>{
  const match=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(match,'missing numeric field: '+name);
  const n=Number(match[1]);
  assert.ok(Number.isFinite(n),'nonfinite field: '+name);
  return n;
};
const p={D:num('data-diameter'),L:num('data-length'),Ub:num('data-ub'),
  rho:num('data-rho'),mu:num('data-mu'),cp:num('data-cp'),kf:num('data-kf'),
  Re:num('data-re'),Pr:num('data-pr'),f:num('data-f'),
  NuC:num('data-nu-colburn'),NuDB:num('data-nu-db'),NuM:num('data-nu-mcadams'),
  NuG:num('data-nu-gnielinski'),h:num('data-h'),dp:num('data-dp'),
  qv:num('data-qv'),P:num('data-power')};
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),a+' != '+b);
const bar=(id)=>{
  const tag=svg.match(new RegExp('<rect id="'+id+'"[^>]*\\/>'))?.[0];
  assert.ok(tag,'missing bar: '+id);
  const val=k=>{const m=tag.match(new RegExp('\\b'+k+'="([^"]+)"'));assert.ok(m);return Number(m[1]);};
  return {x:val('x'),y:val('y'),w:val('width'),h:val('height')};
};

test('SVG is independent, accessible and does not depend on the network',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 840 1220"/);
  assert.match(svg,/role="img" aria-labelledby="title73 desc73"/);
  assert.match(svg,/<title id="title73">/);
  assert.match(svg,/<desc id="desc73">/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="7\.3"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('power-law lineage matches the book genealogy (7.39a-c) after FC-23',()=>{
  near(p.Re,p.rho*p.Ub*p.D/p.mu);
  near(p.Pr,p.mu*p.cp/p.kf);
  near(p.NuC,0.023*p.Re**0.8*p.Pr**(1/3));
  near(p.NuDB,0.0243*p.Re**0.8*p.Pr**0.4);
  near(p.NuM,0.0225*p.Re**0.8*p.Pr**0.4);
  near(p.NuC,440.0,2e-3);
  near(p.NuDB,529.2,2e-3);
  near(p.NuM,490.0,2e-3);
  assert.ok(Math.abs(p.NuC-0.023*p.Re**0.8*p.Pr**0.4)>10,
    'Colburn must not carry the Pr^0.4 exponent');
  for(const text of ['Colburn（式7.39a）：Nu = 0.023 Re^0.8 Pr^(1/3)',
    'Dittus–Boelter（式7.39b）：Nu = 0.0243 Re^0.8 Pr^0.4',
    'McAdams（式7.39c）：Nu = 0.0225 Re^0.8 Pr^0.4',
    '係数 0.023 は Colburn のもの'])assert.ok(svg.includes(text),text);
});

test('Gnielinski value, friction, pressure drop and fluid power agree',()=>{
  near(p.f,(0.79*Math.log(p.Re)-1.64)**-2);
  const g=(p.f/8*(p.Re-1000)*p.Pr)/(1+12.7*Math.sqrt(p.f/8)*(p.Pr**(2/3)-1));
  near(p.NuG,g);
  near(p.NuG,599.1,2e-3);
  near(p.h,p.NuG*p.kf/p.D);
  near(p.dp,p.f*(p.L/p.D)*(p.rho*p.Ub**2/2));
  near(p.qv,p.Ub*Math.PI*p.D**2/4);
  near(p.P,p.dp*p.qv);
  for(const text of ['0.01799（Darcy）','11.25 kPa','17.66 W',
    'Darcy 係数は Fanning 係数の4倍'])assert.ok(svg.includes(text),text);
});

test('Nu bars share one axis and their widths are proportional to the displayed Nu',()=>{
  const shown={ 'nu-colburn':440.0,'nu-db':529.2,'nu-mcadams':490.0,'nu-gnielinski':599.1 };
  for(const [id,v] of Object.entries(shown)){
    const b=bar(id);
    near(b.x,250);
    near(b.w/0.8,v,1.5);
    assert.ok(b.x+b.w<=770,'bar stays on the 0-650 axis');
  }
  assert.ok(bar('nu-gnielinski').w>bar('nu-db').w);
  assert.ok(bar('nu-db').w>bar('nu-mcadams').w);
  assert.ok(bar('nu-mcadams').w>bar('nu-colburn').w);
});
