import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-7-1-rectangular-duct-hydraulic-diameter.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const num=(name)=>{
  const match=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(match,'missing numeric field: '+name);
  const n=Number(match[1]);
  assert.ok(Number.isFinite(n),'nonfinite field: '+name);
  return n;
};
const p={a:num('data-a'),b:num('data-b'),Ac:num('data-ac'),Pw:num('data-pw'),
  Dh:num('data-dh'),Ub:num('data-ub'),rho:num('data-rho'),mu:num('data-mu'),
  qv:num('data-qv'),mdot:num('data-mdot'),Re:num('data-re'),L:num('data-length'),
  LDh:num('data-l-over-dh'),factor:num('data-factor'),ent:num('data-entrance-ratio')};
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),a+' != '+b);
const bar=(id)=>{
  const tag=svg.match(new RegExp('<rect id="'+id+'"[^>]*\\/>'))?.[0];
  assert.ok(tag,'missing bar: '+id);
  const val=k=>{const m=tag.match(new RegExp('\\b'+k+'="([^"]+)"'));assert.ok(m);return Number(m[1]);};
  return {x:val('x'),y:val('y'),w:val('width'),h:val('height')};
};

test('SVG is independent, accessible and does not depend on the network',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 840 1180"/);
  assert.match(svg,/role="img" aria-labelledby="title71 desc71"/);
  assert.match(svg,/<title id="title71">/);
  assert.match(svg,/<desc id="desc71">/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="7\.1"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('duct geometry, flow rates and Reynolds number agree with section 7.1',()=>{
  near(p.Ac,p.a*p.b);
  near(p.Pw,2*(p.a+p.b));
  near(p.Dh,4*p.Ac/p.Pw);
  near(p.Dh,0.0133333333333333,1e-12);
  near(p.qv,p.Ub*p.Ac);
  near(p.mdot,p.rho*p.qv);
  near(p.Re,p.rho*p.Ub*p.Dh/p.mu);
  near(p.Re,1777.7777777777778,1e-9);
  near(p.LDh,p.L/p.Dh);
  near(p.ent,p.factor*p.Re);
  assert.ok(p.Re<2300,'worked example stays on the low-Re side');
  for(const text of ['D_h = 4A_c / P_w = 0.01333 m','Re_Dh = ρ U_b D_h / μ = 1778',
    'A_c = a × b = 2.0×10⁻⁴ m²'])assert.ok(svg.includes(text),text);
});

test('bars compare the actual L/Dh with the laminar entrance-length scale',()=>{
  const len=bar('len-bar'),lenRest=bar('len-rest');
  const ent=bar('ent-bar'),entRest=bar('ent-rest');
  near(len.x,166);near(ent.x,166);
  near(len.w/552,p.LDh/100,1e-3);
  near(ent.w/552,p.ent/100,1e-3);
  near(lenRest.x,len.x+len.w,0.01);near(entRest.x,ent.x+ent.w,0.01);
  near(len.w+lenRest.w,552,0.01);near(ent.w+entRest.w,552,0.01);
  assert.ok(p.LDh<p.ent,'actual length is below the entrance scale');
  assert.ok(len.w<ent.w);
});

test('the diagram keeps wetted and heated perimeters distinct and refuses a pipe Nu shortcut',()=>{
  for(const text of ['濡れ周長 P_w と加熱周長 P_h は別定義',
    '対角線でも幅でもない','円管の目安でも十分発達とは即断できない',
    '原著図版の転載・翻訳なし']){
    assert.ok(svg.includes(text),text);
  }
  assert.doesNotMatch(svg,/Nu\s*=\s*3\.66/);
});
