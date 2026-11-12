import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-9-7-surface-effects-chf.svg', import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const number=(key)=>{{
  const match=svg.match(new RegExp('\\b'+key+'="([^"]+)"'));
  assert.ok(match,'Missing numeric attribute '+key);
  const value=Number(match[1]);
  assert.ok(Number.isFinite(value),'Not finite: '+key);
  return value;
}};
const approximately=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${{a}} differs from ${{b}}`);
const rel=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol*Math.abs(b),`${{a}} differs from ${{b}}`);
const coordinates=(id)=>{{
  const match=svg.match(new RegExp('<path id="'+id+'"[^>]*d="([^"]+)"'));
  assert.ok(match,'Missing path '+id);
  return [...match[1].matchAll(/[ML]\s+([\d.]+)\s+([\d.]+)/g)].map(x=>[Number(x[1]),Number(x[2])]);
}};
const common=(lesson,prefix)=>{{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 840 1280"/);
  assert.match(svg,new RegExp('aria-labelledby="'+prefix+'-title '+prefix+'-desc"'));
  assert.match(svg,new RegExp('<title id="'+prefix+'-title">'));
  assert.match(svg,new RegExp('<desc id="'+prefix+'-desc">'));
  assert.match(svg,new RegExp('data-lesson="'+lesson.replace('.','\\.')+'"'));
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
}};

const p={qZ:number('data-q-max-z'),r:number('data-roughness-um'),beta:number('data-angle-deg'),
  factor:number('data-factor'),qmax:number('data-q-max'),qFC:number('data-q-fc'),
  qB:number('data-q-b'),qi:number('data-q-i'),qComb:number('data-q-combined'),qNaive:number('data-q-naive')};

test('§9.7 original SVG has accessible descriptions and no external references',()=>{
  common('9.7','surf');
});

test('Ramilison factor and corrected q_max independently agree',()=>{
  assert.deepEqual([p.qZ,p.r,p.beta],[5.00e5,8.00,20.0]);
  const factor=1.042*Math.pow(1-p.beta/180,3)*Math.pow(p.r,0.125);
  approximately(p.factor,factor,1e-9);
  approximately(p.qmax,factor*p.qZ,1e-2);
  assert.ok(p.factor<1);
  for(const expected of ['係数 ≈ 0.949','4.75×10^5 W/m²']) assert.ok(svg.includes(expected),expected);
});

test('factor curve follows the correlation over the stated angle range',()=>{
  const curve=coordinates('factor-curve');
  assert.equal(curve.length,21);
  const fAt=(b)=>1.042*Math.pow(1-b/180,3)*Math.pow(p.r,0.125);
  for(let i=0;i<=20;i++){
    const b=2*i;
    approximately(curve[i][0],170+470*(b/40),0.0012);
    approximately(curve[i][1],366-136*(fAt(b)-0.6)/0.8,0.0012);
    if(i>0) assert.ok(curve[i][1]>curve[i-1][1]);
  }
  const pt=svg.match(/<circle id="factor-point"[^>]*cx="([\d.]+)" cy="([\d.]+)"/);
  assert.ok(pt);
  approximately(Number(pt[1]),170+470*(20/40),0.01);
  approximately(Number(pt[2]),366-136*(p.factor-0.6)/0.8,0.01);
});

test('factor plot lies inside panel 1 and is not painted over by later panels (A2-PE-24)',()=>{
  const panels=[...svg.matchAll(/<rect class="panel" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
    .map(m=>({x:Number(m[1]),y:Number(m[2]),w:Number(m[3]),h:Number(m[4])}));
  assert.equal(panels.length,3);
  const [p1,p2,p3]=panels;
  const inside=(x,y,r)=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;
  for(const [x,y] of coordinates('factor-curve')){
    assert.ok(inside(x,y,p1),`curve point ${x},${y} outside panel 1`);
    assert.ok(!inside(x,y,p2)&&!inside(x,y,p3),`curve point ${x},${y} inside a later panel`);
  }
  const pt=svg.match(/<circle id="factor-point"[^>]*cx="([\d.]+)" cy="([\d.]+)"/);
  assert.ok(pt&&inside(Number(pt[1]),Number(pt[2]),p1),'factor point outside panel 1');
  const axis=svg.match(/<path class="axis" d="M170 ([\d.]+) V([\d.]+)/);
  assert.ok(axis,'axis path not found');
  assert.ok(Number(axis[1])>=p1.y&&Number(axis[2])<=p1.y+p1.h,'axis outside panel 1 vertically');
  for(const label of ['1.4','1.0','0.6','0°','40°','β=20° で係数 ≈ 0.949']){
    const t=svg.match(new RegExp('<text[^>]*y="([\\d.]+)"[^>]*>'+label.replace(/[.]/g,'\\.')+'</text>'));
    assert.ok(t,'label not found: '+label);
    const y=Number(t[1]);
    assert.ok(y>=p1.y&&y<=p1.y+p1.h,`label ${label} at y=${y} outside panel 1`);
  }
});

test('Bergles-Rohsenow combination is the root-sum-square, not the naive sum',()=>{
  approximately(p.qComb,Math.sqrt(p.qFC**2+(p.qB-p.qi)**2),1e-9);
  approximately(p.qNaive,p.qFC+p.qB,1e-9);
  assert.ok(p.qComb<p.qNaive);
  for(const word of ['単純加算ではない','2 ≦ r ≦ 12 μm、0 ≦ β ≦ 40°','係数を掛け合わせない'])
    assert.ok(svg.includes(word),word);
});
