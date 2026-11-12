import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-7-7-correlation-uncertainty-residuals.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const num=(name)=>{
  const match=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(match,'missing numeric field: '+name);
  const n=Number(match[1]);
  assert.ok(Number.isFinite(n),'nonfinite field: '+name);
  return n;
};
const p={Q:num('data-q'),A:num('data-area'),dT:num('data-dt'),h:num('data-hobs'),
  uq:num('data-uq'),ua:num('data-ua'),udt:num('data-udt'),urel:num('data-urel'),
  uh:num('data-uh'),p1:num('data-pred1'),p2:num('data-pred2'),
  r1:num('data-r1'),r2:num('data-r2')};
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),a+' != '+b);
const rect=(id)=>{
  const tag=svg.match(new RegExp('<rect id="'+id+'"[^>]*\\/>'))?.[0];
  assert.ok(tag,'missing rect: '+id);
  const val=k=>{const m=tag.match(new RegExp('\\b'+k+'="([^"]+)"'));assert.ok(m);return Number(m[1]);};
  return {x:val('x'),y:val('y'),w:val('width'),h:val('height')};
};
const axisX=h=>120+(h-14)*(640/12);

test('SVG is independent, accessible and does not depend on the network',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 840 1160"/);
  assert.match(svg,/role="img" aria-labelledby="title77 desc77"/);
  assert.match(svg,/<title id="title77">/);
  assert.match(svg,/<desc id="desc77">/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="7\.7"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('observed h, propagated uncertainty and residuals agree with section 7.7',()=>{
  near(p.h,p.Q/(p.A*p.dT));
  near(p.h,20.0);
  near(p.urel,Math.hypot(p.uq,p.ua,p.udt));
  near(p.urel,0.0374165738677394,1e-12);
  near(p.uh,p.h*p.urel);
  near(p.uh,0.7483314773547883,1e-12);
  near(p.r1,(p.p1-p.h)/p.h);
  near(p.r2,(p.p2-p.h)/p.h);
  assert.ok(Math.abs(p.r1)<p.uh/p.h*3,'candidate A is nearer at this point');
  for(const text of ['観測：20.0 ± 0.75','残差は A −10%／B +20%',
    '(u_h/h)² ≈ (u_Q/Q̇)² + (u_A/A)² + (u_ΔT/ΔT)²'])assert.ok(svg.includes(text),text);
});

test('number-line markers and the uncertainty band sit at the computed positions',()=>{
  for(const [cx,h] of [[333.33,p.p1],[440,p.h],[653.33,p.p2]]){
    near(cx,axisX(h),0.6);
    assert.ok(svg.includes('cx="'+cx+'" cy="300"'),'marker for h='+h);
  }
  const band=rect('uh-band');
  near(band.x,axisX(p.h-p.uh),0.6);
  near(band.w,2*p.uh*(640/12),0.6);
  near(band.x+band.w,axisX(p.h+p.uh),0.6);
  assert.ok(axisX(p.p1)<band.x,'candidate A marker lies outside the band');
});

test('contribution bars are proportional and the reading limits are stated',()=>{
  near(rect('u-q').w/90,p.uq*100,1e-3);
  near(rect('u-a').w/90,p.ua*100,1e-3);
  near(rect('u-dt').w/90,p.udt*100,1e-3);
  near(rect('u-rss').w/90,p.urel*100,1e-3);
  assert.ok(rect('u-rss').w>rect('u-dt').w,'RSS exceeds the largest single input');
  for(const text of ['言える：この一点では候補Aの方が観測に近い',
    '言えない：全範囲での優劣、観測が真値であること',
    '帯への出入りと、相関自体のモデル誤差・偏りは別の評価。',
    '原著図版の転載・翻訳なし'])assert.ok(svg.includes(text),text);
});
