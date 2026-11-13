import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-7-5-square-duct-nusselt-friction.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const num=(name)=>{
  const match=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(match,'missing numeric field: '+name);
  const n=Number(match[1]);
  assert.ok(Number.isFinite(n),'nonfinite field: '+name);
  return n;
};
const p={a:num('data-a'),Ac:num('data-ac'),Pw:num('data-pw'),Dh:num('data-dh'),
  rho:num('data-rho'),mu:num('data-mu'),Ub:num('data-ub'),kf:num('data-kf'),
  Re:num('data-re'),NuTw:num('data-nu-tw'),NuQw:num('data-nu-qw'),
  NuCi:num('data-nu-circle'),h:num('data-h'),hCi:num('data-h-circle'),
  dT:num('data-dt'),q:num('data-qflux'),qp:num('data-qprime'),
  fRe:num('data-fre'),fReCi:num('data-fre-circle'),f:num('data-f'),
  L:num('data-length'),dp:num('data-dp'),dpCi:num('data-dp-circle')};
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),a+' != '+b);
const bar=(id)=>{
  const tag=svg.match(new RegExp('<rect id="'+id+'"[^>]*\\/>'))?.[0];
  assert.ok(tag,'missing bar: '+id);
  const val=k=>{const m=tag.match(new RegExp('\\b'+k+'="([^"]+)"'));assert.ok(m);return Number(m[1]);};
  return {x:val('x'),y:val('y'),w:val('width'),h:val('height')};
};

test('SVG is independent, accessible and does not depend on the network',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 840 1210"/);
  assert.match(svg,/role="img" aria-labelledby="title75 desc75"/);
  assert.match(svg,/<title id="title75">/);
  assert.match(svg,/<desc id="desc75">/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="7\.5"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('square-duct geometry and heat coefficient agree with section 7.5',()=>{
  near(p.Ac,p.a**2);
  near(p.Pw,4*p.a);
  near(p.Dh,4*p.Ac/p.Pw);
  near(p.Dh,p.a);
  near(p.Re,p.rho*p.Ub*p.Dh/p.mu);
  near(p.h,p.NuTw*p.kf/p.Dh);
  near(p.hCi,p.NuCi*p.kf/p.Dh);
  near(p.q,p.h*p.dT);
  near(p.qp,p.q*p.Pw);
  assert.ok(p.h<p.hCi,'square Tw value stays below the circular one');
  for(const text of ['D_h = 4A_c / P_w = 0.010 m','3576 W/m²、q′ = 143.04 W/m',
    '正方形・壁温一定では 178.8 W/(m²·K)'])assert.ok(svg.includes(text),text);
});

test('friction constants and pressure drops use each cross-section value',()=>{
  near(p.f,p.fRe/p.Re);
  near(p.dp,p.f*(p.L/p.Dh)*(p.rho*p.Ub**2/2));
  near(p.dpCi,(p.fReCi/p.Re)*(p.L/p.Dh)*(p.rho*p.Ub**2/2));
  near(p.dp,142.275,1e-9);
  near(p.dpCi,160.0,1e-9);
  assert.ok(p.dp<p.dpCi);
  for(const text of ['摩擦の定数 f_D Re（Darcy、十分発達層流）',
    'Δp_f（発達区間 L = 5.0 m）= 142.3 Pa（円管の定数では 160.0 Pa）'])
    assert.ok(svg.includes(text),text);
});

test('Nu and fRe bars are proportional to the values they label',()=>{
  const nu={'nu-sq-tw':p.NuTw,'nu-sq-qw':p.NuQw,'nu-ci-tw':p.NuCi};
  for(const [id,v] of Object.entries(nu)){
    const b=bar(id);
    near(b.x,330);
    near(b.w/75,v,1e-3);
  }
  near(bar('fre-sq').w/4,p.fRe,1e-3);
  near(bar('fre-ci').w/4,p.fReCi,1e-3);
  assert.ok(bar('nu-sq-tw').w<bar('nu-sq-qw').w);
  assert.ok(bar('fre-sq').w<bar('fre-ci').w);
});
