import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-9-6-transition-wetting-fraction.svg', import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
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

const p={qWet:number('data-q-wet'),qDry:number('data-q-dry'),f1:number('data-f-1'),
  f2:number('data-f-2'),m1:number('data-mean-1'),m2:number('data-mean-2'),
  A:number('data-area'),r1:number('data-q-rate-1'),r2:number('data-q-rate-2')};
const gridCells=(id)=>{
  const m=svg.match(new RegExp('<g id="'+id+'">([\\s\\S]*?)</g>'));
  assert.ok(m,'Missing grid '+id);
  return [...m[1].matchAll(/<rect class="(wet|dry)"/g)].map(x=>x[1]);
};

test('§9.6 original SVG has accessible descriptions and no external references',()=>{
  common('9.6','trans');
});

test('area-weighted means and heat rates independently agree',()=>{
  assert.deepEqual([p.qWet,p.qDry,p.f1,p.f2,p.A],[300e3,30e3,0.60,0.20,0.010]);
  approximately(p.m1,p.f1*p.qWet+(1-p.f1)*p.qDry,1e-6);
  approximately(p.m2,p.f2*p.qWet+(1-p.f2)*p.qDry,1e-6);
  approximately(p.r1,p.A*p.m1,1e-6);
  approximately(p.r2,p.A*p.m2,1e-6);
  assert.ok(p.m2<p.m1);
  for(const expected of ['1920 W → 840 W','192 → 84 kW/m²']) assert.ok(svg.includes(expected),expected);
});

test('grids encode the wetting fractions exactly (60/100 and 20/100)',()=>{
  const g1=gridCells('grid-state-1');
  const g2=gridCells('grid-state-2');
  assert.equal(g1.length,100); assert.equal(g2.length,100);
  assert.equal(g1.filter(c=>c==='wet').length,60);
  assert.equal(g2.filter(c=>c==='wet').length,20);
});

test('instability and hysteresis notes are visible',()=>{
  for(const word of ['負の傾きのため本質的に不安定','壁温を固定できる場合に限られる','ヒステリシス'])
    assert.ok(svg.includes(word),word);
  assert.match(svg,/data-model="two-region-area-average"/);
});
