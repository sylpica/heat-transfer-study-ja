import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-7-6-cylinder-crossflow-churchill-bernstein.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const num=(name)=>{
  const match=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(match,'missing numeric field: '+name);
  const n=Number(match[1]);
  assert.ok(Number.isFinite(n),'nonfinite field: '+name);
  return n;
};
const p={D:num('data-diameter'),Lz:num('data-length'),U:num('data-u'),
  nu:num('data-visc'),Pr:num('data-pr'),kf:num('data-kf'),
  Ts:num('data-ts'),Tinf:num('data-tinf'),Re:num('data-re'),
  Nu:num('data-nu'),h:num('data-h'),Aside:num('data-aside'),
  Aproj:num('data-aproj'),Q:num('data-q')};
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
  assert.match(svg,/role="img" aria-labelledby="title76 desc76"/);
  assert.match(svg,/<title id="title76">/);
  assert.match(svg,/<desc id="desc76">/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="7\.6"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('Churchill-Bernstein value agrees with book eq. (7.65)',()=>{
  near(p.Re,p.U*p.D/p.nu);
  assert.ok(p.Re*p.Pr>0.2,'Re_D Pr guideline satisfied');
  const cb=0.3+(0.62*Math.sqrt(p.Re)*p.Pr**(1/3)/(1+(0.4/p.Pr)**(2/3))**0.25)
    *(1+(p.Re/282000)**(5/8))**0.8;
  near(p.Nu,cb);
  near(p.Nu,42.74,2e-3);
  near(p.h,p.Nu*p.kf/p.D);
  near(p.h,55.56,2e-3);
  for(const text of ['Churchill–Bernstein 式（式7.65）',
    'Re_D = U D / ν = 6667','Nū_D = 42.74、h̄ = 55.56 W/(m²·K)'])
    assert.ok(svg.includes(text),text);
});

test('heat rate uses the lateral area, not the projected area',()=>{
  near(p.Aside,Math.PI*p.D*p.Lz);
  near(p.Aproj,p.D*p.Lz);
  near(p.Aside/p.Aproj,Math.PI);
  near(p.Q,p.h*p.Aside*(p.Ts-p.Tinf));
  near(p.Q,69.82,2e-3);
  const wrong=p.h*p.Aproj*(p.Ts-p.Tinf);
  assert.ok(Math.abs(p.Q-wrong)>40,'projected-area value must differ clearly');
  for(const text of ['側面積 π D L_z','投影面積 D L_z',
    'Q̇_conv = h̄ × 側面積 × (T_s − T_∞) = 69.82 W'])assert.ok(svg.includes(text),text);
});

test('area bars are proportional and the mean value is not sold as a local one',()=>{
  const side=bar('area-side'),proj=bar('area-proj');
  near(side.x,300);near(proj.x,300);
  near(side.w/proj.w,Math.PI,1e-3);
  near(side.w/12000,p.Aside,1e-3);
  near(proj.w/12000,p.Aproj,1e-3);
  for(const text of ['周平均の値。よどみ点や後流部の局所 h と同じではない。',
    '管群や閉塞へ単独円柱の式を使わない。','原著図版の転載・翻訳なし'])
    assert.ok(svg.includes(text),text);
});
