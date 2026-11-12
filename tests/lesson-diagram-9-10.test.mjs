import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-9-10-dropwise-droplet-cycle.svg', import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
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

const p={tC:number('data-t-steam-c'),th:number('data-dtheta'),q:number('data-q-rose'),
  hEff:number('data-h-eff'),slope:number('data-slope'),R:number('data-r-coat'),
  thS:number('data-dtheta-surface'),qC:number('data-q-coated'),drop:number('data-coat-drop'),
  tSurf:number('data-t-surface')};
const rose=(th)=>1000*Math.pow(p.tC,0.8)*(5*th+0.3*th**2);

test('§9.10 original SVG has accessible descriptions and no external references',()=>{
  common('9.10','drop');
});

test('Rose correlation, effective h and derivative slope independently agree',()=>{
  assert.deepEqual([p.tC,p.th],[60.0,4.00]);
  approximately(p.q,rose(p.th),1e-2);
  approximately(p.hEff,p.q/p.th,1e-2);
  approximately(p.slope,1000*Math.pow(p.tC,0.8)*(5+0.6*p.th),1e-2);
  assert.ok(p.slope>p.hEff);
  for(const expected of ['6.56×10^5 W/m²','1.64×10^5 W/(m²·K)']) assert.ok(svg.includes(expected),expected);
});

test('coating coupling closes the temperature balance',()=>{
  let lo=0,hi=p.th;
  for(let i=0;i<200;i++){
    const mid=(lo+hi)/2;
    if(mid+p.R*rose(mid)<p.th) lo=mid; else hi=mid;
  }
  const thS=(lo+hi)/2;
  approximately(p.thS,thS,1e-9);
  approximately(p.qC,rose(thS),1e-2);
  approximately(p.drop,p.qC*p.R,1e-6);
  approximately(p.thS+p.drop,p.th,1e-9);
  approximately(p.tSurf,p.tC-thS,1e-9);
});

test('droplet growth sequence radii increase and the curve follows Rose',()=>{
  const m=svg.match(/<g id="droplet-row">([\s\S]*?)<\/g>/);
  assert.ok(m);
  const radii=[...m[1].matchAll(/<circle class="drop" cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"\/>/g)]
    .map(x=>Number(x[3]));
  assert.deepEqual(radii,[6,10,16,24,34]);
  const curve=coordinates('rose-curve');
  assert.equal(curve.length,17);
  for(let i=0;i<=16;i++){
    const th=0.5*i;
    approximately(curve[i][0],170+470*(th/8),0.0012);
    approximately(curve[i][1],826-136*(rose(th)/1.6e6),0.0012);
  }
  for(const word of ['工業的に持続させる方法は確立していない','接触角約90°'])
    assert.ok(svg.includes(word),word);
});
