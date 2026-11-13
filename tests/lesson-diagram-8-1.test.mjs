import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-8-1-driving-forces-richardson.svg', import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
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

const p={beta:number('data-beta'),dT:number('data-dt'),L:number('data-length'),
  nu:number('data-nu'),alpha:number('data-alpha'),U:number('data-velocity'),
  Gr:number('data-gr'),Pr:number('data-pr'),Ra:number('data-ra'),
  Re:number('data-re'),Ri:number('data-ri'),betaDT:number('data-beta-dt')};

test('§8.1 original SVG has accessible descriptions and no external references',()=>{
  common('8.1','scope');
});

test('Gr, Ra, Re and Richardson number independently agree',()=>{
  assert.deepEqual([p.dT,p.L,p.nu,p.alpha,p.U],[20,0.50,1.6e-5,2.2e-5,2.0]);
  rel(p.beta,1/303.15);
  rel(p.betaDT,p.beta*p.dT);
  rel(p.Pr,p.nu/p.alpha);
  rel(p.Gr,9.81*p.beta*p.dT*p.L**3/p.nu**2);
  rel(p.Ra,p.Gr*p.Pr);
  rel(p.Re,p.U*p.L/p.nu);
  rel(p.Ri,p.Gr/p.Re**2);
  assert.ok(Math.abs(p.Ri-0.0809)<5e-4);
  for(const expected of ['Gr_L ≈ 3.16×10^8','Ra_L ≈ 2.30×10^8','Ri ≈ 0.0809']) assert.ok(svg.includes(expected),expected);
});

test('Ri marker sits at the log-scale position and zones span the axis',()=>{
  const m=svg.match(/<path id="ri-marker"[^>]*d="M ([\d.]+) 668 L ([\d.]+) 700"/);
  assert.ok(m,'Missing Ri marker');
  const xExpected=110+(Math.log10(p.Ri)+3)*(620/6);
  approximately(Number(m[1]),xExpected,0.01);
  approximately(Number(m[2]),xExpected,0.01);
  const zones=[...svg.matchAll(/<rect class="zone\d" x="([\d.]+)" y="700" width="([\d.]+)" height="46"\/>/g)];
  assert.equal(zones.length,3);
  approximately(Number(zones[0][1]),110,0.01);
  approximately(Number(zones[2][1])+Number(zones[2][2]),730,0.01);
});

test('scale-only caveats are visible; no h prediction is claimed',()=>{
  for(const word of ['一つの数値だけで全ての混合対流を判定しない','助長／対向','h はまだ予測していない'])
    assert.ok(svg.includes(word),word);
  assert.doesNotMatch(svg,/Ri だけで遷移を判定できる/);
});
