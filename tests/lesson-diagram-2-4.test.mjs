import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const svg=readFileSync(new URL('../assets/lesson-diagrams/section-2-4-cylindrical-wall-resistance.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
function number(name){
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'missing '+name);
  const n=Number(m[1]);assert.ok(Number.isFinite(n),name+' nonfinite');return n;
}
const approx=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} vs ${b}`);
const p={ri:number('data-inner-radius-m'),ro:number('data-outer-radius-m'),L:number('data-length-m'),k:number('data-conductivity'),hi:number('data-hi'),ho:number('data-ho'),dT:number('data-delta-temp-k'),Ai:number('data-area-inner'),Ao:number('data-area-outer'),Ri:number('data-ri'),Rw:number('data-rwall'),Ro:number('data-ro'),Rt:number('data-rtotal'),UA:number('data-ua'),Ui:number('data-ui'),Uo:number('data-uo'),Q:number('data-q')};
function rect(id){
  const tag=svg.match(new RegExp('<rect id="'+id+'"[^>]+/>'))?.[0];assert.ok(tag,'missing rectangle '+id);
  const n=k=>Number(tag.match(new RegExp('\\b'+k+'="([^"]+)"'))?.[1]);
  return {x:n('x'),y:n('y'),width:n('width'),height:n('height')};
}
test('independent SVG is accessible, responsive and self-contained',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 840 1300"/);
  assert.match(svg,/role="img" aria-labelledby="tube-title tube-desc"/);
  assert.match(svg,/<title id="tube-title">/);
  assert.match(svg,/<desc id="tube-desc">/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="2\.4"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
  assert.match(svg,/原著図版のトレース・転載・翻訳なし/);
});
test('inner and outer cylindrical area and resistance equations independently agree',()=>{
  assert.deepEqual([p.ri,p.ro,p.L,p.k,p.hi,p.ho,p.dT],[.010,.012,2,15,1000,100,40]);
  assert.ok(p.ro>p.ri);
  approx(p.Ai,2*Math.PI*p.ri*p.L);
  approx(p.Ao,2*Math.PI*p.ro*p.L);
  approx(p.Ri,1/(p.hi*p.Ai));
  approx(p.Rw,Math.log(p.ro/p.ri)/(2*Math.PI*p.k*p.L));
  approx(p.Ro,1/(p.ho*p.Ao));
  approx(p.Rt,p.Ri+p.Rw+p.Ro);
  approx(p.Ao/p.Ai,p.ro/p.ri);
  assert.ok(p.Ro>p.Ri && p.Ri>p.Rw);
});
test('U on each reference area gives invariant UA and identical Q',()=>{
  approx(p.UA,1/p.Rt);
  approx(p.Ui*p.Ai,p.UA);
  approx(p.Uo*p.Ao,p.UA);
  approx(p.Ui/p.Uo,p.Ao/p.Ai);
  approx(p.Q,p.dT/p.Rt);
  approx(p.Q,p.Ui*p.Ai*p.dT);
  approx(p.Q,p.Uo*p.Ao*p.dT);
  approx(p.Q,531.6352713074397);
  for(const s of ['105.77 W/(m²·K)','88.14 W/(m²·K)','13.29 W/K','531.64 W'])assert.ok(svg.includes(s),s);
});
test('resistance contribution visualization is proportional and contiguous',()=>{
  const segments=[rect('resistance-ri'),rect('resistance-wall'),rect('resistance-ro')];
  for(const s of segments){assert.equal(s.y,831);assert.equal(s.height,34);assert.ok(s.width>0);}
  approx(segments[0].x,92);
  approx(segments[0].x+segments[0].width,segments[1].x,0.00002);
  approx(segments[1].x+segments[1].width,segments[2].x,0.00002);
  approx(segments.reduce((n,s)=>n+s.width,0),644,0.00003);
  for(const [i,r] of [p.Ri,p.Rw,p.Ro].entries())approx(segments[i].width/644,r/p.Rt,0.00000003);
  for(const s of ['内側 10.6%','管壁 1.3%','外側 88.1%'])assert.ok(svg.includes(s),s);
});
test('outward heat arrow is conditional and simplifying assumptions visible',()=>{
  for(const s of ['内側が高温の場合の熱流方向','定常・一定物性・代表温度差40 K','汚れと軸方向温度変化なし','熱は半径方向','各抵抗の単位：K/W','放射抵抗の 1/m² と混同しない'])assert.ok(svg.includes(s),s);
  assert.match(svg,/円筒断面は概念図/);
  assert.match(svg,/r="104"/);
  assert.match(svg,/r="86\.667"/);
  approx(104/86.667,p.ro/p.ri,0.00001);
});
