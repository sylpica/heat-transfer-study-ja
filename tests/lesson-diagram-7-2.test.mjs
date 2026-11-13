import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-7-2-laminar-pipe-entrance-lengths.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const num=(name)=>{
  const match=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(match,'missing numeric field: '+name);
  const n=Number(match[1]);
  assert.ok(Number.isFinite(n),'nonfinite field: '+name);
  return n;
};
const p={D:num('data-diameter'),Re:num('data-re'),Pr:num('data-pr'),
  k:num('data-kf'),factor:num('data-factor'),Lh:num('data-lh'),
  Lt:num('data-lt'),x:num('data-observation'),Nu:num('data-nu-tw'),
  h:num('data-h-tw')};
const near=(a,b,eps=1e-10)=>assert.ok(Math.abs(a-b)<=eps,a+' != '+b);
const bar=(id)=>{
  const tag=svg.match(new RegExp('<rect id="'+id+'"[^>]*\\/>'))?.[0];
  assert.ok(tag,'missing bar: '+id);
  const val=k=>{const m=tag.match(new RegExp('\\b'+k+'="([^"]+)"'));assert.ok(m);return Number(m[1]);};
  return {x:val('x'),y:val('y'),w:val('width'),h:val('height')};
};

test('SVG is independent, accessible and does not depend on the network',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 840 1200"/);
  assert.match(svg,/role="img" aria-labelledby="title72 desc72"/);
  assert.match(svg,/<title id="title72">/);
  assert.match(svg,/<desc id="desc72">/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="7\.2"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('both entrance lengths and fully developed Tw correlation agree with section 7.2',()=>{
  assert.deepEqual(p,{D:.020,Re:200,Pr:5,k:.60,factor:.05,Lh:.20,Lt:1,x:.50,Nu:3.66,h:109.8});
  near(p.factor*p.Re*p.D,p.Lh);
  near(p.factor*p.Re*p.Pr*p.D,p.Lt);
  near(p.Nu*p.k/p.D,p.h);
  near(p.Lt/p.Lh,p.Pr);
  assert.ok(p.x>p.Lh&&p.x<p.Lt);
  for(const text of ['0.20 m','1.00 m','0.50 m','109.8 W/(m²·K)'])assert.ok(svg.includes(text),text);
});

test('bars share one metric axis and their widths represent the two approximate entrance lengths',()=>{
  const hd=bar('h-entrance'), hf=bar('h-developed');
  const td=bar('t-entrance'), tf=bar('t-developed');
  near(hd.x,166);near(td.x,166);
  near(hd.y,379);near(td.y,449);
  near(hd.h,37);near(td.h,37);
  near(hf.x,hd.x+hd.w);near(tf.x,td.x+td.w);
  near(hd.w/hf.w,1/5);
  near(td.w/hd.w,p.Lt/p.Lh);
  near(hd.w/552,p.Lh/1.2);
  near(td.w/552,p.Lt/1.2);
  near(hd.w+hf.w,552);near(td.w+tf.w,552);
  near(hf.x+hf.w,718);near(tf.x+tf.w,718);
  near(166+552*(p.x/1.2),396);
});

test('the examples do not apply an asymptotic Nu to a developing zone',()=>{
  for(const text of ['助走長の目安','急な境界ではない',
    '流れの向き','速度は概ね発達済み。温度場はまだ助走域。',
    '壁温一定・流動と熱が十分発達','熱的助走中の全区間へNu_D = 3.66を適用しない。',
    '原著図版の転載・翻訳なし']){
    assert.ok(svg.includes(text),text);
  }
  assert.doesNotMatch(svg,/0\.50 m.*Nu_D = 3\.66/);
});
