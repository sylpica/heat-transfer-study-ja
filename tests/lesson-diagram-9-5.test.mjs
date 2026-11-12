import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-9-5-minimum-heat-flux-berenson.svg', import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
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

const p={rhoL:number('data-rho-l'),rhoV:number('data-rho-v'),hfg:number('data-h-fg'),
  sigma:number('data-sigma'),g:number('data-g'),u:number('data-u-sigma'),
  qmin:number('data-q-min'),A:number('data-area'),Q:number('data-q-rate'),
  q16:number('data-q-min-16g'),ell:number('data-capillary-length')};

test('§9.5 original SVG has accessible descriptions and no external references',()=>{
  common('9.5','min');
});

test('Berenson q_min independently agrees, including the g^(1/4) scaling',()=>{
  assert.deepEqual([p.rhoL,p.rhoV,p.hfg,p.sigma,p.g,p.A],[800,4.00,1.0e6,0.0200,10.0,0.0120]);
  const u=Math.pow(p.sigma*p.g*(p.rhoL-p.rhoV)/(p.rhoL+p.rhoV)**2,0.25);
  approximately(p.u,u,1e-9);
  approximately(p.qmin,0.09*p.rhoV*p.hfg*u,1e-3);
  approximately(p.Q,p.A*p.qmin,1e-3);
  approximately(p.q16,2*p.qmin,1e-3);
  approximately(p.ell,Math.sqrt(p.sigma/(p.g*(p.rhoL-p.rhoV))),1e-9);
  for(const expected of ['45.1 kW/m²','541 W','g を16倍にすると q_min は2倍']) assert.ok(svg.includes(expected),expected);
});

test('vapor interface is a sine wave with the stated pixel wavelength',()=>{
  const wave=coordinates('vapor-interface');
  assert.equal(wave.length,63);
  for(let i=0;i<63;i++){
    approximately(wave[i][0],120+10*i,0.0012);
    approximately(wave[i][1],740+14*Math.sin(2*Math.PI*(10*i)/120),0.0012);
  }
  const pt=svg.match(/<circle id="qmin-point"[^>]*cx="([\d.]+)" cy="([\d.]+)"/);
  // ALT-R01 fix: the marker sits in the transition-boiling valley (555, 412),
  // not on the CHF peak where the pre-fix drawing had placed it (cy 290.5).
  assert.ok(pt); approximately(Number(pt[1]),555,0.01); approximately(Number(pt[2]),412,0.01);
});

test('boiling-curve plot lies inside panel 1 and is not painted over by later panels (A2-PE-25)',()=>{
  const panels=[...svg.matchAll(/<rect class="panel" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
    .map(m=>({x:Number(m[1]),y:Number(m[2]),w:Number(m[3]),h:Number(m[4])}));
  assert.equal(panels.length,3);
  const [p1,p2,p3]=panels;
  const inside=(x,y,r)=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;
  const curve=coordinates('boiling-curve');
  for(const [x,y] of curve){
    assert.ok(inside(x,y,p1),`curve point ${x},${y} outside panel 1`);
    assert.ok(!inside(x,y,p2)&&!inside(x,y,p3),`curve point ${x},${y} inside a later panel`);
  }
  const pt=svg.match(/<circle id="qmin-point"[^>]*cx="([\d.]+)" cy="([\d.]+)"/);
  assert.ok(pt);
  assert.ok(curve.some(([x,y])=>Math.abs(x-Number(pt[1]))<0.01&&Math.abs(y-Number(pt[2]))<0.01),
    'q_min point is not on the boiling curve');
  const cap=svg.match(/<text[^>]*y="([\d.]+)"[^>]*>壁面過熱度/);
  assert.ok(cap,'axis caption not found');
  assert.ok(Number(cap[1])<=p1.y+p1.h,'axis caption outside panel 1');
});

test('curve is declared schematic and q_min is a practical lower bound, not CHF',()=>{
  for(const word of ['模式図。q_min の点以外は数値を表さない','実用的な下限','CHF と混同しない'])
    assert.ok(svg.includes(word),word);
});

test('boiling curve has a CHF peak, a transition descent and a q_min valley before the film branch (ALT-R01)',()=>{
  const curve=coordinates('boiling-curve');
  const ys=curve.map(p=>p[1]);
  const peak=ys.indexOf(Math.min(...ys));
  const pt=svg.match(/<circle id="qmin-point"[^>]*cx="([\d.]+)" cy="([\d.]+)"/);
  const valley=curve.findIndex(([x,y])=>Math.abs(x-Number(pt[1]))<0.01&&Math.abs(y-Number(pt[2]))<0.01);
  assert.ok(peak>0&&valley>peak,'peak must precede the valley');
  for(let i=0;i<peak;i++) assert.ok(ys[i]>ys[i+1],'nucleate branch must rise toward CHF');
  for(let i=peak;i<valley;i++) assert.ok(ys[i]<ys[i+1],'transition branch must descend toward q_min');
  for(let i=valley;i<ys.length-1;i++) assert.ok(ys[i]>ys[i+1],'film branch must rise after q_min');
  assert.ok(ys[valley]>ys[valley-1]&&ys[valley]>ys[valley+1],'q_min must be a local flux minimum');
});
